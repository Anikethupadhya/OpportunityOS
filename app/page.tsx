import Link from "next/link";
import { createServiceClient } from "@/lib/db";
import { OpportunityCard } from "@/components/OpportunityCard";
import { ScanRedditButton } from "@/components/ScanRedditButton";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "discovered", label: "Discovered" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
  { value: "executing", label: "Executing" },
  { value: "launched", label: "Launched" },
  { value: "rejected", label: "Rejected" },
];

const SORT_OPTIONS = [
  { value: "score", label: "By Score" },
  { value: "revenue", label: "By Revenue" },
  { value: "date", label: "By Date" },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>;
}) {
  const { status, sort = "score" } = await searchParams;
  const db = createServiceClient();

  let query = db.from("opportunities").select("*");

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (sort === "revenue") {
    query = query.order("revenue_actual", { ascending: false });
  } else if (sort === "date") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query
      .order("viability_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  const { data: opportunitiesRaw } = await query;
  const opportunities = opportunitiesRaw ?? [];

  const currentStatus = status ?? "all";
  const currentSort = sort;

  function buildHref(newStatus?: string, newSort?: string) {
    const params = new URLSearchParams();
    if (newStatus && newStatus !== "all") params.set("status", newStatus);
    if (newSort && newSort !== "score") params.set("sort", newSort);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  const totalRevenue = opportunities.reduce((sum, o) => sum + (o.revenue_actual ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Opportunity Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {opportunities.length} opportunities
            {totalRevenue > 0 && (
              <span className="ml-2 text-green-600 font-medium">
                · ${totalRevenue.toFixed(2)} total revenue
              </span>
            )}
          </p>
        </div>
        <ScanRedditButton />
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground">Sort:</span>
        {SORT_OPTIONS.map((s) => (
          <Link
            key={s.value}
            href={buildHref(currentStatus, s.value)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              currentSort === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={buildHref(tab.value, currentSort)}
            className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
              currentStatus === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* List */}
      {opportunities.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg mb-4">No opportunities here yet.</p>
          <Link
            href="/opportunities/new"
            className="inline-flex items-center px-4 py-2 border border-input rounded-md text-sm hover:bg-accent transition-colors"
          >
            Add your first opportunity
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
