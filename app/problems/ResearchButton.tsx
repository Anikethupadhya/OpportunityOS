"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ResearchButtonProps {
  clusterId: string;
}

export default function ResearchButton({ clusterId }: ResearchButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function runResearch() {
    setLoading(true);
    try {
      await fetch(`/api/clusters/${clusterId}/research`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      disabled={loading}
      onClick={runResearch}
      className="px-3 py-1.5 text-sm font-medium rounded-md border border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Researching…" : "Research Now"}
    </button>
  );
}
