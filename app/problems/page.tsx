import { createServiceClient } from "@/lib/db";
import ClusterStatusButtons from "./ClusterStatusButtons";
import ExampleHint from "./ExampleHint";
import OfferGate from "./OfferGate";

interface ProblemCluster {
  id: string;
  canonical_key: string | null;
  canonical_name: string;
  problem_category: string | null;
  specificity: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  human_status: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  rejection_reason: string | null;
  offer_status: string | null;
  offer_notes: string | null;
}

interface OpportunityRow {
  id: string;
  cluster_id: string;
  title: string;
  source_url: string | null;
  raw_problem_hint: string | null;
}

interface ClusterWithSignals extends ProblemCluster {
  signal_count: number;
  evidence: Array<{ title: string; source_url: string | null }>;
  example_hint: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Colored specificity badge: 1–2 = too broad, 3 = moderate, 4–5 = specific.
function specificityBadge(specificity: number | null): { label: string; cls: string } {
  if (specificity === null) {
    return { label: "Unknown", cls: "bg-gray-100 text-gray-700 border-gray-300" };
  }
  if (specificity <= 2) {
    return { label: "Too broad", cls: "bg-orange-100 text-orange-800 border-orange-300" };
  }
  if (specificity === 3) {
    return { label: "Moderate", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  }
  return { label: "Specific", cls: "bg-green-100 text-green-800 border-green-300" };
}

export default async function ProblemsPage() {
  const db = createServiceClient();

  // Step A: all clusters
  const { data: clusters, error: clustersError } = await db
    .from("problem_clusters")
    .select("*")
    .order("created_at", { ascending: false });

  if (clustersError) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-red-500">
        Failed to load clusters: {clustersError.message}
      </div>
    );
  }

  // Step B: linked opportunities
  const { data: opps, error: oppsError } = await db
    .from("opportunities")
    .select("id, cluster_id, title, source_url, raw_problem_hint")
    .not("cluster_id", "is", null)
    .neq("status", "rejected");

  if (oppsError) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-red-500">
        Failed to load opportunities: {oppsError.message}
      </div>
    );
  }

  // Step C: build maps in JS
  const countMap: Record<string, number> = {};
  const evidenceMap: Record<string, Array<{ title: string; source_url: string | null }>> = {};
  const hintMap: Record<string, string> = {};

  for (const opp of (opps ?? []) as OpportunityRow[]) {
    const cid = opp.cluster_id;
    countMap[cid] = (countMap[cid] ?? 0) + 1;
    if (!evidenceMap[cid]) evidenceMap[cid] = [];
    if (evidenceMap[cid].length < 5) {
      evidenceMap[cid].push({ title: opp.title, source_url: opp.source_url });
    }
    // Keep the first non-empty raw_problem_hint seen for this cluster.
    if (!hintMap[cid] && opp.raw_problem_hint) {
      hintMap[cid] = opp.raw_problem_hint;
    }
  }

  const enriched: ClusterWithSignals[] = ((clusters ?? []) as ProblemCluster[]).map((c) => ({
    ...c,
    signal_count: countMap[c.id] ?? 0,
    evidence: evidenceMap[c.id] ?? [],
    example_hint: hintMap[c.id] ?? null,
  }));

  // Sort: signal_count DESC, then last_seen_at DESC
  enriched.sort((a, b) => {
    if (b.signal_count !== a.signal_count) return b.signal_count - a.signal_count;
    const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Problem Clusters</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {enriched.length} clusters · review each before building
        </p>
      </div>

      <div className="space-y-4">
        {enriched.map((cluster) => (
          <div
            key={cluster.id}
            className="border border-border rounded-lg p-5 bg-card"
          >
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold text-foreground flex-1 min-w-0">
                {cluster.canonical_name}
              </h2>
              {(() => {
                const badge = specificityBadge(cluster.specificity);
                return (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold border whitespace-nowrap ${badge.cls}`}
                  >
                    Specificity {cluster.specificity ?? "—"}/5 · {badge.label}
                  </span>
                );
              })()}
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold bg-purple-100 text-purple-800 border border-purple-300 whitespace-nowrap">
                Signals: {cluster.signal_count}
              </span>
              {cluster.offer_status === "draft" && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 whitespace-nowrap">
                  Offer: Draft
                </span>
              )}
              {cluster.offer_status === "approved" && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold bg-green-100 text-green-800 border border-green-300 whitespace-nowrap">
                  Offer: Approved
                </span>
              )}
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              {cluster.problem_category && (
                <span className="capitalize">{cluster.problem_category}</span>
              )}
              <span>Last seen: {formatDate(cluster.last_seen_at)}</span>
            </div>

            {/* Evidence block */}
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Evidence
              </p>
              {cluster.evidence.length > 0 ? (
                <ul className="space-y-1">
                  {cluster.evidence.map((e, i) => (
                    <li key={i} className="text-sm">
                      {e.source_url ? (
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {e.title}
                        </a>
                      ) : (
                        <span className="text-foreground">{e.title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No linked signals yet</p>
              )}
            </div>

            {/* Example signal hint — collapsed by default, expand on click */}
            {cluster.example_hint && <ExampleHint hint={cluster.example_hint} />}

            {/* Status buttons */}
            <ClusterStatusButtons
              clusterId={cluster.id}
              initialStatus={cluster.human_status}
              initialRejectionReason={cluster.rejection_reason}
            />

            {/* Offer Gate — the bridge between "pain exists" and "someone pays" */}
            {cluster.human_status === "would_build" && (
              <OfferGate
                clusterId={cluster.id}
                initialOfferStatus={cluster.offer_status}
                initialOfferNotes={cluster.offer_notes}
              />
            )}
          </div>
        ))}

        {enriched.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            No problem clusters yet.
          </div>
        )}
      </div>
    </div>
  );
}
