-- North Star Phase 3: action items, adaptive reminders, and milestones.

create table if not exists public.lifeos_action_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  person_id uuid references public.lifeos_people(id) on delete cascade,
  source_interaction_id uuid references public.lifeos_interactions(id) on delete set null,
  source_extraction_id uuid references public.lifeos_interaction_extractions(id) on delete set null,
  action_type text not null check (action_type in (
    'explicit_promise', 'received_commitment', 'scheduled_next_step',
    'professional_deliverable', 'emotional_checkin', 'milestone_followup',
    'relationship_maintenance', 'repair_followup', 'appreciation_gratitude',
    'introduction_obligation', 'learning_continuation', 'no_action_memory'
  )),
  title text not null,
  description text,
  commitment_certainty text check (commitment_certainty in (
    'c5_explicit', 'c4_agreed', 'c3_implied', 'c2_weak', 'c1_low'
  )),
  owner_type text not null default 'user' check (owner_type in ('user', 'other_person', 'shared')),
  due_at timestamptz,
  sensitivity_level text not null default 'none_low' check (sensitivity_level in (
    'none_low', 'personal', 'sensitive_lite', 'sensitive', 'restricted'
  )),
  confirmation_status text not null default 'suggested' check (confirmation_status in (
    'suggested', 'confirmed', 'rejected', 'corrected'
  )),
  status text not null default 'suggested' check (status in (
    'suggested', 'accepted', 'active', 'snoozed', 'deferred',
    'blocked', 'completed', 'dismissed', 'no_longer_relevant'
  )),
  created_by text not null default 'ai' check (created_by in ('user', 'ai', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.lifeos_milestones (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.lifeos_people(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  source_interaction_id uuid references public.lifeos_interactions(id) on delete set null,
  source_extraction_id uuid references public.lifeos_interaction_extractions(id) on delete set null,
  milestone_type text not null,
  milestone_title text not null,
  milestone_date date,
  recurrence_rule text,
  sensitivity_level text not null default 'none_low' check (sensitivity_level in (
    'none_low', 'personal', 'sensitive_lite', 'sensitive', 'restricted'
  )),
  confirmation_status text not null default 'confirmed' check (confirmation_status in (
    'suggested', 'confirmed', 'rejected', 'corrected'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.lifeos_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  person_id uuid references public.lifeos_people(id) on delete cascade,
  action_item_id uuid references public.lifeos_action_items(id) on delete cascade,
  milestone_id uuid references public.lifeos_milestones(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('action', 'milestone', 'care_checkin', 'briefing', 'review')),
  reminder_title text not null,
  reminder_body_safe text,
  scheduled_for timestamptz,
  cadence_rule text,
  state text not null default 'suggested' check (state in (
    'suggested', 'accepted', 'scheduled', 'active', 'snoozed',
    'deferred', 'done', 'dismissed', 'suppressed'
  )),
  snoozed_until timestamptz,
  sensitivity_level text not null default 'none_low' check (sensitivity_level in (
    'none_low', 'personal', 'sensitive_lite', 'sensitive', 'restricted'
  )),
  user_confirmed_cadence boolean not null default false,
  created_by text not null default 'ai' check (created_by in ('user', 'ai', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create index if not exists lifeos_action_items_owner_status_due_idx
  on public.lifeos_action_items (owner_id, status, due_at)
  where deleted_at is null;
create index if not exists lifeos_action_items_person_idx
  on public.lifeos_action_items (person_id)
  where deleted_at is null;
create index if not exists lifeos_reminders_owner_schedule_idx
  on public.lifeos_reminders (owner_id, state, scheduled_for)
  where deleted_at is null;
create index if not exists lifeos_milestones_person_date_idx
  on public.lifeos_milestones (person_id, milestone_date)
  where deleted_at is null;

alter table public.lifeos_action_items enable row level security;
alter table public.lifeos_reminders enable row level security;
alter table public.lifeos_milestones enable row level security;

drop policy if exists action_items_owner on public.lifeos_action_items;
create policy action_items_owner on public.lifeos_action_items
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists reminders_owner on public.lifeos_reminders;
create policy reminders_owner on public.lifeos_reminders
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists milestones_owner on public.lifeos_milestones;
create policy milestones_owner on public.lifeos_milestones
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
