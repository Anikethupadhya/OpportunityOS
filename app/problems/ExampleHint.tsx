"use client";

import { useState } from "react";

interface ExampleHintProps {
  hint: string;
}

const COLLAPSED_LENGTH = 100;

export default function ExampleHint({ hint }: ExampleHintProps) {
  const [expanded, setExpanded] = useState(false);

  const needsTruncation = hint.length > COLLAPSED_LENGTH;
  const display = expanded || !needsTruncation ? hint : `${hint.slice(0, COLLAPSED_LENGTH)}…`;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
        Example signal
      </p>
      <p className="text-sm text-foreground break-words">
        <span className="font-mono text-xs">{display}</span>
        {needsTruncation && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-2 text-xs font-medium text-blue-600 hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </p>
    </div>
  );
}
