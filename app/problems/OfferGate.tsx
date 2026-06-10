"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const OFFER_QUESTIONS = [
  {
    label: "Who exactly is the buyer?",
    hint: "Job title, context, what they're trying to accomplish",
  },
  {
    label: "What one painful job does this solve?",
    hint: "One sentence, specific",
  },
  {
    label: "What format fits best?",
    hint: "Spreadsheet / SOP / template pack / prompt pack / tracker",
  },
  {
    label: "Why would someone pay vs. using ChatGPT?",
    hint: "Specific answer required",
  },
  {
    label: "Why might this offer fail?",
    hint: "Honest and specific",
  },
];

// offer_notes format: "label: answer" per question, newline-separated.
// Answers may themselves contain newlines, so parse by scanning for label prefixes.
function parseOfferNotes(notes: string | null): string[] {
  const answers = OFFER_QUESTIONS.map(() => "");
  if (!notes) return answers;

  let current = -1;
  for (const line of notes.split("\n")) {
    const idx = OFFER_QUESTIONS.findIndex((q) => line.startsWith(`${q.label}: `));
    if (idx >= 0) {
      current = idx;
      answers[idx] = line.slice(OFFER_QUESTIONS[idx].label.length + 2);
    } else if (current >= 0) {
      answers[current] += `\n${line}`;
    }
  }
  return answers.map((a) => a.trim());
}

function buildOfferNotes(answers: string[]): string {
  return OFFER_QUESTIONS.map((q, i) => `${q.label}: ${answers[i].trim()}`).join("\n");
}

// Research reports end with a ---OFFER_SUGGESTIONS--- block of KEY: value lines,
// in the same order as OFFER_QUESTIONS. Values may be wrapped in [brackets].
const OFFER_SUGGESTION_KEYS = ["BUYER", "JOB", "FORMAT", "WHY_PAY", "WHY_FAIL"];

function parseOfferSuggestions(research: string | null): string[] | null {
  if (!research) return null;
  const idx = research.indexOf("---OFFER_SUGGESTIONS---");
  if (idx === -1) return null;
  const block = research.slice(idx);
  return OFFER_SUGGESTION_KEYS.map((key) => {
    const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m ? m[1].trim().replace(/^\[/, "").replace(/\]$/, "").trim() : "";
  });
}

interface OfferGateProps {
  clusterId: string;
  initialOfferStatus: string | null;
  initialOfferNotes: string | null;
  researchNotes?: string | null;
  researchStatus?: string | null;
}

export default function OfferGate({
  clusterId,
  initialOfferStatus,
  initialOfferNotes,
  researchNotes = null,
  researchStatus = null,
}: OfferGateProps) {
  const router = useRouter();
  const suggestions = useMemo(() => parseOfferSuggestions(researchNotes), [researchNotes]);
  // Saved answers always win; research suggestions only fill fields that are empty.
  const [answers, setAnswers] = useState<string[]>(() => {
    const saved = parseOfferNotes(initialOfferNotes);
    if (!suggestions) return saved;
    return saved.map((a, i) => (a.trim() === "" ? suggestions[i] : a));
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allFilled = answers.every((a) => a.trim() !== "");

  async function save(offer_status: "draft" | "approved") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/offer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_status, offer_notes: buildOfferNotes(answers) }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Save failed (${res.status})`);
      }
    } catch {
      setError("Save failed — network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 border border-border rounded-lg p-4 bg-muted/30">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Offer Gate
      </p>

      {researchStatus === "complete" && suggestions ? (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5 mb-3">
          Pre-filled from research — review and edit before approving.
        </p>
      ) : researchStatus === null || researchStatus === "failed" ? (
        <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md px-2.5 py-1.5 mb-3">
          Run research on this cluster to get AI-suggested answers.
        </p>
      ) : null}

      <div className="space-y-3">
        {OFFER_QUESTIONS.map((q, i) => (
          <div key={q.label}>
            <label className="block text-sm font-medium text-foreground mb-1">
              {q.label}
            </label>
            <textarea
              value={answers[i]}
              onChange={(e) =>
                setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
              }
              placeholder={q.hint}
              rows={2}
              className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 bg-background text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          disabled={loading || !allFilled}
          onClick={() => save("draft")}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-yellow-400 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Draft
        </button>

        {initialOfferStatus === "draft" && (
          <button
            disabled={loading || !allFilled}
            onClick={() => save("approved")}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-green-600 bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Approve Offer
          </button>
        )}

        {!allFilled && (
          <span className="text-xs text-muted-foreground">
            All 5 answers required before saving
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
}
