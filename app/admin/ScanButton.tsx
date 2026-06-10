"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ScanResultData {
  ran_at: string;
  sources: string[];
  posts_fetched: number;
  tier2_passes: number;
  new_clusters: number;
  ai_cost_usd: number;
}

export default function ScanButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runScan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cron/reddit", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Scan failed: HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult({
        ran_at: typeof data.ran_at === "string" ? data.ran_at : new Date().toISOString(),
        sources: Array.isArray(data.sources) ? data.sources : [],
        posts_fetched: Number(data.posts_fetched ?? 0),
        tier2_passes: Number(data.tier2_passes ?? 0),
        new_clusters: Number(data.new_clusters ?? 0),
        ai_cost_usd: Number(data.ai_cost_usd ?? 0),
      });
      // Refresh server components (scan history, validation gate) with the new data.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Run Scan</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scans Reddit + Hacker News. Takes 30–90 seconds.
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && (
            <span
              className="h-4 w-4 rounded-full border-2 border-background/40 border-t-background animate-spin"
              aria-hidden="true"
            />
          )}
          {loading ? "Scanning…" : "Run Scan"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {result && !error && (
        <div className="rounded-lg bg-muted/40 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Posts fetched", value: result.posts_fetched.toLocaleString() },
              { label: "New signals", value: result.tier2_passes.toLocaleString() },
              { label: "New clusters", value: result.new_clusters.toLocaleString() },
              { label: "AI cost", value: `$${result.ai_cost_usd.toFixed(4)}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {result.sources.length > 0 && <>Sources: {result.sources.join(", ")} · </>}
            Completed {new Date(result.ran_at).toLocaleString()}
          </p>
        </div>
      )}
    </section>
  );
}
