-- Reversible database smoke test for North Star Phase 3.
do $phase3$
declare
  sample_owner uuid;
  sample_person uuid;
  action_id uuid;
  reminder_id uuid;
  milestone_id uuid;
begin
  select owner_id, id into sample_owner, sample_person
  from public.lifeos_people
  where deleted_at is null
  limit 1;

  if sample_person is null then
    raise exception 'Phase 3 smoke test needs at least one lifeos_people row';
  end if;

  insert into public.lifeos_action_items (
    owner_id, person_id, action_type, title, commitment_certainty,
    confirmation_status, status, created_by
  ) values (
    sample_owner, sample_person, 'explicit_promise', 'Phase 3 smoke test',
    'c5_explicit', 'confirmed', 'active', 'system'
  ) returning id into action_id;

  insert into public.lifeos_reminders (
    owner_id, person_id, action_item_id, reminder_type, reminder_title,
    reminder_body_safe, state, cadence_rule, created_by
  ) values (
    sample_owner, sample_person, action_id, 'action', 'Phase 3 smoke test',
    'Open Life OS to review this commitment.', 'suggested', 'one_time', 'system'
  ) returning id into reminder_id;

  update public.lifeos_action_items
  set status = 'completed', completed_at = now()
  where id = action_id;

  update public.lifeos_reminders
  set state = 'done', completed_at = now()
  where id = reminder_id;

  if not exists (
    select 1 from public.lifeos_action_items
    where id = action_id and status = 'completed' and completed_at is not null
  ) or not exists (
    select 1 from public.lifeos_reminders
    where id = reminder_id and state = 'done' and completed_at is not null
  ) then
    raise exception 'Action/reminder lifecycle check failed';
  end if;

  insert into public.lifeos_milestones (
    owner_id, person_id, milestone_type, milestone_title, milestone_date
  ) values (
    sample_owner, sample_person, 'custom', 'Phase 3 smoke test', current_date
  ) returning id into milestone_id;

  delete from public.lifeos_milestones where id = milestone_id;
  delete from public.lifeos_action_items where id = action_id;

  if exists (select 1 from public.lifeos_reminders where id = reminder_id) then
    raise exception 'Reminder cascade cleanup failed';
  end if;
end
$phase3$;
