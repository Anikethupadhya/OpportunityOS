import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">About OpportunityOS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          An AI-powered command center for discovering, scoring, and executing business opportunities.
        </p>
      </div>

      {/* What it is */}
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">What it does</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          OpportunityOS is a personal tool for solo operators and small teams. It captures signals from
          Reddit, Hacker News, Twitter, and other sources — things people are complaining about, asking
          for, or saying they&apos;d pay for — and uses AI to score whether each one is worth pursuing.
          From there, you can approve it, generate an execution brief, and track revenue as you execute.
        </p>
      </section>

      {/* Workflow */}
      <section className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">How it works</h2>
        <ol className="space-y-3">
          {[
            {
              step: "1. Discover",
              desc: 'Opportunities come in from Reddit scans (automated or manual via "Scan Reddit") or by adding them yourself. Each one starts as "Discovered".',
            },
            {
              step: "2. Score",
              desc: "Claude Haiku scores each opportunity across viability (market size, competition gap, revenue potential) and execution readiness (skill alignment, time to first action). Scores are 0–100.",
            },
            {
              step: "3. Review & Approve",
              desc: "You review the scores and rationale, then approve the ones worth pursuing. Weak signals get rejected.",
            },
            {
              step: "4. Execute",
              desc: "For approved opportunities, Claude Sonnet generates a step-by-step execution brief tailored to a solo operator. You move the status through Executing → Launched.",
            },
            {
              step: "5. Track Revenue",
              desc: "Log revenue events against each opportunity. The inbox shows total revenue so you can see what's actually working.",
            },
          ].map(({ step, desc }) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="font-medium text-foreground shrink-0 w-24">{step}</span>
              <span className="text-muted-foreground leading-relaxed">{desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* AI features */}
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">AI features</h2>
        <div className="space-y-3 text-sm">
          <div className="flex gap-3">
            <span className="font-medium shrink-0 w-40">Viability Scoring</span>
            <span className="text-muted-foreground">Claude Haiku — scores market size, competition gap, revenue potential, and time sensitivity.</span>
          </div>
          <div className="flex gap-3">
            <span className="font-medium shrink-0 w-40">Execution Readiness</span>
            <span className="text-muted-foreground">Claude Haiku — scores skill alignment, resource availability, and time to first concrete action.</span>
          </div>
          <div className="flex gap-3">
            <span className="font-medium shrink-0 w-40">Execution Brief</span>
            <span className="text-muted-foreground">Claude Sonnet — generates a detailed action plan for approved opportunities, written for a solo operator.</span>
          </div>
          <div className="flex gap-3">
            <span className="font-medium shrink-0 w-40">Reddit Scanner</span>
            <span className="text-muted-foreground">Scans r/entrepreneur, r/SideProject, r/startups, r/freelance, r/webdev, and r/NoCode for pain signals and demand phrases. Runs every 4 hours via Vercel cron, or on demand from the inbox.</span>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Tech stack</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Frontend", "Next.js 15 (App Router)"],
            ["Database", "Supabase (Postgres)"],
            ["AI", "Anthropic API (Claude Haiku + Sonnet)"],
            ["Styling", "Tailwind CSS + shadcn/ui"],
            ["Hosting", "Vercel"],
            ["Cron", "Vercel Cron Jobs"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-muted-foreground w-24 shrink-0">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="flex gap-3">
        <Link
          href="/"
          className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Go to Inbox
        </Link>
        <Link
          href="/opportunities/new"
          className="text-sm px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors"
        >
          Add Opportunity
        </Link>
      </div>
    </div>
  );
}
