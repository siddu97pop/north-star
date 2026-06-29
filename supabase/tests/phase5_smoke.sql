-- Reversible database smoke test for North Star Phase 5.
do $phase5$
declare
  sample_owner uuid;
  test_person_id uuid;
  test_signal_id uuid;
  inferred_state_id uuid;
  override_state_id uuid;
begin
  select id into sample_owner from auth.users limit 1;
  if sample_owner is null then
    raise exception 'Phase 5 smoke test needs at least one auth user';
  end if;

  insert into public.lifeos_people (owner_id, name, normalized_name)
  values (sample_owner, 'Phase Five Smoke Test', 'phase five smoke test')
  returning id into test_person_id;

  insert into public.lifeos_relationship_signals (
    person_id, owner_id, signal_family, signal_direction, signal_strength,
    signal_summary, confidence_level, confirmation_status
  ) values (
    test_person_id, sample_owner, 'support', 'positive', 'strong',
    'Confirmed supportive interaction', 'high', 'confirmed'
  ) returning id into test_signal_id;

  insert into public.lifeos_relationship_state (
    person_id, owner_id, health_state, momentum_state, dormancy_state,
    reason_codes, confidence_level, confirmation_status, created_by
  ) values (
    test_person_id, sample_owner, 'positive', 'growing', 'active',
    array['CONFIRMED_POSITIVE_SIGNAL'], 'high', 'suggested', 'ai'
  ) returning id into inferred_state_id;

  update public.lifeos_relationship_state
  set snapshot_type = 'historical', superseded_at = now()
  where id = inferred_state_id;

  insert into public.lifeos_relationship_state (
    person_id, owner_id, health_state, momentum_state, dormancy_state,
    reason_codes, confidence_level, confirmation_status, created_by
  ) values (
    test_person_id, sample_owner, 'quiet_but_ok', 'steady', 'quiet',
    array['USER_OVERRIDE'], 'high', 'confirmed', 'user'
  ) returning id into override_state_id;

  if not exists (
    select 1 from public.lifeos_relationship_state
    where id = override_state_id and created_by = 'user' and health_state = 'quiet_but_ok'
  ) or not exists (
    select 1 from public.lifeos_relationship_state
    where id = inferred_state_id and snapshot_type = 'historical' and superseded_at is not null
  ) then
    raise exception 'Relationship state override/history check failed';
  end if;

  delete from public.lifeos_people where id = test_person_id;
  if exists (select 1 from public.lifeos_relationship_signals where id = test_signal_id)
     or exists (select 1 from public.lifeos_relationship_state where id in (inferred_state_id, override_state_id)) then
    raise exception 'Phase 5 cascade cleanup failed';
  end if;
end
$phase5$;
