import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import type { Opportunity } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  digital_product: "Digital Product",
  saas: "SaaS",
  content: "Content",
  service: "Service",
  affiliate: "Affiliate",
  physical: "Physical",
};

const SOURCE_LABELS: Record<string, string> = {
  reddit: "Reddit",
  twitter: "Twitter",
  hn: "HN",
  producthunt: "PH",
  google_trends: "Trends",
  manual: "Manual",
};

function ScorePill({ score, label }: { score: number | null; label: string }) {
  if (score === null) return null;
  const bg =
    score >= 70 ? "bg-green-100 text-green-700" :
    score >= 40 ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${bg}`} title={label}>
      {score}
    </span>
  );
}

export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const hasRevenue = opportunity.revenue_actual > 0;
  const days = Math.floor(
    (Date.now() - new Date(opportunity.created_at).getTime()) / 86400000
  );
  const age = days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;

  return (
    <Link href={`/opportunities/${opportunity.id}`} className="block group">
      <div className="border rounded-xl p-4 bg-card hover:shadow-md transition-shadow space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {opportunity.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <ScorePill score={opportunity.viability_score} label="Viability" />
            <ScorePill score={opportunity.execution_readiness_score} label="ERS" />
          </div>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">{opportunity.summary}</p>

        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={opportunity.status} />
          <Badge variant="outline" className="text-xs">
            {CATEGORY_LABELS[opportunity.category] ?? opportunity.category}
          </Badge>
          <Badge variant="slate" className="text-xs">
            {SOURCE_LABELS[opportunity.source_type] ?? opportunity.source_type}
          </Badge>
          {hasRevenue && (
            <Badge variant="green" className="text-xs font-semibold">
              ${opportunity.revenue_actual.toFixed(0)}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{age}</span>
        </div>
      </div>
    </Link>
  );
}
