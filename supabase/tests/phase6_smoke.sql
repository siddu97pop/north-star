-- Reversible database smoke test for North Star Phase 6.
do $phase6$
declare
  sample_owner uuid;
  test_person_id uuid;
  test_briefing_id uuid;
  source_action_id uuid;
begin
  select id into sample_owner from auth.users limit 1;
  if sample_owner is null then
    raise exception 'Phase 6 smoke test needs at least one auth user';
  end if;

  insert into public.lifeos_people (owner_id, name, normalized_name)
  values (sample_owner, 'Phase Six Smoke Test', 'phase six smoke test')
  returning id into test_person_id;

  insert into public.lifeos_action_items (
    owner_id, person_id, action_type, title, commitment_certainty,
    confirmation_status, status, created_by
  ) values (
    sample_owner, test_person_id, 'explicit_promise', 'Share the confirmed draft',
    'c5_explicit', 'confirmed', 'active', 'user'
  ) returning id into source_action_id;

  insert into public.lifeos_briefings (
    person_id, owner_id, briefing_summary, model_name,
    sensitive_items_suppressed, generation_status
  ) values (
    test_person_id, sample_owner, 'One confirmed commitment and no sensitive detail.',
    'deterministic_fallback', 1, 'complete'
  ) returning id into test_briefing_id;

  insert into public.lifeos_briefing_items (
    briefing_id, owner_id, item_type, item_title, item_text,
    source_object_type, source_object_id, source_label,
    confidence_level, sensitivity_level, visibility_mode
  ) values (
    test_briefing_id, sample_owner, 'pending_action', 'Pending commitment',
    'Share the confirmed draft', 'action_item', source_action_id,
    'User-confirmed action', 'high', 'none_low', 'visible'
  );

  if not exists (
    select 1 from public.lifeos_briefings b
    join public.lifeos_briefing_items i on i.briefing_id = b.id
    where b.id = test_briefing_id and b.sensitive_items_suppressed = 1
      and i.source_object_id = source_action_id and i.visibility_mode = 'visible'
  ) then
    raise exception 'Structured briefing provenance check failed';
  end if;

  delete from public.lifeos_people where id = test_person_id;
  if exists (select 1 from public.lifeos_briefings where id = test_briefing_id)
     or exists (select 1 from public.lifeos_action_items where id = source_action_id) then
    raise exception 'Phase 6 cascade cleanup failed';
  end if;
end
$phase6$;
