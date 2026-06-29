-- North Star Phase 5: evidence-grounded relationship signals and qualitative state.

create table if not exists public.lifeos_relationship_signals (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.lifeos_people(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  source_interaction_id uuid references public.lifeos_interactions(id) on delete set null,
  signal_family text not null check (signal_family in (
    'trust', 'closeness', 'support', 'momentum', 'strategic_relevance',
    'follow_through', 'sensitivity', 'conflict', 'gratitude'
  )),
  signal_direction text not null default 'neutral' check (signal_direction in ('positive', 'negative', 'neutral', 'mixed')),
  signal_strength text not null default 'moderate' check (signal_strength in ('strong', 'moderate', 'weak')),
  signal_summary text,
  confidence_level text not null default 'medium' check (confidence_level in ('high', 'medium', 'low', 'unavailable')),
  confirmation_status text not null default 'suggested' check (confirmation_status in ('confirmed', 'suggested', 'rejected', 'corrected')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.lifeos_relationship_state (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.lifeos_people(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  snapshot_type text not null default 'current' check (snapshot_type in ('current', 'historical', 'ai_suggested')),
  health_state text not null default 'unknown' check (health_state in (
    'stable', 'positive', 'quiet_but_ok', 'needs_attention', 'care_followup', 'repair_tension', 'unknown'
  )),
  momentum_state text not null default 'unknown' check (momentum_state in ('growing', 'steady', 'slowing', 'stalled', 'unknown')),
  dormancy_state text not null default 'active' check (dormancy_state in ('active', 'quiet', 'dormant', 'reactivation_candidate')),
  attention_overlay text check (attention_overlay in ('needs_attention', 'care_needed', 'commitment_pending', 'milestone_upcoming')),
  reason_codes text[] not null default '{}',
  confidence_level text not null default 'low' check (confidence_level in ('high', 'medium', 'low', 'unavailable')),
  confirmation_status text not null default 'suggested' check (confirmation_status in ('confirmed', 'suggested', 'rejected', 'corrected')),
  created_by text not null default 'ai' check (created_by in ('user', 'ai', 'system')),
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);

create index if not exists lifeos_relationship_signals_person_idx
  on public.lifeos_relationship_signals (person_id, created_at desc)
  where deleted_at is null and is_active;
create index if not exists lifeos_relationship_signals_owner_idx
  on public.lifeos_relationship_signals (owner_id, confirmation_status)
  where deleted_at is null;
create unique index if not exists lifeos_relationship_signals_source_unique_idx
  on public.lifeos_relationship_signals (person_id, source_interaction_id, signal_family, signal_direction, signal_summary)
  where source_interaction_id is not null and deleted_at is null;
create index if not exists lifeos_relationship_state_owner_idx
  on public.lifeos_relationship_state (owner_id, health_state, dormancy_state)
  where superseded_at is null;
create unique index if not exists lifeos_relationship_state_one_current_idx
  on public.lifeos_relationship_state (person_id)
  where snapshot_type = 'current' and superseded_at is null;

alter table public.lifeos_relationship_signals enable row level security;
alter table public.lifeos_relationship_state enable row level security;

drop policy if exists relationship_signals_owner on public.lifeos_relationship_signals;
create policy relationship_signals_owner on public.lifeos_relationship_signals
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists relationship_state_owner on public.lifeos_relationship_state;
create policy relationship_state_owner on public.lifeos_relationship_state
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

