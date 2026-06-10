"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ScanRedditButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ discovered: number; skipped: number; rejected: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/cron/reddit", { method: "POST" });
      if (!res.ok) throw new Error(`Scan failed (${res.status})`);
      const data = await res.json();
      setResult({ discovered: data.discovered, skipped: data.skipped, rejected: data.rejected });
      router.refresh();
      setTimeout(() => setResult(null), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleScan}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Scanning..." : "Scan Reddit"}
      </button>
      {result && (
        <span className="text-xs text-muted-foreground">
          {result.discovered} new · {result.skipped} skipped · {result.rejected} rejected
        </span>
      )}
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
