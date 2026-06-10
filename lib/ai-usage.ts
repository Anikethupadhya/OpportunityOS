import { SCORING_MODEL, BRIEF_MODEL } from "@/lib/claude";
import { createServiceClient } from "@/lib/db";

export const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  [SCORING_MODEL]: { inputPerMillion: 0.80, outputPerMillion: 4.00 },
  [BRIEF_MODEL]:   { inputPerMillion: 3.00, outputPerMillion: 15.00 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.inputPerMillion
       + (outputTokens / 1_000_000) * pricing.outputPerMillion;
}

export async function logAiUsage({
  model,
  callType,
  inputTokens,
  outputTokens,
  opportunityId,
}: {
  model: string;
  callType: string;
  inputTokens: number;
  outputTokens: number;
  opportunityId?: string;
}): Promise<void> {
  try {
    const cost = calculateCost(model, inputTokens, outputTokens);
    const db = createServiceClient();
    await db.from("ai_usage_log").insert({
      model,
      call_type: callType,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
      opportunity_id: opportunityId ?? null,
    });
  } catch (err) {
    console.error("[ai-usage] failed to log usage:", err);
  }
}
