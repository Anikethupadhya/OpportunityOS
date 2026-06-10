import { anthropic, BRIEF_MODEL } from "@/lib/claude";
import { logAiUsage } from "@/lib/ai-usage";
import type { Opportunity } from "@/lib/types";

const SYSTEM = `You are an expert startup advisor focused on fast revenue generation.
Your job is to generate concrete, actionable execution briefs for digital product opportunities.

Phase 1 constraint: All executions should be Digital Products (templates, Notion docs,
spreadsheets, prompt packs, swipe files, mini-ebooks, checklists) sold on Gumroad or Lemon Squeezy.
These can be created with AI assistance in hours, not weeks.

Your brief must be specific, not generic. No platitudes. Real first steps a person can take TODAY.`;

export async function generateBrief(opportunity: Opportunity): Promise<string> {
  const userMessage = `Generate an execution brief for this approved opportunity:

Title: ${opportunity.title}
Category: ${opportunity.category}
Summary: ${opportunity.summary}
Viability Score: ${opportunity.viability_score}/100
Revenue Potential: ${opportunity.revenue_potential}
Effort Estimate: ${opportunity.effort_estimate}
Time Sensitivity: ${opportunity.time_sensitivity}

Scoring Rationale: ${opportunity.scoring_rationale}
ERS Rationale: ${opportunity.ers_rationale}

Source Signal:
${(opportunity.source_raw ?? "").slice(0, 1500)}

Format your response as markdown with these exact sections:
## Product
What to build (1 specific digital product, not multiple options)

## Target Customer
Who buys this and why (specific persona, 2-3 sentences)

## Platform & Pricing
Where to sell it and at what price point (justify the price)

## First 5 Actions
Numbered list — what to do TODAY in order

## Distribution
Where to post/announce it to get the first 10 sales (specific subreddits, communities, channels)

## Success Metric
What does "this worked" look like? (specific number within 2 weeks)`;

  const response = await anthropic.messages.create({
    model: BRIEF_MODEL,
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  await logAiUsage({
    model: BRIEF_MODEL,
    callType: "brief",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    opportunityId: opportunity.id,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text block");
  }

  return textBlock.text;
}
