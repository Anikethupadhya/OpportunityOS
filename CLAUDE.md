# OpportunityOS

## Mission
Revenue = $0. Every decision answers one question:
does this create revenue, validate a path to revenue, or is it neither?
Cheapest working solution always wins. No feature ships without a revenue-critical or validation reason.

---

## Target Pipeline (North Star — what we are building toward)

```
[Discovery Sources]
Reddit · Etsy · Gumroad · Google Trends
scan continuously, multiple sources in parallel
         ↓
[Signal Filtering]
Tier 1 keyword filter → DB dedup → Tier 2 high-intent filter
raw_problem_hint built on Tier 2 pass
         ↓
[AI Clustering]
Sonnet groups signals into named problem clusters
canonical_key dedup via slugify → find-or-create upsert
         ↓
[Human Gate]
Web UI (/problems) today → Slack/Telegram notifications later
Would Build · Maybe · No + mandatory rejection reason
         ↓
[Angle Generation]  ← LOCKED until Would Build Rate ≥ 50%
3 product angles per approved cluster (format + price + rationale)
Human picks one
         ↓
[Product Generation]  ← NOT BUILT
Claude writes the actual product content
         ↓
[Publishing]  ← NOT BUILT
Gumroad · Etsy · Lemon Squeezy · Shopify
publish automatically to all active channels
         ↓
[Revenue Tracking]
Sale logged → revenue_events table → /admin metrics update
         ↓
[Learning Loop]
Rejection reasons improve filters and clustering prompt
Successful products inform future cluster scoring
```

---

## What Is Built Today

```
✅ Reddit RSS scanning (6 subreddits, Day 5 → 10)
✅ Hacker News scanning (Algolia API, ask_hn, same Tier 1/2 filters)
✅ Tier 1/2 filtering + DB dedup
✅ AI clustering via Sonnet (BRIEF_MODEL)
✅ Human review UI (/problems page)
✅ Would Build / Maybe / No status buttons
✅ Mandatory rejection reasons (enforced front + back)
✅ Rejection feedback loop (rejection_reason column)
✅ Offer Gate on /problems (would_build clusters → 5-question offer form → draft/approved)
✅ Cluster research via web search (Sonnet web_search tool → report + offer pre-fill; hourly cron gated behind RESEARCH_AUTO_ENABLED=true)
✅ Analytics dashboard (/admin) — spend, cluster review, rejection breakdown
✅ AI usage logging (ai_usage_log table)
✅ Revenue tracking (manual, revenue_events table)
🔒 Angle generation — locked until Would Build Rate ≥ 50%
❌ Etsy signal source
❌ Gumroad signal source
❌ Google Trends signal source
❌ Product content generation
❌ Automated publishing (Gumroad, Etsy, Lemon Squeezy, Shopify)
❌ Slack/Telegram command center
```

---

## Current Numbers (update after each session)

| Metric | Value |
|--------|-------|
| Signal sources | Reddit + Hacker News |
| Subreddits active | 10 |
| Clusters in DB | 6 |
| Reviewed | 6 / 6 |
| Would Build Rate | 0% |
| Validation target | 30 reviewed clusters |
| Revenue | $0 |

---

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Components:** Radix UI primitives, Lucide React icons
- **Database:** Supabase (PostgreSQL) — service client only, no RLS
- **AI:** Anthropic SDK ^0.39.0
  - Scoring: `claude-haiku-4-5-20251001` (SCORING_MODEL)
  - Clustering + Briefs: `claude-sonnet-4-6` (BRIEF_MODEL)
- **Hosting:** Vercel
- **Dev server:** `npm run dev` (uses `NODE_OPTIONS=--use-system-ca`)

---

## Key Files

```
lib/reddit.ts               SUBREDDITS array, Tier 1/2 filters, scanReddit()
lib/clustering.ts           runClusteringPass(), batch Sonnet calls, fence-stripping
lib/claude.ts               SCORING_MODEL, BRIEF_MODEL constants
lib/prompts/clustering.ts   CLUSTERING_SYSTEM_PROMPT
lib/prompts/scoring.ts      scoreOpportunity() via Haiku tool-use
lib/prompts/brief.ts        brief generation prompt
lib/types.ts                Opportunity interface (includes raw_problem_hint, cluster_id)
lib/ai-usage.ts             logAiUsage() — always call after every Anthropic API call
lib/db.ts                   createServiceClient()

app/layout.tsx              Nav: Inbox · About · Problems · Admin · + Add
app/page.tsx                Inbox — opportunity list with sort/filter tabs
app/problems/page.tsx       Cluster review — server component
app/problems/ClusterStatusButtons.tsx  Client component — status buttons + rejection dropdown
app/admin/page.tsx          Admin — AI spend + cluster review analytics

app/api/cron/reddit/route.ts          GET + POST → scanReddit()
app/api/clusters/[id]/status/route.ts PATCH → update human_status + rejection_reason
```

---

## Schema

### opportunities (key columns)
```
id uuid PK
title, summary, source_type, source_url, source_raw
status: discovered | reviewed | approved | executing | launched | tracking | rejected | archived
category: digital_product | saas | content | service | affiliate | physical
raw_problem_hint text          — "{title} | {matched_phrase} | {subreddit} | {body_excerpt}"
cluster_id uuid FK → problem_clusters(id) ON DELETE SET NULL
viability_score, execution_readiness_score (Haiku scoring)
revenue_actual, revenue_target, first_revenue_at
rejection_reason text
```

### problem_clusters
```
id uuid PK
canonical_name text NOT NULL   — human-readable cluster label
canonical_key text UNIQUE      — slugified canonical_name, used for upsert dedup
problem_category text          — template | calculator | guide | script_pack | tracker | checklist | other
specificity integer 1–5        — how actionable (5 = very specific, 1 = very broad)
first_seen_at, last_seen_at timestamptz
human_status text              — would_build | would_not_build | maybe | NULL
reviewed_at timestamptz
rejection_reason text          — too_vague | single_person_problem | too_saturated |
                                  not_monetizable | already_solved | bad_signal
offer_status text              — NULL | draft | approved (CHECK constraint) — build gate
offer_notes text               — 5 offer answers, "label: answer" newline-separated
research_status text           — NULL | pending | complete | failed (CHECK constraint)
research_notes text            — web-search research report + ---OFFER_SUGGESTIONS--- block
research_at timestamptz
created_at timestamptz
```

### ai_usage_log
```
model, call_type, input_tokens, output_tokens, cost_usd
opportunity_id uuid (nullable FK)
created_at
```

### revenue_events
```
id, opportunity_id FK, amount, currency
platform: gumroad | lemon_squeezy | stripe | paypal | direct | other
platform_link, notes, recorded_at, created_at
```

---

## Decision Framework

Before building anything, classify:
1. **Revenue-critical** — directly builds or unblocks discover→approve→build→sell loop
2. **Validation-supporting** — proves the loop works, generates learning data
3. **Nice-to-have** — improves experience but doesn't move the revenue needle
4. **Premature optimization** — do not build

Only build 1 and 2. Challenge everything as 3 before starting.
If you're unsure, ask: "What breaks if we don't build this?" If the answer is "nothing revenue-critical," don't build it.

---

## Hard Rules

1. **No AI pre-filtering layer** between Tier 2 and clustering — human rejection IS the ground truth
2. **No minimum signal threshold** until 30+ clusters have been reviewed — n=6 is too small to set rules
3. **Angle generation stays locked** until Would Build Rate ≥ 50% across ≥ 30 reviewed clusters
4. **No product_angles schema** until angle generation is unlocked
5. **Split over merge on clusters** — over-splitting is safe; over-merging destroys demand confidence
6. **Never auto-merge clusters** on canonical_key collision (error code 23505) — skip the signal, log, continue
7. **No Redis, queues, embeddings, vector DBs, or paid services**
8. **TypeScript errors block everything** — fix before any other work
9. **Never remove the fence-stripping regex** in clustering.ts — Sonnet wraps JSON in markdown fences and this regex is the fix
10. **Always call logAiUsage()** after every Anthropic API call — cost tracking is non-negotiable
11. **Rejected posts must be stored in DB** with status=rejected — this prevents re-scanning them on every run

---

## Decision Gates

### Cluster validation gate
```
Would Build Rate = would_build_count / total_reviewed

≥ 50%  → Discovery validated. Unlock angle generation.
25–49% → Mixed quality. Improve clustering prompt, review more data. Do not build angles yet.
< 25%  → Discovery/clustering quality insufficient.
          Fix: source quality, Tier 2 filters, clustering prompt.
          Do not build angle generation.

Minimum sample: 30 reviewed clusters before acting on any rate.
```

### Publishing gate (future)
```
First product created → manual Gumroad publish → track first sale
Only automate publishing after first manual sale proves the product format works
```

---

## Known Failure Modes + Fixes

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `clustering_failed > 0` | Sonnet wrapped JSON in markdown fences | Check `rawSonnetText` logged in console. Fence-stripping regex already handles standard fences — if still failing, Sonnet returned prose before JSON |
| `scan discovered = 0` | Corpus saturated — all candidates already in DB | Add more subreddits, or inspect what Tier 2 is rejecting |
| DB error code `23505` on cluster insert | Unique constraint on `canonical_key` — race condition or duplicate slug | Skip the signal, log the key, continue. Do NOT merge clusters |
| TypeScript errors after editing | Import/type mismatch | Run `npx tsc --noEmit` and fix all errors before doing anything else |
| Scan returns candidates but 0 inserted | All candidates failing DB dedup | All those URLs are already in DB (any status). This is correct behavior |
| `/problems` shows no evidence | Opportunities query filtering wrong status | Check that `status != 'rejected'` filter isn't excluding real signals |

---

## Scanning Mechanics (reference)

```
Per subreddit:
  Fetch /new?limit=100 + /top?t=day&limit=100 in parallel
  Dedup merged feed by permalink in memory
  Cap at MAX_PER_SUBREDDIT = 200
  Overall cap: MAX_TOTAL = 1200 across all subreddits

Tier 1 → 25 candidate keywords (broad intent)
Tier 2 → 13 high-intent phrases (product/tool shaped pain)
  Match returns the exact phrase for raw_problem_hint

raw_problem_hint format:
  "{post title} | {matched Tier 2 phrase} | {subreddit} | {first 200 chars of body}"

Rejected at Tier 2 → stored as status=rejected, rejection_reason=failed_tier2_filter
Passed Tier 2 → scored by Haiku → status=reviewed → runClusteringPass() at end
```

---

## Clustering Mechanics (reference)

```
Fetches: raw_problem_hint NOT NULL, cluster_id IS NULL, status != rejected, LIMIT 100
Batches: 25 signals per Sonnet call
Response: JSON { results: [{ id, canonical_name, problem_category, specificity }] }
Fence-stripping: text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
Parse failure: logs rawSonnetText.slice(0, 1000), marks batch as failed, continues

Upsert pattern:
  canonical_key = slugify(canonical_name)
  SELECT by canonical_key → if exists: update last_seen_at, reuse id
                           → if new: INSERT cluster row
  UPDATE opportunities SET cluster_id = <id>
```

---

## Publishing Targets (when built)

| Platform | Model | Priority |
|----------|-------|----------|
| Gumroad | Digital product — upload once, sell forever | First (easiest setup) |
| Etsy | Digital downloads marketplace — built-in buyer traffic | Second |
| Lemon Squeezy | Subscriptions + software products | Third |
| Shopify | Scale only — after products are validated | Later |
| Fiverr | **Services only** (custom work per order — breaks automation model) | Separate track |

---

## What Good Looks Like

A **good cluster**: specificity ≥ 3, ≥ 2 signals from different posts, problem is specific enough to build one product against it, no obvious well-known solution already exists.

A **good signal source**: surfaces people who pay for tools (practitioners, business operators), not people who dream about tools (general productivity/startup subreddits).

A **good rejection**: has a specific reason that informs what to fix next. "too_saturated" means the source has low signal quality. "already_solved" means the Tier 2 filter is passing problems that have obvious solutions. "single_person_problem" means we need more signals before clustering.

A **revenue event**: a real human paid real money for a product we discovered, built, and published. Everything before this is setup.
