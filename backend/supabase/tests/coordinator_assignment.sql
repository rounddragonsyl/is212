-- US17: disposable PostgreSQL fixtures only; run through the database test runner.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('17000000-0000-0000-0000-000000000001', 'lead-us17@example.test');

-- AC1 prerequisite: an administrator can provision the role used for assignment.
do $$
begin
  update public.profiles set role = 'coordinator_lead'
    where id = '17000000-0000-0000-0000-000000000001';
exception when check_violation then
  raise exception 'FAIL: AC-017.1.2: database accepts an administrator-assigned Coordinator Lead profile. %', sqlerrm;
end $$;

select pg_temp.assert_true(
  (select role = 'coordinator_lead' from public.profiles
    where id = '17000000-0000-0000-0000-000000000001'),
  'AC-017.1.2: database accepts an administrator-assigned Coordinator Lead profile');

insert into auth.users (id, email) values
  ('17000000-0000-0000-0000-000000000002', 'organiser-us17@example.test'),
  ('17000000-0000-0000-0000-000000000003', 'coordinator-us17@example.test'),
  ('17000000-0000-0000-0000-000000000004', 'manager-us17@example.test');
update public.profiles set role = 'coordinator'
  where id = '17000000-0000-0000-0000-000000000003';
update public.profiles set role = 'operations_manager'
  where id = '17000000-0000-0000-0000-000000000004';
insert into public.events (
  id, organiser_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status
) values (
  '17100000-0000-0000-0000-000000000001',
  '17000000-0000-0000-0000-000000000002',
  'US17 submitted event', 'Assignment test',
  '2030-01-01 01:00+00', '2030-01-01 02:00+00', 10, 'submitted'
);

-- Execute as a browser user and distinguish permission denial from unrelated SQL errors.
create function pg_temp.us17_assignment_attempt(actor uuid, direct_update boolean)
returns text language plpgsql as $$
declare affected integer;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  if direct_update then
    update public.events set coordinator_id = '17000000-0000-0000-0000-000000000003'
      where id = '17100000-0000-0000-0000-000000000001';
    get diagnostics affected = row_count;
    return 'rows:' || affected;
  end if;
  perform public.assign_event_coordinator(
    '17100000-0000-0000-0000-000000000001',
    '17000000-0000-0000-0000-000000000003'
  );
  return 'allowed';
exception when insufficient_privilege then
  return '42501';
end $$;

set local role authenticated;
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000002', false) = '42501',
  'AC-017.1.3: organiser cannot assign through the function');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000002', true) in ('42501', 'rows:0'),
  'AC-017.1.4: organiser cannot assign through a direct update');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000003', false) = '42501',
  'AC-017.1.5: coordinator cannot self-assign through the function');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000003', true) in ('42501', 'rows:0'),
  'AC-017.1.6: coordinator cannot self-assign through a direct update');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000004', false) = '42501',
  'AC-017.1.7: legacy Operations Manager cannot assign through the function');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000004', true) in ('42501', 'rows:0'),
  'AC-017.1.8: legacy Operations Manager cannot assign through a direct update');

select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
do $$
begin
  perform public.assign_event_coordinator(
    '17100000-0000-0000-0000-000000000001',
    '17000000-0000-0000-0000-000000000003'
  );
exception when insufficient_privilege then
  raise exception 'FAIL: AC-017.2.1: Coordinator Lead assigns a submitted event to an Event Coordinator. %', sqlerrm;
end $$;

-- Inspect persistence as the test administrator; Lead queue read access is a separate check.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select coordinator_id = '17000000-0000-0000-0000-000000000003'
      and status = 'submitted'
      and organiser_id = '17000000-0000-0000-0000-000000000002'
    from public.events where id = '17100000-0000-0000-0000-000000000001'),
  'AC-017.2.1: Coordinator Lead assigns a submitted event to an Event Coordinator');

rollback;
