-- Reversible database smoke test for North Star Phase 4.
do $phase4$
declare
  sample_owner uuid;
  test_person_id uuid;
  test_recommendation_id uuid;
  test_evidence_id uuid;
  test_action_id uuid;
begin
  select id into sample_owner from auth.users limit 1;
  if sample_owner is null then
    raise exception 'Phase 4 smoke test needs at least one auth user';
  end if;

  insert into public.lifeos_people (owner_id, name, normalized_name)
  values (sample_owner, 'Phase Four Smoke Test', 'phase four smoke test')
  returning id into test_person_id;

  insert into public.lifeos_recommendations (
    owner_id, person_id, recommendation_type, recommendation_title,
    recommendation_text, action_requested, evidence_strength,
    confidence_level, sensitivity_level, contextual_integrity_status,
    agency_level, expires_at, created_by_model, prompt_version
  ) values (
    sample_owner, test_person_id, 'follow_up', 'Review a confirmed next step',
    'You may want to review a confirmed next step.', 'Review the action',
    'explicit', 'high', 'none_low', 'appropriate', 'suggest',
    now() + interval '14 days', 'smoke_test', 'phase4_smoke'
  ) returning id into test_recommendation_id;

  insert into public.lifeos_recommendation_evidence (
    recommendation_id, owner_id, evidence_object_type, evidence_object_id,
    evidence_summary, evidence_strength, sensitivity_level
  ) values (
    test_recommendation_id, sample_owner, 'interaction', gen_random_uuid(),
    'Confirmed source evidence', 'explicit', 'none_low'
  ) returning id into test_evidence_id;

  insert into public.lifeos_action_items (
    owner_id, person_id, action_type, title, commitment_certainty,
    confirmation_status, status, created_by
  ) values (
    sample_owner, test_person_id, 'scheduled_next_step', 'Review the action',
    'c4_agreed', 'confirmed', 'active', 'ai'
  ) returning id into test_action_id;

  insert into public.lifeos_recommendation_decisions (
    recommendation_id, owner_id, decision_type,
    created_result_object_type, created_result_object_id
  ) values (
    test_recommendation_id, sample_owner, 'accepted', 'action_item', test_action_id
  );

  insert into public.lifeos_recommendation_suppressions (
    owner_id, person_id, recommendation_type, suppression_scope, reason
  ) values (
    sample_owner, test_person_id, 'follow_up', 'person_type', 'Phase 4 smoke test'
  );

  update public.lifeos_recommendations set state = 'converted' where id = test_recommendation_id;

  if not exists (
    select 1 from public.lifeos_recommendations r
    join public.lifeos_recommendation_evidence e on e.recommendation_id = r.id
    join public.lifeos_recommendation_decisions d on d.recommendation_id = r.id
    where r.id = test_recommendation_id and r.state = 'converted'
      and e.id = test_evidence_id and d.created_result_object_id = test_action_id
  ) then
    raise exception 'Recommendation evidence/decision conversion check failed';
  end if;

  if not exists (
    select 1 from public.lifeos_recommendation_suppressions
    where person_id = test_person_id and recommendation_type = 'follow_up' and is_active
  ) then
    raise exception 'Disable-similar suppression check failed';
  end if;

  delete from public.lifeos_people where id = test_person_id;

  if exists (select 1 from public.lifeos_recommendations where id = test_recommendation_id)
     or exists (select 1 from public.lifeos_action_items where id = test_action_id) then
    raise exception 'Phase 4 cascade cleanup failed';
  end if;
end
$phase4$;
