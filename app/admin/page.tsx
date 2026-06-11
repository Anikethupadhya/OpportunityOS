import { createServiceClient } from "@/lib/db";
import ScanButton from "./ScanButton";

interface ProblemCluster {
  id: string;
  canonical_name: string;
  canonical_key: string | null;
  problem_category: string | null;
  specificity: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  human_status: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  rejection_reason: string | null;
  research_status: string | null;
}

interface ScanRun {
  id: string;
  ran_at: string;
  sources: string[] | null;
  posts_fetched: number;
  tier2_passes: number;
  new_clusters: number;
  ai_cost_usd: number;
}

export default async function AdminPage() {
  const db = createServiceClient();

  const [
    { data: usageRows },
    { data: opps },
    { data: clusters },
    { data: clusterOpps },
    { data: scanRuns },
  ] = await Promise.all([
    db.from("ai_usage_log").select("cost_usd, model, opportunity_id, created_at"),
    db.from("opportunities").select("revenue_actual").gt("revenue_actual", 0),
    db.from("problem_clusters").select("*").order("created_at", { ascending: false }),
    db
      .from("opportunities")
      .select("id, cluster_id, source_type")
      .not("cluster_id", "is", null)
      .neq("status", "rejected"),
    db
      .from("scan_runs")
      .select("id, ran_at, sources, posts_fetched, tier2_passes, new_clusters, ai_cost_usd")
      .order("ran_at", { ascending: false })
      .limit(5),
  ]);

  // Build signal count map
  const signalCountMap: Record<string, number> = {};
  for (const opp of (clusterOpps ?? []) as Array<{ id: string; cluster_id: string }>) {
    signalCountMap[opp.cluster_id] = (signalCountMap[opp.cluster_id] ?? 0) + 1;
  }

  const clusterList = (clusters ?? []) as ProblemCluster[];
  const scanRunList = (scanRuns ?? []) as ScanRun[];

  // Block 1: review status summary
  const totalClusters = clusterList.length;
  const reviewedClusters = clusterList.filter((c) => c.human_status !== null);
  const reviewedCount = reviewedClusters.length;
  const unreviewedCount = totalClusters - reviewedCount;
  const wouldBuildCount = clusterList.filter((c) => c.human_status === "would_build").length;
  const maybeCount = clusterList.filter((c) => c.human_status === "maybe").length;
  const wouldNotBuildCount = clusterList.filter((c) => c.human_status === "would_not_build").length;
  const wouldBuildRate = reviewedCount > 0 ? (wouldBuildCount / reviewedCount) * 100 : null;

  // Research status summary for the Validation Gate block
  const researchComplete = clusterList.filter((c) => c.research_status === "complete").length;
  const researchFailed = clusterList.filter((c) => c.research_status === "failed").length;
  const researchNotRun = clusterList.filter((c) => c.research_status === null).length;

  // WBR by source: a reviewed cluster counts toward every source that contributed a
  // signal to it (mirrors COUNT(DISTINCT cluster) GROUP BY source_type). Tells us which
  // source produces build-worthy opportunities so future sessions add more like it.
  const clusterSources: Record<string, Set<string>> = {};
  for (const opp of (clusterOpps ?? []) as Array<{
    cluster_id: string;
    source_type: string | null;
  }>) {
    const src = opp.source_type ?? "unknown";
    (clusterSources[opp.cluster_id] ??= new Set()).add(src);
  }
  const sourceWbrMap: Record<string, { reviewed: number; wouldBuild: number }> = {};
  for (const c of reviewedClusters) {
    for (const src of clusterSources[c.id] ?? []) {
      const entry = (sourceWbrMap[src] ??= { reviewed: 0, wouldBuild: 0 });
      entry.reviewed++;
      if (c.human_status === "would_build") entry.wouldBuild++;
    }
  }
  const sourceWbr = Object.entries(sourceWbrMap)
    .map(([source, { reviewed, wouldBuild }]) => ({
      source,
      reviewed,
      wouldBuild,
      wbr: reviewed > 0 ? (wouldBuild / reviewed) * 100 : 0,
    }))
    .sort((a, b) => b.wbr - a.wbr);

  // Block 2: rejection reason breakdown
  const rejectedClusters = clusterList.filter((c) => c.human_status === "would_not_build");
  const rejectionMap: Record<string, { count: number; totalSignals: number }> = {};
  for (const c of rejectedClusters) {
    const reason = c.rejection_reason ?? "unknown";
    if (!rejectionMap[reason]) rejectionMap[reason] = { count: 0, totalSignals: 0 };
    rejectionMap[reason].count++;
    rejectionMap[reason].totalSignals += signalCountMap[c.id] ?? 0;
  }
  const rejectionBreakdown = Object.entries(rejectionMap)
    .map(([reason, { count, totalSignals }]) => ({
      reason,
      count,
      avgSignals: count > 0 ? totalSignals / count : 0,
      pct: rejectedClusters.length > 0 ? (count / rejectedClusters.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Block 3: recent cluster activity (last 10 by created_at)
  const recentClusters = clusterList.slice(0, 10).map((c) => ({
    ...c,
    signal_count: signalCountMap[c.id] ?? 0,
  }));

  const rows = usageRows ?? [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalSpend = rows.reduce((s, r) => s + Number(r.cost_usd), 0);
  const todaySpend = rows
    .filter((r) => new Date(r.created_at) >= todayStart)
    .reduce((s, r) => s + Number(r.cost_usd), 0);
  const monthSpend = rows
    .filter((r) => new Date(r.created_at) >= monthStart)
    .reduce((s, r) => s + Number(r.cost_usd), 0);

  const callsByModel = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.model] = (acc[r.model] ?? 0) + 1;
    return acc;
  }, {});

  const uniqueOpportunityIds = new Set(
    rows.filter((r) => r.opportunity_id).map((r) => r.opportunity_id)
  );
  const avgAiCostPerOpp =
    uniqueOpportunityIds.size > 0 ? totalSpend / uniqueOpportunityIds.size : null;

  const revenueList = opps ?? [];
  const avgRevenue =
    revenueList.length > 0
      ? revenueList.reduce((s, o) => s + Number(o.revenue_actual), 0) / revenueList.length
      : null;

  const profitPerOpp =
    avgRevenue !== null && avgAiCostPerOpp !== null
      ? avgRevenue - avgAiCostPerOpp
      : null;

  function fmt(n: number) {
    return `$${n.toFixed(4)}`;
  }

  // Validation gate: unlock angle generation at ≥30 reviewed clusters AND ≥50% WBR.
  const REVIEW_TARGET = 30;
  const WBR_TARGET = 50;
  const wbrValue = wouldBuildRate ?? 0;
  const wbrFillPct = Math.min(100, (wbrValue / WBR_TARGET) * 100);
  const reviewFillPct = Math.min(100, (reviewedCount / REVIEW_TARGET) * 100);
  const gateUnlocked = reviewedCount >= REVIEW_TARGET && wbrValue >= WBR_TARGET;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">AI spend and business validation metrics.</p>
      </div>

      {/* Validation Gate */}
      <section className="border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Validation Gate</h2>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${
              gateUnlocked
                ? "bg-green-100 text-green-800 border-green-300"
                : "bg-gray-100 text-gray-700 border-gray-300"
            }`}
          >
            {gateUnlocked
              ? "UNLOCKED — angle generation available"
              : `LOCKED — need ≥${REVIEW_TARGET} reviewed + ≥${WBR_TARGET}% WBR`}
          </span>
        </div>

        {/* Reviewed progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Clusters reviewed</span>
            <span className="font-medium">
              {reviewedCount} / {REVIEW_TARGET}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${reviewFillPct}%` }}
            />
          </div>
        </div>

        {/* Would Build Rate progress toward 50% target */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Would Build Rate (target {WBR_TARGET}%)</span>
            <span className="font-medium">
              {wouldBuildRate !== null ? `${wouldBuildRate.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                gateUnlocked ? "bg-green-500" : "bg-yellow-500"
              }`}
              style={{ width: `${wbrFillPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {wouldBuildCount} of {reviewedCount} reviewed marked Would Build
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Research: {researchComplete} ready · {researchFailed} failed · {researchNotRun} not run
        </p>

        {/* WBR by source */}
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">WBR by Source</h3>
          {sourceWbr.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviewed clusters yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left pb-2 font-medium">Source</th>
                  <th className="text-right pb-2 font-medium">Reviewed</th>
                  <th className="text-right pb-2 font-medium">Would Build</th>
                  <th className="text-right pb-2 font-medium">WBR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sourceWbr.map((s) => (
                  <tr key={s.source}>
                    <td className="py-2 font-mono text-xs">{s.source}</td>
                    <td className="py-2 text-right">{s.reviewed}</td>
                    <td className="py-2 text-right">{s.wouldBuild}</td>
                    <td className="py-2 text-right font-medium">{s.wbr.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Run Scan */}
      <ScanButton />

      {/* Scan History */}
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Scan History</h2>
        {scanRunList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scans recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left pb-2 font-medium">When</th>
                  <th className="text-left pb-2 font-medium">Sources</th>
                  <th className="text-right pb-2 font-medium">Fetched</th>
                  <th className="text-right pb-2 font-medium">Tier 2</th>
                  <th className="text-right pb-2 font-medium">Clusters</th>
                  <th className="text-right pb-2 font-medium">AI cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scanRunList.map((run) => (
                  <tr key={run.id}>
                    <td className="py-2 whitespace-nowrap">
                      {new Date(run.ran_at).toLocaleString()}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {(run.sources ?? []).join(", ") || "—"}
                    </td>
                    <td className="py-2 text-right">{run.posts_fetched}</td>
                    <td className="py-2 text-right">{run.tier2_passes}</td>
                    <td className="py-2 text-right">{run.new_clusters}</td>
                    <td className="py-2 text-right font-mono text-xs">
                      ${Number(run.ai_cost_usd).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Spend */}
      <section className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">AI Spend</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: fmt(totalSpend) },
            { label: "Today", value: fmt(todaySpend) },
            { label: "This month", value: fmt(monthSpend) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {rows.length} total API call{rows.length !== 1 ? "s" : ""}
        </p>
      </section>

      {/* Calls by model */}
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Calls by Model</h2>
        {Object.keys(callsByModel).length === 0 ? (
          <p className="text-sm text-muted-foreground">No calls logged yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(callsByModel).map(([model, count]) => (
              <div key={model} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-muted-foreground">{model}</span>
                <span className="font-medium">{count} call{count !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Business validation */}
      <section className="border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Business Validation</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The profit-per-opportunity number is what matters.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Avg AI cost per opportunity</span>
            <span className="font-medium">
              {avgAiCostPerOpp !== null ? fmt(avgAiCostPerOpp) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Avg revenue per opportunity
              {revenueList.length > 0 && (
                <span className="ml-1 text-xs">({revenueList.length} with revenue)</span>
              )}
            </span>
            <span className="font-medium">
              {avgRevenue !== null ? `$${avgRevenue.toFixed(2)}` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t pt-3 mt-1">
            <span className="font-semibold">
              Est. profit per opportunity
            </span>
            <span
              className={`text-lg font-bold ${
                profitPerOpp === null
                  ? "text-muted-foreground"
                  : profitPerOpp >= 0
                  ? "text-green-600"
                  : "text-destructive"
              }`}
            >
              {profitPerOpp !== null ? `$${profitPerOpp.toFixed(2)}` : "—"}
            </span>
          </div>
        </div>
        {profitPerOpp === null && (
          <p className="text-xs text-muted-foreground">
            Log revenue on at least one opportunity to see the profit metric.
          </p>
        )}
      </section>

      {/* ── Cluster Review ── */}
      <div>
        <h2 className="text-lg font-semibold">Cluster Review</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Validation sample target: 30–50 reviewed clusters.
        </p>
      </div>

      {/* Block 1 — Review Status Summary */}
      <section className="border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold">Review Status</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total clusters", value: totalClusters },
            { label: "Reviewed", value: reviewedCount },
            { label: "Unreviewed", value: unreviewedCount },
            { label: "Would Build", value: wouldBuildCount },
            { label: "Maybe", value: maybeCount },
            { label: "Would Not Build", value: wouldNotBuildCount },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Would Build Rate</span>
            <span className="font-medium">
              {wouldBuildRate !== null ? `${wouldBuildRate.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Progress to validation sample</span>
            <span className="font-medium">{reviewedCount} / 30 reviewed</span>
          </div>
        </div>
      </section>

      {/* Block 2 — Rejection Reason Breakdown */}
      <section className="border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold">Rejection Reason Breakdown</h3>
        {rejectionBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rejections yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left pb-2 font-medium">Reason</th>
                  <th className="text-right pb-2 font-medium">Count</th>
                  <th className="text-right pb-2 font-medium">Avg signals</th>
                  <th className="text-right pb-2 font-medium">% of rejections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rejectionBreakdown.map(({ reason, count, avgSignals, pct }) => (
                  <tr key={reason}>
                    <td className="py-2 font-mono text-xs">{reason}</td>
                    <td className="py-2 text-right font-medium">{count}</td>
                    <td className="py-2 text-right">{avgSignals.toFixed(1)}</td>
                    <td className="py-2 text-right text-muted-foreground">{pct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Block 3 — Recent Cluster Activity */}
      <section className="border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold">Recent Cluster Activity</h3>
        {recentClusters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clusters yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left pb-2 font-medium">Cluster</th>
                  <th className="text-right pb-2 font-medium">Signals</th>
                  <th className="text-right pb-2 font-medium">Status</th>
                  <th className="text-right pb-2 font-medium">Rejection reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentClusters.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 font-medium max-w-xs truncate">{c.canonical_name}</td>
                    <td className="py-2 text-right">{c.signal_count}</td>
                    <td className="py-2 text-right">
                      {c.human_status ? (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                            c.human_status === "would_build"
                              ? "bg-green-100 text-green-800"
                              : c.human_status === "maybe"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {c.human_status}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-muted-foreground font-mono text-xs">
                      {c.rejection_reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
