-- North Star Phase 4: governed AI recommendation cards.

create table if not exists public.lifeos_recommendations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  person_id uuid references public.lifeos_people(id) on delete cascade,
  related_interaction_id uuid references public.lifeos_interactions(id) on delete set null,
  related_action_item_id uuid references public.lifeos_action_items(id) on delete set null,
  recommendation_type text not null check (recommendation_type in (
    'follow_up', 'category_review', 'tier_review', 'care_checkin', 'reactivation',
    'milestone_reminder', 'briefing_note', 'repair', 'appreciation', 'maintenance'
  )),
  recommendation_title text not null,
  recommendation_text text not null,
  action_requested text not null,
  relationship_context text check (relationship_context in ('work', 'personal', 'other_strategic')),
  evidence_strength text not null check (evidence_strength in (
    'explicit', 'strong_inferred', 'weak_inferred', 'ambiguous', 'unavailable'
  )),
  confidence_level text not null check (confidence_level in ('high', 'medium', 'low', 'unavailable')),
  sensitivity_level text not null default 'none_low' check (sensitivity_level in (
    'none_low', 'personal', 'sensitive_lite', 'sensitive', 'restricted'
  )),
  contextual_integrity_status text not null default 'appropriate' check (contextual_integrity_status in (
    'appropriate', 'needs_confirmation', 'restricted', 'do_not_surface'
  )),
  agency_level text not null default 'suggest' check (agency_level in (
    'inform_only', 'suggest', 'ask_confirmation', 'user_action_required', 'prohibited_autonomous_action'
  )),
  user_controls_json jsonb not null default '["accept","edit","dismiss","snooze","disable_similar","explain"]'::jsonb,
  expiry_policy text not null default 'expires_on_date' check (expiry_policy in (
    'expires_on_date', 'after_view', 'after_decision', 'persistent_until_resolved'
  )),
  expires_at timestamptz,
  snoozed_until timestamptz,
  state text not null default 'active' check (state in (
    'active', 'accepted', 'edited', 'dismissed', 'snoozed', 'expired',
    'suppressed', 'converted', 'deleted'
  )),
  created_by_model text not null,
  prompt_version text not null default 'north_star_recommendations_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.lifeos_recommendation_evidence (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.lifeos_recommendations(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  evidence_object_type text not null check (evidence_object_type in (
    'interaction', 'extracted_field', 'signal', 'action_item', 'sensitive_memory', 'milestone', 'preference'
  )),
  evidence_object_id uuid not null,
  evidence_summary text not null,
  evidence_strength text not null check (evidence_strength in (
    'explicit', 'strong_inferred', 'weak_inferred', 'ambiguous', 'unavailable'
  )),
  sensitivity_level text not null default 'none_low' check (sensitivity_level in (
    'none_low', 'personal', 'sensitive_lite', 'sensitive', 'restricted'
  )),
  can_show_to_user boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lifeos_recommendation_decisions (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.lifeos_recommendations(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  decision_type text not null check (decision_type in (
    'accepted', 'edited', 'dismissed', 'snoozed', 'rejected',
    'marked_sensitive', 'disabled_similar'
  )),
  decision_payload jsonb,
  created_result_object_type text,
  created_result_object_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.lifeos_recommendation_suppressions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  person_id uuid references public.lifeos_people(id) on delete cascade,
  recommendation_type text,
  suppression_scope text not null default 'person_type' check (suppression_scope in (
    'person_type', 'person', 'recommendation_type', 'workflow', 'global'
  )),
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lifeos_recommendations_owner_state_idx
  on public.lifeos_recommendations (owner_id, state, created_at desc)
  where deleted_at is null;
create index if not exists lifeos_recommendations_person_idx
  on public.lifeos_recommendations (person_id, recommendation_type)
  where deleted_at is null;
create index if not exists lifeos_recommendation_evidence_recommendation_idx
  on public.lifeos_recommendation_evidence (recommendation_id);
create index if not exists lifeos_recommendation_decisions_recommendation_idx
  on public.lifeos_recommendation_decisions (recommendation_id, created_at desc);
create unique index if not exists lifeos_recommendation_suppressions_active_idx
  on public.lifeos_recommendation_suppressions (
    owner_id,
    coalesce(person_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(recommendation_type, ''),
    suppression_scope
  ) where is_active;

alter table public.lifeos_recommendations enable row level security;
alter table public.lifeos_recommendation_evidence enable row level security;
alter table public.lifeos_recommendation_decisions enable row level security;
alter table public.lifeos_recommendation_suppressions enable row level security;

drop policy if exists recommendations_owner on public.lifeos_recommendations;
create policy recommendations_owner on public.lifeos_recommendations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists recommendation_evidence_owner on public.lifeos_recommendation_evidence;
create policy recommendation_evidence_owner on public.lifeos_recommendation_evidence
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists recommendation_decisions_owner on public.lifeos_recommendation_decisions;
create policy recommendation_decisions_owner on public.lifeos_recommendation_decisions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists recommendation_suppressions_owner on public.lifeos_recommendation_suppressions;
create policy recommendation_suppressions_owner on public.lifeos_recommendation_suppressions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
