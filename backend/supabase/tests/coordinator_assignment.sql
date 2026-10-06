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

rollback;
