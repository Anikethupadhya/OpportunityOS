import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/db";
import { anthropic, BRIEF_MODEL } from "@/lib/claude";
import { logAiUsage } from "@/lib/ai-usage";

// Validate a cluster's pain with real web searches before any human reviews it.
// Writes a structured report into research_notes; OFFER_SUGGESTIONS at the end
// pre-fills the Offer Gate.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceClient();

  const { data: cluster, error: clusterError } = await db
    .from("problem_clusters")
    .select("id, canonical_name, problem_category")
    .eq("id", id)
    .single();

  if (clusterError || !cluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  const { data: opps } = await db
    .from("opportunities")
    .select("raw_problem_hint")
    .eq("cluster_id", id)
    .not("raw_problem_hint", "is", null)
    .limit(5);

  const hints = (opps ?? [])
    .map((o) => o.raw_problem_hint as string)
    .filter(Boolean);

  await db.from("problem_clusters").update({ research_status: "pending" }).eq("id", id);

  try {
    const userMessage = `You are researching whether a real, monetizable digital product opportunity exists for this problem cluster:

Problem: ${cluster.canonical_name}
Category: ${cluster.problem_category ?? "unknown"}

Raw signals we collected (title | matched phrase | source | body excerpt):
${hints.length > 0 ? hints.map((h, i) => `${i + 1}. ${h}`).join("\n") : "(no raw signals available)"}

Use web search to investigate:
- Search Reddit for discussions about this problem (find real pain quotes)
- Search Gumroad and Etsy for existing products solving it, with prices
- Search for existing free solutions (templates, guides, tools)
- Search TikTok and the general web for demand signals

Then write a structured research report in EXACTLY this format (keep the headings and the delimiter verbatim):

## Pain Evidence
(2-3 real quotes or close paraphrases showing genuine user pain, with where they came from)

## Who's Asking
(specific buyer type - job title, context, what they're trying to do)

## What Already Exists
(competing products with prices if found, or "Nothing found")

## Demand Signals
(post frequency, recency, social presence, search volume signals)

## Opportunity Gap
(what is missing from existing solutions, or why this is already solved)

## Verdict
Strong Pain / Weak Pain / Already Solved
(one sentence reason)

---OFFER_SUGGESTIONS---
BUYER: [specific buyer type]
JOB: [one sentence - the painful job this product solves]
FORMAT: [one of: spreadsheet / SOP / template pack / prompt pack / tracker / Notion system]
WHY_PAY: [specific reason to pay vs asking ChatGPT]
WHY_FAIL: [most likely reason this offer would not sell]`;

    const response = await anthropic.messages.create({
      model: BRIEF_MODEL,
      max_tokens: 4096,
      // SDK ^0.39.0 predates the web_search tool type, so cast past its Tool union.
      // max_uses 3: every search iteration re-feeds the whole conversation as input
      // tokens — uncapped runs hit ~220k input per call, which drains the org's
      // 10k input-tokens/min Sonnet limit for 20+ minutes and 429s everything after.
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: 3 } as unknown as Anthropic.Tool,
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    await logAiUsage({
      model: BRIEF_MODEL,
      callType: "cluster_research",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!text.trim()) {
      throw new Error("Research call returned no text content");
    }

    const { error: saveError } = await db
      .from("problem_clusters")
      .update({
        research_notes: text,
        research_status: "complete",
        research_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (saveError) throw new Error(`Failed to save research: ${saveError.message}`);

    return NextResponse.json({ ok: true, research_status: "complete" });
  } catch (err) {
    console.error(`[research] cluster ${id} failed:`, err);
    await db.from("problem_clusters").update({ research_status: "failed" }).eq("id", id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed" },
      { status: 500 }
    );
  }
}
