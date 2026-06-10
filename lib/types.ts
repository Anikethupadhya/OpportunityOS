export type OpportunityStatus =
  | "discovered"
  | "reviewed"
  | "approved"
  | "executing"
  | "launched"
  | "tracking"
  | "rejected"
  | "archived";

export type SourceType =
  | "reddit"
  | "twitter"
  | "hn"
  | "producthunt"
  | "google_trends"
  | "manual";

export type Category =
  | "digital_product"
  | "saas"
  | "content"
  | "service"
  | "affiliate"
  | "physical";

export type RevenuePotential = "low" | "medium" | "high" | "very_high";
export type EffortEstimate = "hours" | "days" | "weeks" | "months";
export type CompetitionLevel = "none" | "low" | "medium" | "high";
export type TimeSensitivity = "evergreen" | "trending" | "urgent";
export type RevenuePlatform =
  | "gumroad"
  | "lemon_squeezy"
  | "stripe"
  | "paypal"
  | "direct"
  | "other";

export interface Opportunity {
  id: string;
  title: string;
  summary: string;

  source_type: SourceType;
  source_url: string | null;
  source_raw: string;
  discovered_at: string;

  category: Category;
  tags: string[];

  viability_score: number | null;
  revenue_potential: RevenuePotential | null;
  effort_estimate: EffortEstimate | null;
  competition_level: CompetitionLevel | null;
  time_sensitivity: TimeSensitivity | null;
  scoring_rationale: string | null;

  execution_readiness_score: number | null;
  skill_alignment: number | null;
  resource_availability: number | null;
  execution_confidence: number | null;
  time_to_first_action_hours: number | null;
  ers_rationale: string | null;

  execution_brief: string | null;

  raw_problem_hint: string | null;
  cluster_id: string | null;

  status: OpportunityStatus;
  rejection_reason: string | null;

  revenue_target: number | null;
  revenue_actual: number;
  first_revenue_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface RevenueEvent {
  id: string;
  opportunity_id: string;
  amount: number;
  currency: string;
  platform: RevenuePlatform;
  platform_link: string | null;
  notes: string | null;
  recorded_at: string;
  created_at: string;
}

export interface ScoreResult {
  viability_score: number;
  revenue_potential: RevenuePotential;
  effort_estimate: EffortEstimate;
  competition_level: CompetitionLevel;
  time_sensitivity: TimeSensitivity;
  scoring_rationale: string;
  execution_readiness_score: number;
  skill_alignment: number;
  resource_availability: number;
  time_to_first_action_hours: number;
  ers_rationale: string;
}
