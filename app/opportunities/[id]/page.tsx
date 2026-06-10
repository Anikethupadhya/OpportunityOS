"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreDisplay } from "@/components/ScoreDisplay";
import { ERSDisplay } from "@/components/ERSDisplay";
import { RevenueLogForm } from "@/components/RevenueLogForm";
import { Badge } from "@/components/ui/badge";
import type { Opportunity, RevenueEvent, OpportunityStatus } from "@/lib/types";

const STATUS_TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  discovered: ["reviewed", "rejected"],
  reviewed: ["approved", "rejected"],
  approved: ["executing", "rejected"],
  executing: ["launched", "rejected"],
  launched: ["tracking", "archived"],
  tracking: ["archived"],
  rejected: ["archived"],
  archived: [],
};

const TRANSITION_LABELS: Record<OpportunityStatus, string> = {
  discovered: "Mark Reviewed",
  reviewed: "Approve",
  approved: "Start Executing",
  executing: "Mark Launched",
  launched: "Track",
  tracking: "Archive",
  rejected: "Archive",
  archived: "",
};

const CATEGORY_LABELS: Record<string, string> = {
  digital_product: "Digital Product",
  saas: "SaaS",
  content: "Content",
  service: "Service",
  affiliate: "Affiliate",
  physical: "Physical",
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [revenueEvents, setRevenueEvents] = useState<RevenueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scoring, setScoring] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [showRevenueForm, setShowRevenueForm] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadOpportunity = useCallback(async () => {
    const [oppRes, revRes] = await Promise.all([
      fetch(`/api/opportunities/${id}`),
      fetch(`/api/opportunities/${id}/revenue`),
    ]);

    if (!oppRes.ok) {
      setError("Opportunity not found");
      setLoading(false);
      return;
    }

    const [opp, rev] = await Promise.all([oppRes.json(), revRes.json()]);
    setOpportunity(opp);
    setRevenueEvents(Array.isArray(rev) ? rev : []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadOpportunity();
  }, [loadOpportunity]);

  async function handleScore() {
    setScoring(true);
    setActionError("");
    const res = await fetch(`/api/opportunities/${id}/score`, { method: "POST" });
    setScoring(false);
    if (!res.ok) {
      const body = await res.json();
      setActionError(body.error ?? "Scoring failed");
      return;
    }
    const updated = await res.json();
    setOpportunity(updated);
  }

  async function handleGenerateBrief() {
    setGeneratingBrief(true);
    setActionError("");
    const res = await fetch(`/api/opportunities/${id}/brief`, { method: "POST" });
    setGeneratingBrief(false);
    if (!res.ok) {
      const body = await res.json();
      setActionError(body.error ?? "Brief generation failed");
      return;
    }
    const updated = await res.json();
    setOpportunity(updated);
  }

  async function handleStatusChange(newStatus: OpportunityStatus) {
    setActionError("");
    const res = await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const body = await res.json();
      setActionError(body.error ?? "Status update failed");
      return;
    }
    const updated = await res.json();
    setOpportunity(updated);
  }

  async function handleDelete() {
    if (!confirm("Delete this opportunity? This cannot be undone.")) return;
    await fetch(`/api/opportunities/${id}`, { method: "DELETE" });
    router.push("/");
  }

  function handleRevenueSuccess() {
    setShowRevenueForm(false);
    loadOpportunity();
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-24" />
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <p className="text-destructive">{error || "Not found"}</p>
        <Link href="/" className="text-sm underline mt-2 block">← Back to Inbox</Link>
      </div>
    );
  }

  const nextStatuses = STATUS_TRANSITIONS[opportunity.status] ?? [];
  const primaryNext = nextStatuses[0];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Breadcrumb */}
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Inbox
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={opportunity.status} />
          <Badge variant="outline">{CATEGORY_LABELS[opportunity.category] ?? opportunity.category}</Badge>
          <Badge variant="slate" className="capitalize">{opportunity.source_type}</Badge>
          {opportunity.revenue_actual > 0 && (
            <Badge variant="green" className="font-semibold">
              ${opportunity.revenue_actual.toFixed(2)} earned
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-snug">{opportunity.title}</h1>
        <p className="text-muted-foreground">{opportunity.summary}</p>
        {opportunity.source_url && (
          <a
            href={opportunity.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline"
          >
            View source signal →
          </a>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Score section */}
      <section className="border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Viability Score</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={handleScore}
            disabled={scoring}
          >
            {scoring ? "Scoring…" : opportunity.viability_score ? "Re-score" : "Score with AI"}
          </Button>
        </div>
        <ScoreDisplay opportunity={opportunity} />
      </section>

      {/* ERS section */}
      <section className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Execution Readiness</h2>
        <ERSDisplay opportunity={opportunity} />
      </section>

      {/* Actions */}
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Actions</h2>

        {opportunity.viability_score !== null && (opportunity.status === "reviewed" || opportunity.status === "discovered") && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            {opportunity.execution_readiness_score !== null && opportunity.execution_readiness_score < 40 && (
              <p className="text-yellow-700 mb-1">⚠ ERS is low (&lt;40). Consider whether you have the skills and tools before approving.</p>
            )}
            {opportunity.viability_score >= 60
              ? "Strong signal. Consider approving and generating an execution brief."
              : opportunity.viability_score >= 40
              ? "Moderate signal. Review before approving."
              : "Weak signal. Likely not worth pursuing."}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {primaryNext && (
            <Button onClick={() => handleStatusChange(primaryNext)}>
              {primaryNext === "approved"
                ? "Approve Opportunity"
                : TRANSITION_LABELS[opportunity.status] || `Move to ${primaryNext}`}
            </Button>
          )}
          {nextStatuses[1] && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange(nextStatuses[1])}
              className="text-destructive hover:text-destructive"
            >
              {nextStatuses[1] === "rejected" ? "Reject" : nextStatuses[1]}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDelete} className="ml-auto text-muted-foreground">
            Delete
          </Button>
        </div>
      </section>

      {/* Execution Brief */}
      {(opportunity.status === "approved" ||
        opportunity.status === "executing" ||
        opportunity.status === "launched" ||
        opportunity.status === "tracking") && (
        <section className="border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Execution Brief</h2>
            {!opportunity.execution_brief && (
              <Button
                size="sm"
                onClick={handleGenerateBrief}
                disabled={generatingBrief}
              >
                {generatingBrief ? "Generating…" : "Generate Brief"}
              </Button>
            )}
            {opportunity.execution_brief && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateBrief}
                disabled={generatingBrief}
              >
                {generatingBrief ? "Regenerating…" : "Regenerate"}
              </Button>
            )}
          </div>

          {opportunity.execution_brief ? (
            <div className="bg-slate-50 rounded-lg p-4">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {opportunity.execution_brief}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click &quot;Generate Brief&quot; to get an AI-powered execution plan for this opportunity.
            </p>
          )}

          {opportunity.execution_brief && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(opportunity.execution_brief!)}
            >
              Copy Brief
            </Button>
          )}
        </section>
      )}

      {/* Revenue */}
      <section className="border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Revenue</h2>
            {opportunity.revenue_actual > 0 && (
              <p className="text-2xl font-bold text-green-600 mt-1">
                ${opportunity.revenue_actual.toFixed(2)}
              </p>
            )}
          </div>
          {!showRevenueForm && (
            <Button size="sm" variant="outline" onClick={() => setShowRevenueForm(true)}>
              + Log Revenue
            </Button>
          )}
        </div>

        {showRevenueForm && (
          <RevenueLogForm
            opportunityId={id}
            onSuccess={handleRevenueSuccess}
            onCancel={() => setShowRevenueForm(false)}
          />
        )}

        {revenueEvents.length > 0 ? (
          <div className="space-y-2">
            {revenueEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-3 py-2"
              >
                <div>
                  <span className="font-medium text-green-700">${ev.amount.toFixed(2)}</span>
                  <span className="text-muted-foreground ml-2 capitalize">{ev.platform.replace("_", " ")}</span>
                  {ev.notes && <span className="text-muted-foreground ml-2">— {ev.notes}</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(ev.recorded_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          !showRevenueForm && (
            <p className="text-sm text-muted-foreground">
              No revenue logged yet. When you make a sale, click &quot;+ Log Revenue&quot;.
            </p>
          )
        )}
      </section>

      {/* Raw Signal */}
      {opportunity.source_raw && (
        <section className="border rounded-xl p-5 space-y-2">
          <h2 className="font-semibold text-sm">Raw Signal</h2>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
            {opportunity.source_raw}
          </pre>
        </section>
      )}

      <p className="text-xs text-muted-foreground pb-4">
        Added {new Date(opportunity.created_at).toLocaleString()}
        {opportunity.updated_at !== opportunity.created_at && (
          <> · Updated {new Date(opportunity.updated_at).toLocaleString()}</>
        )}
      </p>
    </div>
  );
}
