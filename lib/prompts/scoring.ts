import { anthropic, SCORING_MODEL } from "@/lib/claude";
import { logAiUsage } from "@/lib/ai-usage";
import type Anthropic from "@anthropic-ai/sdk";
import type { ScoreResult } from "@/lib/types";

const SYSTEM = `You are an expert business analyst specializing in online business opportunities.
Analyze signals from Reddit, Hacker News, Twitter, and other platforms to determine:
- Whether the signal represents a real, monetizable market need
- How viable it is to build a digital product or small SaaS around it
- How executable it is for a solo operator or small team with AI assistance

Be honest and objective. Most signals are noise. Only score high when the need is clear,
specific, and underserved.`;

const scoreTool: Anthropic.Tool = {
  name: "score_opportunity",
  description: "Score a business opportunity across viability and execution readiness dimensions",
  input_schema: {
    type: "object" as const,
    properties: {
      viability_score: {
        type: "number",
        description: "0-100. Composite score: market size × demand clarity × competition gap",
      },
      revenue_potential: {
        type: "string",
        enum: ["low", "medium", "high", "very_high"],
        description: "Expected revenue ceiling if executed well",
      },
      effort_estimate: {
        type: "string",
        enum: ["hours", "days", "weeks", "months"],
        description: "Time to first launchable version",
      },
      competition_level: {
        type: "string",
        enum: ["none", "low", "medium", "high"],
        description: "How saturated is this space already?",
      },
      time_sensitivity: {
        type: "string",
        enum: ["evergreen", "trending", "urgent"],
        description: "Does timing matter for this opportunity?",
      },
      scoring_rationale: {
        type: "string",
        description: "2-3 sentences explaining the viability score. Be specific about what drove the score up or down.",
      },
      execution_readiness_score: {
        type: "number",
        description: "0-100. How executable is this for a solo operator with AI tools, assuming digital products as primary execution vehicle?",
      },
      skill_alignment: {
        type: "number",
        description: "0-100. Does this opportunity require common skills (writing, basic coding, design) vs specialized ones?",
      },
      resource_availability: {
        type: "number",
        description: "0-100. Are the tools, platforms, and resources needed readily accessible? 100 = needs nothing special.",
      },
      time_to_first_action_hours: {
        type: "number",
        description: "Estimated hours until the operator could take their very first concrete step on this opportunity",
      },
      ers_rationale: {
        type: "string",
        description: "1-2 sentences on what makes this easy or hard to execute right now.",
      },
    },
    required: [
      "viability_score",
      "revenue_potential",
      "effort_estimate",
      "competition_level",
      "time_sensitivity",
      "scoring_rationale",
      "execution_readiness_score",
      "skill_alignment",
      "resource_availability",
      "time_to_first_action_hours",
      "ers_rationale",
    ],
  },
};

export async function scoreOpportunity(data: {
  title: string;
  summary: string;
  source_type: string;
  source_raw: string;
  category: string;
  opportunityId?: string;
}): Promise<ScoreResult> {
  const userMessage = `Score this opportunity:

Title: ${data.title}
Category: ${data.category}
Source: ${data.source_type}

Summary:
${data.summary}

Raw Signal:
${data.source_raw.slice(0, 2000)}`;

  const response = await anthropic.messages.create({
    model: SCORING_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    tools: [scoreTool],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
  });

  await logAiUsage({
    model: SCORING_MODEL,
    callType: "scoring",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    opportunityId: data.opportunityId,
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  return toolUse.input as ScoreResult;
}
