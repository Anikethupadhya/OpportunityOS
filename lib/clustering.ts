import { anthropic, BRIEF_MODEL } from "@/lib/claude";
import { logAiUsage } from "@/lib/ai-usage";
import { createServiceClient } from "@/lib/db";
import { CLUSTERING_SYSTEM_PROMPT } from "@/lib/prompts/clustering";

const BATCH_SIZE = 25;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function runClusteringPass(): Promise<{
  processed: number;
  clustered: number;
  failed: number;
  new_clusters: number;
}> {
  console.log("[clustering] pass started");
  const db = createServiceClient();

  // Step 1 — find unprocessed signals
  const { data: signals, error: fetchError } = await db
    .from("opportunities")
    .select("id, raw_problem_hint")
    .not("raw_problem_hint", "is", null)
    .is("cluster_id", null)
    .neq("status", "rejected")
    .limit(100);

  if (fetchError) {
    console.error("[clustering] failed to fetch signals:", fetchError);
    return { processed: 0, clustered: 0, failed: 0, new_clusters: 0 };
  }

  console.log(`[clustering] found ${signals?.length ?? 0} unprocessed signals`);

  if (!signals || signals.length === 0) {
    return { processed: 0, clustered: 0, failed: 0, new_clusters: 0 };
  }

  let processed = 0;
  let clustered = 0;
  let failed = 0;
  const insertedKeysThisPass = new Set<string>();

  // Step 2 — batch and call Sonnet
  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);
    const batchIds = new Set(batch.map((s) => s.id));

    const userMessage = batch
      .map((s, idx) => `${idx + 1}. id: ${s.id}\nraw_problem_hint: ${s.raw_problem_hint}`)
      .join("\n\n");

    processed += batch.length;

    console.log(`[clustering] calling Sonnet with batch of ${batch.length} signals`);

    let results: Array<{
      id: string;
      canonical_name: string;
      problem_category: string;
      specificity: number;
    }>;

    let rawSonnetText = "";
    try {
      const response = await anthropic.messages.create({
        model: BRIEF_MODEL,
        max_tokens: 1500,
        system: CLUSTERING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      await logAiUsage({
        model: BRIEF_MODEL,
        callType: "clustering",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      rawSonnetText = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      console.log("[clustering] Sonnet responded, parsing JSON");
      const stripped = rawSonnetText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const parsed = JSON.parse(stripped);
      results = parsed.results;
      console.log(`[clustering] first result id: ${results[0]?.id}`);
      console.log(`[clustering] first batch id: ${[...batchIds][0]}`);
    } catch (err) {
      console.error("[clustering] batch failed (API or JSON parse):", err);
      console.error("[clustering] raw Sonnet response was:", rawSonnetText.slice(0, 1000));
      failed += batch.length;
      continue;
    }

    // Step 3 — validate, upsert cluster, link signal
    for (const result of results) {
      if (!batchIds.has(result.id)) {
        console.warn(`[clustering] REJECTED id not in batch: ${result.id}`);
        failed++;
        continue;
      }

      const canonical_key = slugify(result.canonical_name);
      const now = new Date().toISOString();
      let clusterId: string;

      try {
        const { data: existing } = await db
          .from("problem_clusters")
          .select("id")
          .eq("canonical_key", canonical_key)
          .maybeSingle();

        if (existing) {
          await db
            .from("problem_clusters")
            .update({ last_seen_at: now })
            .eq("id", existing.id);
          clusterId = existing.id;
        } else {
          const { data: inserted, error: insertError } = await db
            .from("problem_clusters")
            .insert({
              canonical_key,
              canonical_name: result.canonical_name,
              problem_category: result.problem_category,
              specificity: result.specificity,
              first_seen_at: now,
              last_seen_at: now,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error(`[clustering] DB error:`, insertError);
            // Unique constraint violation — likely a race; report and skip this signal
            if (insertError.code === "23505") {
              console.error(
                `[clustering] unique constraint violation for canonical_key="${canonical_key}" — skipping signal ${result.id}. Do not auto-merge.`
              );
            } else {
              console.error("[clustering] insert cluster error:", insertError);
            }
            failed++;
            continue;
          }

          clusterId = inserted!.id;
          insertedKeysThisPass.add(canonical_key);
        }
      } catch (err) {
        console.error("[clustering] cluster upsert error:", err);
        failed++;
        continue;
      }

      const { error: linkError } = await db
        .from("opportunities")
        .update({ cluster_id: clusterId })
        .eq("id", result.id);

      if (linkError) {
        console.error(`[clustering] link error for signal ${result.id}:`, linkError);
        failed++;
        continue;
      }

      clustered++;
    }
  }

  return {
    processed,
    clustered,
    failed,
    new_clusters: insertedKeysThisPass.size,
  };
}
