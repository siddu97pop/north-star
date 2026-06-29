-- North Star Phase 6: structured, privacy-filtered briefing history.

create table if not exists public.lifeos_briefings (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.lifeos_people(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  briefing_type text not null default 'pre_conversation' check (briefing_type in ('pre_conversation', 'profile_review', 'weekly_review')),
  request_context text,
  briefing_summary text not null,
  model_name text not null,
  prompt_version text not null default 'north_star_briefing_v1',
  sensitive_content_included boolean not null default false,
  sensitive_content_unlock_required boolean not null default false,
  sensitive_items_suppressed integer not null default 0 check (sensitive_items_suppressed >= 0),
  generation_status text not null default 'complete' check (generation_status in ('complete', 'failed', 'superseded')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.lifeos_briefing_items (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.lifeos_briefings(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  item_type text not null check (item_type in (
    'context', 'last_interaction', 'pending_action', 'sensitive_context',
    'topics_to_remember', 'topics_to_avoid', 'milestones', 'recommendations',
    'relationship_state', 'suggested_opener', 'data_limitation'
  )),
  item_title text not null,
  item_text text not null,
  source_object_type text,
  source_object_id uuid,
  source_label text not null default 'Confirmed source',
  source_date timestamptz,
  confidence_level text not null default 'medium' check (confidence_level in ('high', 'medium', 'low', 'unavailable')),
  sensitivity_level text not null default 'none_low' check (sensitivity_level in ('none_low', 'personal', 'sensitive_lite', 'sensitive', 'restricted')),
  visibility_mode text not null default 'visible' check (visibility_mode in ('hidden', 'summary_only', 'full_if_unlocked', 'visible', 'never')),
  user_can_hide boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists lifeos_briefings_person_history_idx
  on public.lifeos_briefings (person_id, created_at desc)
  where deleted_at is null;
create index if not exists lifeos_briefings_owner_idx
  on public.lifeos_briefings (owner_id, created_at desc)
  where deleted_at is null;
create index if not exists lifeos_briefing_items_briefing_idx
  on public.lifeos_briefing_items (briefing_id, created_at);

alter table public.lifeos_briefings enable row level security;
alter table public.lifeos_briefing_items enable row level security;

drop policy if exists briefings_owner on public.lifeos_briefings;
create policy briefings_owner on public.lifeos_briefings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists briefing_items_owner on public.lifeos_briefing_items;
create policy briefing_items_owner on public.lifeos_briefing_items
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

