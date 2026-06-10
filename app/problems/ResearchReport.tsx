"use client";

import { useState } from "react";

interface ResearchReportProps {
  notes: string;
}

export default function ResearchReport({ notes }: ResearchReportProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-medium text-blue-600 hover:underline"
      >
        {expanded ? "Hide Research Report" : "View Research Report"}
      </button>
      {expanded && (
        <pre className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words font-sans border border-border rounded-md p-3 bg-muted/30">
          {notes}
        </pre>
      )}
    </div>
  );
}
