"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REJECTION_REASONS = [
  { value: "too_vague", label: "too_vague" },
  { value: "single_person_problem", label: "single_person_problem" },
  { value: "too_saturated", label: "too_saturated" },
  { value: "not_monetizable", label: "not_monetizable" },
  { value: "already_solved", label: "already_solved" },
  { value: "bad_signal", label: "bad_signal" },
];

interface ClusterStatusButtonsProps {
  clusterId: string;
  initialStatus: string | null;
  initialRejectionReason: string | null;
}

export default function ClusterStatusButtons({
  clusterId,
  initialStatus,
  initialRejectionReason,
}: ClusterStatusButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showNoDropdown, setShowNoDropdown] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>(
    initialRejectionReason ?? ""
  );

  async function patch(human_status: string, rejection_reason?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ human_status, rejection_reason }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  const activeStatus = initialStatus;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <button
          disabled={loading}
          onClick={() => {
            setShowNoDropdown(false);
            patch("would_build");
          }}
          className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 ${
            activeStatus === "would_build"
              ? "bg-green-600 text-white border-green-600"
              : "bg-background text-foreground border-border hover:bg-green-50 hover:border-green-400 hover:text-green-700"
          }`}
        >
          Would Build
        </button>

        <button
          disabled={loading}
          onClick={() => {
            setShowNoDropdown(false);
            patch("maybe");
          }}
          className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 ${
            activeStatus === "maybe"
              ? "bg-yellow-500 text-white border-yellow-500"
              : "bg-background text-foreground border-border hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
          }`}
        >
          Maybe
        </button>

        <button
          disabled={loading}
          onClick={() => {
            setShowNoDropdown(true);
          }}
          className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 ${
            activeStatus === "would_not_build"
              ? "bg-gray-500 text-white border-gray-500"
              : "bg-background text-foreground border-border hover:bg-gray-50 hover:border-gray-400 hover:text-gray-700"
          }`}
        >
          No
        </button>
      </div>

      {(showNoDropdown || activeStatus === "would_not_build") && (
        <div className="flex items-center gap-2 mt-2">
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
          >
            <option value="">Select reason…</option>
            {REJECTION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <button
            disabled={loading || !selectedReason}
            onClick={() => patch("would_not_build", selectedReason)}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>

          {showNoDropdown && (
            <button
              onClick={() => {
                setShowNoDropdown(false);
                setSelectedReason(initialRejectionReason ?? "");
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {activeStatus === "would_not_build" && initialRejectionReason && !showNoDropdown && (
        <p className="text-xs text-muted-foreground">
          Reason: <span className="font-medium">{initialRejectionReason}</span>
        </p>
      )}
    </div>
  );
}
