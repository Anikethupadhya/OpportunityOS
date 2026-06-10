import { createServiceClient } from "@/lib/db";
import { scoreOpportunity } from "@/lib/prompts/scoring";
import { runClusteringPass } from "@/lib/clustering";

const SUBREDDITS = [
  "freelance",
  "Notion",
  "ChatGPT",
  "productivity",
  "smallbusiness",
  "webdev",
  // Session 5 additions — practitioner communities that pay for tools, not dreamers.
  // (smallbusiness was already present, so EtsySellers fills the 4th slot; Etsy is a
  // first-line publishing target, and its sellers are operators with tool-shaped pain.)
  "ecommerce",
  "bookkeeping",
  "projectmanagement",
  "EtsySellers",
];

const MAX_PER_SUBREDDIT = 200;
const MAX_TOTAL = 1200;

// Tier 1: broad first gate — cheap, eliminates clearly irrelevant posts.
// Exported so other sources (e.g. Hacker News) apply the exact same filter.
export const CANDIDATE_KEYWORDS = [
  "struggling with",
  "frustrated with",
  "sick of",
  "pain point",
  "alternative to",
  "better way to",
  "how do I",
  "what should I use",
  "any recommendations",
  "any good tools",
  "does anyone use",
  "what do you use for",
  "how are you handling",
  "wish there was",
  "would pay for",
  "I'd pay for",
  "is there a tool",
  "is there an app",
  "looking for a tool",
  "looking for a way",
  "I need a way",
  "nobody has built",
  "why is there no",
  "does anyone know a tool",
  "anyone else struggling",
  "there has to be a better way",
];

// Tier 2: strict product/opportunity intent — must also match at least one of these.
// Session 5: tightened toward business-operator / client-facing pain. Each phrase below
// is either a purchase signal, an explicit tool search, or a named workflow friction.
// Exported so other sources (e.g. Hacker News) apply the exact same filter.
export const HIGH_INTENT_PHRASES = [
  "I'd pay for",
  "would pay for",
  "does anyone know a tool",
  "is there a tool",
  "looking for a tool",
  "nobody has built",
  "why is there no",
  // Session 5 additions — anchored to a business workflow or client-facing operation:
  "do this manually for every client",
  "copy paste between",
  "spreadsheet isn't cutting it",
  "can't find a tool that does both",
  "paying someone to do this every week",
];

// Removed in Session 5 — each matched casual productivity / self-improvement posts that
// are not anchored to a business workflow or client-facing operation:
//   "is there an app"           — generic consumer app requests (e.g. habit/water trackers)
//   "looking for a way to"      — matches personal self-improvement ("a way to wake up earlier")
//   "I wish there was"          — dreamer phrasing, mostly non-commercial wishes
//   "wish there was"            — same dreamer phrasing, no purchase or workflow anchor
//   "there has to be a better way" — generic venting, not tied to a paid workflow
//   "I need a way to"           — casual personal-goal phrasing, no business context
//   "anyone else struggling with"  — generic complaint, not tool- or purchase-shaped

interface RedditPost {
  title: string;
  selftext: string;
  permalink: string;
  subreddit: string;
}

// Per-source diagnostics block (keyed by subreddit for Reddit, by "hackernews" for HN).
export interface SourceDiagnostics {
  fetchedNew: number;
  fetchedTop: number;
  mergedUnique: number;
  candidates: number;
  rejected: number;
  skipped: number;
  inserted: number;
}

// Shared return shape for every signal source so results can be merged uniformly.
export interface ScanResult {
  discovered: number;
  skipped: number;
  rejected: number;
  titles: string[];
  rawFetchedNew: number;
  rawFetchedTop: number;
  mergedUnique: number;
  diagnostics: Record<string, SourceDiagnostics>;
  clustering_processed: number;
  clustering_clustered: number;
  clustering_failed: number;
  clustering_new_clusters: number;
}

// Tier 1 match on arbitrary text — the single source of truth for candidate detection.
export function matchesCandidateText(text: string): boolean {
  const lower = text.toLowerCase();
  return CANDIDATE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

// Tier 2 match on arbitrary text — returns the matched high-intent phrase, or null.
export function matchHighIntentText(text: string): string | null {
  const lower = text.toLowerCase();
  return HIGH_INTENT_PHRASES.find((kw) => lower.includes(kw.toLowerCase())) ?? null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#32;/g, " ")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseAtomFeed(xml: string, subreddit: string): RedditPost[] {
  const posts: RedditPost[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/.exec(entry);
    const linkMatch = /<link[^>]*href="([^"]*)"[^/>]*\/>/.exec(entry);
    const contentMatch = /<content[^>]*>([\s\S]*?)<\/content>/.exec(entry);

    if (!titleMatch || !linkMatch) continue;

    const title = decodeHtmlEntities(titleMatch[1]).trim();
    const rawUrl = linkMatch[1];
    const permalink = rawUrl.replace("https://www.reddit.com", "https://reddit.com");

    let selftext = "";
    if (contentMatch) {
      selftext = stripHtml(decodeHtmlEntities(contentMatch[1])).slice(0, 1000);
    }

    posts.push({ title, selftext, permalink, subreddit });
  }

  return posts;
}

async function fetchFeed(subreddit: string, url: string): Promise<RedditPost[]> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OpportunityOS/1.0)",
        "Accept": "application/atom+xml, application/xml, text/xml",
      },
      next: { revalidate: 0 },
    });
  } catch (err) {
    console.error(`[reddit] fetch threw for ${url}:`, err);
    return [];
  }

  if (!response.ok) {
    console.error(`[reddit] ${url} → HTTP ${response.status}`);
    return [];
  }

  const xml = await response.text();
  return parseAtomFeed(xml, subreddit);
}

function isCandidate(post: RedditPost): boolean {
  return matchesCandidateText(`${post.title} ${post.selftext}`);
}

// Returns the matched Tier 2 phrase, or null if none matched.
function matchHighIntent(post: RedditPost): string | null {
  return matchHighIntentText(`${post.title} ${post.selftext}`);
}

export async function scanReddit(): Promise<ScanResult> {
  const db = createServiceClient();
  const discovered: string[] = [];
  let skippedCount = 0;
  let rejectedCount = 0;
  let totalRawNew = 0;
  let totalRawTop = 0;
  let totalMergedUnique = 0;
  let totalProcessed = 0;

  const diagnostics: Record<string, SourceDiagnostics> = {};

  for (const subreddit of SUBREDDITS) {
    // Enforce total cap across all subreddits
    if (totalProcessed >= MAX_TOTAL) {
      console.log(`[reddit] total cap of ${MAX_TOTAL} reached — stopping`);
      break;
    }

    // Fetch /new and /top in parallel
    const [newPosts, topPosts] = await Promise.all([
      fetchFeed(subreddit, `https://www.reddit.com/r/${subreddit}/new/.rss?limit=100`),
      fetchFeed(subreddit, `https://www.reddit.com/r/${subreddit}/top/.rss?t=day&limit=100`),
    ]);

    totalRawNew += newPosts.length;
    totalRawTop += topPosts.length;

    // Feed dedup: merge and deduplicate by permalink in memory
    const seenPermalinks = new Set<string>();
    const merged: RedditPost[] = [];
    for (const post of [...newPosts, ...topPosts]) {
      if (!seenPermalinks.has(post.permalink)) {
        seenPermalinks.add(post.permalink);
        merged.push(post);
      }
    }

    // Enforce per-subreddit cap
    const capped = merged.slice(0, MAX_PER_SUBREDDIT);
    totalMergedUnique += capped.length;
    totalProcessed += capped.length;

    console.log(
      `[reddit] r/${subreddit} → new=${newPosts.length} top=${topPosts.length} merged=${merged.length} capped=${capped.length}`
    );

    diagnostics[subreddit] = {
      fetchedNew: newPosts.length,
      fetchedTop: topPosts.length,
      mergedUnique: capped.length,
      candidates: 0,
      rejected: 0,
      skipped: 0,
      inserted: 0,
    };

    const candidates = capped.filter(isCandidate);
    diagnostics[subreddit].candidates = candidates.length;

    if (candidates.length === 0) continue;

    // DB dedup on all candidates — already-seen URLs (any status) → skipped
    const candidateUrls = candidates.map((p) => p.permalink);
    const { data: existing, error: dedupError } = await db
      .from("opportunities")
      .select("source_url")
      .in("source_url", candidateUrls);

    if (dedupError) console.error(`[reddit] r/${subreddit} dedup error:`, dedupError);

    const existingUrls = new Set((existing ?? []).map((r) => r.source_url));
    const newCandidates = candidates.filter((p) => !existingUrls.has(p.permalink));
    const seenCount = candidates.length - newCandidates.length;

    skippedCount += seenCount;
    diagnostics[subreddit].skipped = seenCount;
    console.log(
      `[reddit] r/${subreddit} → ${candidates.length} candidates, ${seenCount} already seen, ${newCandidates.length} new`
    );

    if (newCandidates.length === 0) continue;

    // matchedPhrases maps permalink → matched Tier 2 phrase (or null)
    const matchedPhrases = new Map(
      newCandidates.map((p) => [p.permalink, matchHighIntent(p)])
    );
    const signals = newCandidates.filter((p) => matchedPhrases.get(p.permalink) !== null);
    const lowIntent = newCandidates.filter((p) => matchedPhrases.get(p.permalink) === null);

    console.log(
      `[reddit] r/${subreddit} → ${signals.length} high-intent, ${lowIntent.length} rejected`
    );

    // Insert Tier 2 failures as rejected so their URLs are in DB for future dedup
    for (const post of lowIntent) {
      const title = post.title.slice(0, 120);
      const summary = post.selftext
        ? post.selftext.slice(0, 300)
        : `Reddit post from r/${subreddit}.`;

      const { error } = await db.from("opportunities").insert({
        title,
        summary,
        source_type: "reddit",
        source_url: post.permalink,
        source_raw: `${post.title}\n\n${post.selftext}`,
        category: "digital_product",
        tags: [subreddit],
        status: "rejected",
        rejection_reason: "failed_tier2_filter",
      });

      if (error) {
        console.error(`[reddit] insert rejected error for "${title}":`, error.message);
      } else {
        rejectedCount++;
        diagnostics[subreddit].rejected++;
      }
    }

    // Insert Tier 2 passes, then score
    for (const post of signals) {
      const title = post.title.slice(0, 120);
      const summary = post.selftext
        ? post.selftext.slice(0, 300)
        : `Reddit post from r/${subreddit}.`;

      const matchedPhrase = matchedPhrases.get(post.permalink)!;
      const bodyExcerpt = post.selftext.slice(0, 200);
      const raw_problem_hint = `${post.title} | ${matchedPhrase} | ${subreddit} | ${bodyExcerpt}`;

      const { data: opp, error } = await db
        .from("opportunities")
        .insert({
          title,
          summary,
          source_type: "reddit",
          source_url: post.permalink,
          source_raw: `${post.title}\n\n${post.selftext}`,
          category: "digital_product",
          tags: [subreddit],
          status: "discovered",
          raw_problem_hint,
        })
        .select()
        .single();

      if (error) {
        console.error(`[reddit] insert error for "${title}":`, error.message);
        continue;
      }
      if (!opp) continue;

      diagnostics[subreddit].inserted++;
      console.log(`[reddit] inserted: "${title}"`);

      try {
        const scores = await scoreOpportunity({
          title: opp.title,
          summary: opp.summary,
          source_type: "reddit",
          source_raw: opp.source_raw,
          category: "digital_product",
          opportunityId: opp.id,
        });

        await db
          .from("opportunities")
          .update({ ...scores, status: "reviewed" })
          .eq("id", opp.id);

        discovered.push(opp.title);
        console.log(`[reddit] scored: "${opp.title}"`);
      } catch (err) {
        console.error(`[reddit] scoring failed for "${opp.title}":`, err);
        discovered.push(`${opp.title} (scoring failed)`);
      }
    }
  }

  let clusteringResult = { processed: 0, clustered: 0, failed: 0, new_clusters: 0 };
  try {
    clusteringResult = await runClusteringPass();
  } catch (err) {
    console.error("[reddit] clustering pass failed:", err);
    // clustering failure must never break Reddit discovery
  }

  return {
    discovered: discovered.length,
    skipped: skippedCount,
    rejected: rejectedCount,
    titles: discovered,
    rawFetchedNew: totalRawNew,
    rawFetchedTop: totalRawTop,
    mergedUnique: totalMergedUnique,
    diagnostics,
    clustering_processed: clusteringResult.processed,
    clustering_clustered: clusteringResult.clustered,
    clustering_failed: clusteringResult.failed,
    clustering_new_clusters: clusteringResult.new_clusters,
  };
}

// Approximate the AI cost of the just-finished scan by summing ai_usage_log rows
// written in the recent window. Not exact (a concurrent scan would overlap), but
// good enough to surface per-scan spend without changing logAiUsage().
export async function sumRecentAiCost(windowMinutes = 2): Promise<number> {
  try {
    const db = createServiceClient();
    const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
    const { data, error } = await db
      .from("ai_usage_log")
      .select("cost_usd")
      .gte("created_at", since);
    if (error) {
      console.error("[scan] failed to sum recent AI cost:", error);
      return 0;
    }
    return (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  } catch (err) {
    console.error("[scan] sumRecentAiCost threw:", err);
    return 0;
  }
}
