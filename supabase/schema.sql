-- OpportunityOS Database Schema
-- Run this in your Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- OPPORTUNITIES
-- ============================================================
create table opportunities (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  summary text not null,

  -- Source
  source_type text not null check (source_type in ('reddit','twitter','hn','producthunt','google_trends','manual')),
  source_url text,
  source_raw text not null default '',
  discovered_at timestamptz not null default now(),

  -- Classification
  category text not null check (category in ('digital_product','saas','content','service','affiliate','physical')),
  tags text[] not null default '{}',

  -- Viability scoring (AI-generated)
  viability_score integer check (viability_score between 0 and 100),
  revenue_potential text check (revenue_potential in ('low','medium','high','very_high')),
  effort_estimate text check (effort_estimate in ('hours','days','weeks','months')),
  competition_level text check (competition_level in ('none','low','medium','high')),
  time_sensitivity text check (time_sensitivity in ('evergreen','trending','urgent')),
  scoring_rationale text,

  -- Execution Readiness Score (ERS)
  execution_readiness_score integer check (execution_readiness_score between 0 and 100),
  skill_alignment integer check (skill_alignment between 0 and 100),
  resource_availability integer check (resource_availability between 0 and 100),
  execution_confidence integer check (execution_confidence between 0 and 100),
  time_to_first_action_hours integer,
  ers_rationale text,

  -- Execution brief (AI-generated on approval)
  execution_brief text,

  -- Lifecycle
  status text not null default 'discovered' check (
    status in ('discovered','reviewed','approved','executing','launched','tracking','rejected','archived')
  ),
  rejection_reason text,

  -- Revenue (manually logged via revenue_events)
  revenue_target numeric(10,2),
  revenue_actual numeric(10,2) not null default 0,
  first_revenue_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger opportunities_updated_at
  before update on opportunities
  for each row execute function update_updated_at();

-- Indexes for common queries
create index idx_opportunities_status on opportunities(status);
create index idx_opportunities_category on opportunities(category);
create index idx_opportunities_viability on opportunities(viability_score desc nulls last);
create index idx_opportunities_created on opportunities(created_at desc);

-- ============================================================
-- REVENUE EVENTS
-- ============================================================
create table revenue_events (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'USD',
  platform text not null check (
    platform in ('gumroad','lemon_squeezy','stripe','paypal','direct','other')
  ),
  platform_link text,
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_revenue_events_opportunity on revenue_events(opportunity_id);
create index idx_revenue_events_recorded on revenue_events(recorded_at desc);

-- ============================================================
-- TRIGGER: keep revenue_actual in sync
-- ============================================================
create or replace function sync_revenue_actual()
returns trigger language plpgsql as $$
declare
  opp_id uuid;
  total numeric(10,2);
  first_rev timestamptz;
begin
  opp_id := coalesce(new.opportunity_id, old.opportunity_id);

  select coalesce(sum(amount), 0), min(recorded_at)
  into total, first_rev
  from revenue_events
  where opportunity_id = opp_id;

  update opportunities
  set
    revenue_actual = total,
    first_revenue_at = case when total > 0 then first_rev else null end
  where id = opp_id;

  return new;
end;
$$;

create trigger revenue_events_sync
  after insert or update or delete on revenue_events
  for each row execute function sync_revenue_actual();

-- ============================================================
-- Row Level Security (disabled for single-user Phase 1)
-- Enable once you add user accounts.
-- ============================================================
alter table opportunities disable row level security;
alter table revenue_events disable row level security;
