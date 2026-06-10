import { Badge } from "@/components/ui/badge";
import type { Opportunity } from "@/lib/types";

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{value}</span>
    </div>
  );
}

const POTENTIAL_COLORS: Record<string, string> = {
  low: "slate",
  medium: "blue",
  high: "green",
  very_high: "purple",
};

const EFFORT_COLORS: Record<string, string> = {
  hours: "green",
  days: "blue",
  weeks: "yellow",
  months: "red",
};

const COMPETITION_COLORS: Record<string, string> = {
  none: "green",
  low: "blue",
  medium: "yellow",
  high: "red",
};

const SENSITIVITY_COLORS: Record<string, string> = {
  evergreen: "green",
  trending: "yellow",
  urgent: "red",
};

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

export function ScoreDisplay({ opportunity }: { opportunity: Opportunity }) {
  if (!opportunity.viability_score) {
    return (
      <p className="text-sm text-muted-foreground">Not yet scored.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Viability Score</p>
        <ScoreBar value={opportunity.viability_score} color={scoreBarColor(opportunity.viability_score)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {opportunity.revenue_potential && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Revenue Potential</p>
            <Badge variant={(POTENTIAL_COLORS[opportunity.revenue_potential] as "slate" | "blue" | "green" | "purple" | "yellow" | "red") ?? "slate"}>
              {opportunity.revenue_potential.replace("_", " ")}
            </Badge>
          </div>
        )}
        {opportunity.effort_estimate && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Effort</p>
            <Badge variant={(EFFORT_COLORS[opportunity.effort_estimate] as "slate" | "blue" | "green" | "purple" | "yellow" | "red") ?? "slate"}>
              {opportunity.effort_estimate}
            </Badge>
          </div>
        )}
        {opportunity.competition_level && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Competition</p>
            <Badge variant={(COMPETITION_COLORS[opportunity.competition_level] as "slate" | "blue" | "green" | "purple" | "yellow" | "red") ?? "slate"}>
              {opportunity.competition_level}
            </Badge>
          </div>
        )}
        {opportunity.time_sensitivity && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Timing</p>
            <Badge variant={(SENSITIVITY_COLORS[opportunity.time_sensitivity] as "slate" | "blue" | "green" | "purple" | "yellow" | "red") ?? "slate"}>
              {opportunity.time_sensitivity}
            </Badge>
          </div>
        )}
      </div>

      {opportunity.scoring_rationale && (
        <p className="text-sm text-muted-foreground bg-slate-50 rounded-md p-3">
          {opportunity.scoring_rationale}
        </p>
      )}
    </div>
  );
}
