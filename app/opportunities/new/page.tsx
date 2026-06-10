"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  { value: "digital_product", label: "Digital Product (template, ebook, prompt pack…)" },
  { value: "saas", label: "Micro-SaaS (web tool, chrome extension…)" },
  { value: "content", label: "Content / Newsletter" },
  { value: "service", label: "Productized Service" },
  { value: "affiliate", label: "Affiliate / Lead Gen" },
  { value: "physical", label: "Physical Product" },
];

const SOURCE_TYPES = [
  { value: "manual", label: "Manual (my own observation)" },
  { value: "reddit", label: "Reddit" },
  { value: "twitter", label: "Twitter / X" },
  { value: "hn", label: "Hacker News" },
  { value: "producthunt", label: "Product Hunt" },
  { value: "google_trends", label: "Google Trends" },
];

export default function NewOpportunityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceRaw, setSourceRaw] = useState("");
  const [category, setCategory] = useState("digital_product");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      setError("Title and summary are required.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        summary: summary.trim(),
        source_type: sourceType,
        source_url: sourceUrl.trim() || null,
        source_raw: sourceRaw.trim() || summary.trim(),
        category,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to create opportunity");
      return;
    }

    const created = await res.json();
    router.push(`/opportunities/${created.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Inbox
        </Link>
        <h1 className="text-2xl font-bold mt-2">Add Opportunity</h1>
        <p className="text-sm text-muted-foreground">
          Paste a signal you found. AI will score it after you save.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            placeholder="People on r/entrepreneur desperately need a client onboarding template"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
          <p className="text-xs text-muted-foreground">Be specific. The more concrete, the better the scoring.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="summary">Summary *</Label>
          <Textarea
            id="summary"
            placeholder="Describe the signal: who has this problem, why they need it, where you found the signal."
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="source_url">Source URL (optional)</Label>
          <Input
            id="source_url"
            type="url"
            placeholder="https://reddit.com/r/..."
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="source_raw">Raw Signal (optional)</Label>
          <Textarea
            id="source_raw"
            placeholder="Paste the full Reddit post, tweet, or HN comment here. The more context, the better the AI scoring."
            rows={5}
            value={sourceRaw}
            onChange={(e) => setSourceRaw(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Saving…" : "Save & Score with AI →"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
