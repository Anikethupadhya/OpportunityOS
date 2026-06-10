import { createServiceClient } from "@/lib/db";
import { scoreOpportunity } from "@/lib/prompts/scoring";
import {
  matchesCandidateText,
  matchHighIntentText,
  type ScanResult,
  type SourceDiagnostics,
} from "@/lib/reddit";

// Hacker News Algolia search — free, no API key. We query for tool-pain "Ask HN" posts.
const HN_QUERIES = ["is there a tool", "does anyone know a tool", "would pay for"];
const MAX_HN_TOTAL = 300;

interface HnHit {
  objectID: string;
  title: string;
  story_text: string | null;
  url: string | null;
  points: number | null;
  created_at: string | null;
}

async function fetchHnQuery(query: string): Promise<HnHit[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
    query
  )}&tags=ask_hn&hitsPerPage=100`;

  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      console.error(`[hackernews] ${url} → HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as { hits?: Array<Record<string, unknown>> };
    return (json.hits ?? []).map((h) => ({
      objectID: String(h.objectID ?? ""),
      title: typeof h.title === "string" ? h.title : "",
      story_text: typeof h.story_text === "string" ? h.story_text : null,
      url: typeof h.url === "string" ? h.url : null,
      points: typeof h.points === "number" ? h.points : null,
      created_at: typeof h.created_at === "string" ? h.created_at : null,
    }));
  } catch (err) {
    console.error(`[hackernews] fetch threw for ${url}:`, err);
    return [];
  }
}

export async function scanHackerNews(): Promise<ScanResult> {
  const db = createServiceClient();
  const discovered: string[] = [];
  let skippedCount = 0;
  let rejectedCount = 0;

  const diag: SourceDiagnostics = {
    fetchedNew: 0,
    fetchedTop: 0,
    mergedUnique: 0,
    candidates: 0,
    rejected: 0,
    skipped: 0,
    inserted: 0,
  };

  const emptyResult = (): ScanResult => ({
    discovered: discovered.length,
    skipped: skippedCount,
    rejected: rejectedCount,
    titles: discovered,
    rawFetchedNew: diag.fetchedNew,
    rawFetchedTop: 0,
    mergedUnique: diag.mergedUnique,
    diagnostics: { hackernews: diag },
    // HN does not cluster directly — the cron route runs one clustering pass after
    // both sources have inserted their signals.
    clustering_processed: 0,
    clustering_clustered: 0,
    clustering_failed: 0,
    clustering_new_clusters: 0,
  });

  // 1. Fetch all queries in parallel
  const perQuery = await Promise.all(HN_QUERIES.map(fetchHnQuery));
  const allHits = perQuery.flat();
  diag.fetchedNew = allHits.length;

  // 2. Dedup by objectID in memory
  const seen = new Set<string>();
  const unique: HnHit[] = [];
  for (const hit of allHits) {
    if (!hit.objectID || seen.has(hit.objectID)) continue;
    seen.add(hit.objectID);
    unique.push(hit);
  }
  const capped = unique.slice(0, MAX_HN_TOTAL);
  diag.mergedUnique = capped.length;

  console.log(
    `[hackernews] fetched=${allHits.length} unique=${unique.length} capped=${capped.length}`
  );

  // 3. Tier 1 candidate filter (same keywords as Reddit)
  const candidates = capped.filter((h) =>
    matchesCandidateText(`${h.title} ${h.story_text ?? ""}`)
  );
  diag.candidates = candidates.length;
  if (candidates.length === 0) return emptyResult();

  // DB dedup — already-seen source_urls (any status) are skipped
  const urlFor = (objectID: string) => `https://news.ycombinator.com/item?id=${objectID}`;
  const candidateUrls = candidates.map((h) => urlFor(h.objectID));
  const { data: existing, error: dedupError } = await db
    .from("opportunities")
    .select("source_url")
    .in("source_url", candidateUrls);

  if (dedupError) console.error("[hackernews] dedup error:", dedupError);

  const existingUrls = new Set((existing ?? []).map((r) => r.source_url));
  const newCandidates = candidates.filter((h) => !existingUrls.has(urlFor(h.objectID)));
  skippedCount = candidates.length - newCandidates.length;
  diag.skipped = skippedCount;

  console.log(
    `[hackernews] ${candidates.length} candidates, ${skippedCount} already seen, ${newCandidates.length} new`
  );
  if (newCandidates.length === 0) return emptyResult();

  // Tier 2 high-intent split (same phrases as Reddit)
  const matchedPhrases = new Map(
    newCandidates.map((h) => [
      h.objectID,
      matchHighIntentText(`${h.title} ${h.story_text ?? ""}`),
    ])
  );
  const signals = newCandidates.filter((h) => matchedPhrases.get(h.objectID) !== null);
  const lowIntent = newCandidates.filter((h) => matchedPhrases.get(h.objectID) === null);

  console.log(
    `[hackernews] ${signals.length} high-intent, ${lowIntent.length} rejected`
  );

  // Insert Tier 2 failures as rejected so their URLs are in DB for future dedup
  for (const hit of lowIntent) {
    const title = hit.title.slice(0, 120);
    const summary = hit.story_text ? hit.story_text.slice(0, 300) : "Hacker News post.";
    const { error } = await db.from("opportunities").insert({
      title,
      summary,
      source_type: "hn",
      source_url: urlFor(hit.objectID),
      source_raw: `${hit.title}\n\n${hit.story_text ?? ""}`,
      category: "digital_product",
      tags: ["hackernews"],
      status: "rejected",
      rejection_reason: "failed_tier2_filter",
    });
    if (error) {
      console.error(`[hackernews] insert rejected error for "${title}":`, error.message);
    } else {
      rejectedCount++;
      diag.rejected++;
    }
  }

  // Insert Tier 2 passes, then score
  for (const hit of signals) {
    const title = hit.title.slice(0, 120);
    const summary = hit.story_text ? hit.story_text.slice(0, 300) : "Hacker News post.";
    const matchedPhrase = matchedPhrases.get(hit.objectID)!;
    const raw_problem_hint = `${hit.title} | ${matchedPhrase} | hackernews | ${
      hit.story_text?.slice(0, 200) ?? ""
    }`;

    const { data: opp, error } = await db
      .from("opportunities")
      .insert({
        title,
        summary,
        source_type: "hn",
        source_url: urlFor(hit.objectID),
        source_raw: `${hit.title}\n\n${hit.story_text ?? ""}`,
        category: "digital_product",
        tags: ["hackernews"],
        status: "discovered",
        raw_problem_hint,
      })
      .select()
      .single();

    if (error) {
      console.error(`[hackernews] insert error for "${title}":`, error.message);
      continue;
    }
    if (!opp) continue;

    diag.inserted++;
    console.log(`[hackernews] inserted: "${title}"`);

    try {
      const scores = await scoreOpportunity({
        title: opp.title,
        summary: opp.summary,
        source_type: "hn",
        source_raw: opp.source_raw,
        category: "digital_product",
        opportunityId: opp.id,
      });

      await db
        .from("opportunities")
        .update({ ...scores, status: "reviewed" })
        .eq("id", opp.id);

      discovered.push(opp.title);
      console.log(`[hackernews] scored: "${opp.title}"`);
    } catch (err) {
      console.error(`[hackernews] scoring failed for "${opp.title}":`, err);
      discovered.push(`${opp.title} (scoring failed)`);
    }
  }

  return emptyResult();
}
