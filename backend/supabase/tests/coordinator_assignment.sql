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
  ('17000000-0000-0000-0000-000000000003', 'coordinator-us17@example.test');
update public.profiles set role = 'coordinator'
  where id = '17000000-0000-0000-0000-000000000003';
insert into public.events (
  id, organiser_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status
) values (
  '17100000-0000-0000-0000-000000000001',
  '17000000-0000-0000-0000-000000000002',
  'US17 submitted event', 'Assignment test',
  '2030-01-01 01:00+00', '2030-01-01 02:00+00', 10, 'submitted'
);

set local role authenticated;
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
