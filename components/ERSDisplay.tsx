import type { Opportunity } from "@/lib/types";

function SubScore({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const color = value >= 70 ? "bg-green-400" : value >= 40 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ERSDisplay({ opportunity }: { opportunity: Opportunity }) {
  if (!opportunity.execution_readiness_score) {
    return <p className="text-sm text-muted-foreground">Not yet scored.</p>;
  }

  const ers = opportunity.execution_readiness_score;
  const ringColor =
    ers >= 70 ? "text-green-600" : ers >= 40 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={`text-4xl font-bold tabular-nums ${ringColor}`}>{ers}</div>
        <div>
          <p className="font-medium text-sm">Execution Readiness</p>
          {opportunity.time_to_first_action_hours !== null && (
            <p className="text-xs text-muted-foreground">
              First action in ~{opportunity.time_to_first_action_hours}h
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <SubScore label="Skill Alignment" value={opportunity.skill_alignment} />
        <SubScore label="Resource Availability" value={opportunity.resource_availability} />
        {opportunity.execution_confidence !== null && (
          <SubScore label="Your Confidence" value={opportunity.execution_confidence} />
        )}
      </div>

      {opportunity.ers_rationale && (
        <p className="text-sm text-muted-foreground bg-slate-50 rounded-md p-3">
          {opportunity.ers_rationale}
        </p>
      )}
    </div>
  );
}
