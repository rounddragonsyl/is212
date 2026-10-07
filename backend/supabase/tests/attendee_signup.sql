-- US29 (SCRUM-227): disposable PostgreSQL only; run through the database test runner.
-- Inserting into auth.users stands in for Supabase Auth creating an account, so these checks
-- prove the sign-up trigger and the policies, not Supabase Auth itself (for example, email
-- uniqueness, which AC-029.2 relies on, is Supabase Auth's and is tested in Vitest/manually).
--
-- Committed rather than rolled back: the runner replays 0042 afterwards (AC-029.3.13) and
-- compares against the snapshot taken at the end of this file.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- ---------------------------------------------------------------------------
-- AC-029.1: a person signs up with name, email and password and receives the Attendee role
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('29000000-0000-0000-0000-000000000001', 'ada-us29@example.test', '{"full_name":"Ada Tan"}');

select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(role = 'attendee') and bool_and(full_name = 'Ada Tan')
     from public.profiles where id = '29000000-0000-0000-0000-000000000001'),
  'AC-029.1.1: a new account gets exactly one profile, with the Attendee role and the given name');

insert into auth.users (id, email, raw_user_meta_data) values
  ('29000000-0000-0000-0000-000000000002', 'blank-us29@example.test', '{"full_name":"   "}');

select pg_temp.assert_true(
  (select role = 'attendee' and full_name = 'blank-us29'
     from public.profiles where id = '29000000-0000-0000-0000-000000000002'),
  'AC-029.1.2: a blank name falls back to the email name instead of failing the sign-up');

insert into auth.users (id, email) values
  ('29000000-0000-0000-0000-000000000003', 'bare-us29@example.test');

select pg_temp.assert_true(
  (select role = 'attendee' from public.profiles where id = '29000000-0000-0000-0000-000000000003'),
  'AC-029.1.3: an account created with no metadata is still an Attendee');

-- ---------------------------------------------------------------------------
-- AC-029.3: self sign-up never grants an internal role or the Event Organiser role
-- ---------------------------------------------------------------------------
-- Sign-up metadata is written by the browser, so anyone can put a role in it. There is no
-- Safety Officer role in the schema; every role that does exist is tried (assumption A4).
insert into auth.users (id, email, raw_user_meta_data)
select ('29000000-0000-0000-0000-0000000001' || lpad(position::text, 2, '0'))::uuid,
       'claims-' || claimed || '-us29@example.test',
       jsonb_build_object('full_name', 'Claims ' || claimed, 'role', claimed)
from unnest(array['coordinator', 'coordinator_lead', 'operations_manager',
                  'venue_staff', 'tech_support', 'organiser'])
  with ordinality as claims(claimed, position);

select pg_temp.assert_true(
  (select count(*) = 6 and bool_and(p.role = 'attendee')
     from public.profiles p join auth.users u on u.id = p.id
    where u.email like 'claims-%-us29@example.test'),
  'AC-029.3.1: a role claimed in the sign-up metadata is ignored for every existing role');

insert into auth.users (id, email, raw_user_meta_data) values
  ('29000000-0000-0000-0000-000000000004', 'cara-us29@example.test',
   '{"full_name":"Cara Ng","requested_role":"coordinator"}'),
  ('29000000-0000-0000-0000-000000000005', 'org-us29@example.test',
   '{"full_name":"Org Lim","requested_role":"organiser"}'),
  ('29000000-0000-0000-0000-000000000006', 'other-org-us29@example.test',
   '{"full_name":"Other Org","requested_role":"organiser"}');

select pg_temp.assert_true(
  (select role = 'attendee' from public.profiles where id = '29000000-0000-0000-0000-000000000004')
  and not exists (select 1 from public.organiser_requests
                   where user_id = '29000000-0000-0000-0000-000000000004'),
  'AC-029.3.2: requesting any role other than organiser records nothing');

select pg_temp.assert_true(
  (select role = 'attendee' from public.profiles where id = '29000000-0000-0000-0000-000000000005')
  and (select count(*) = 1 and bool_and(status = 'pending') from public.organiser_requests
        where user_id = '29000000-0000-0000-0000-000000000005'),
  'AC-029.3.3: an organiser request is recorded as pending and grants nothing');

-- Signed in as the new Attendee from AC-029.1.1, the way PostgREST runs a browser request.
set local role authenticated;
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000001', true);

do $$
begin
  begin
    update public.profiles set role = 'organiser' where id = '29000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: AC-029.3.4: an Attendee changed their own role to organiser';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'coordinator' where id = '29000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: AC-029.3.4: an Attendee changed their own role to coordinator';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Editing a name is an ordinary profile change and must survive the role lock.
update public.profiles set full_name = 'Ada T.' where id = '29000000-0000-0000-0000-000000000001';

reset role;
select set_config('request.jwt.claim.sub', '', true);

select pg_temp.assert_true(
  (select role = 'attendee' from public.profiles where id = '29000000-0000-0000-0000-000000000001'),
  'AC-029.3.4: an Attendee cannot change their own role to organiser or coordinator');

select pg_temp.assert_true(
  (select full_name = 'Ada T.' and role = 'attendee'
     from public.profiles where id = '29000000-0000-0000-0000-000000000001'),
  'AC-029.3.5: an Attendee can still edit their own name');

set local role authenticated;
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000001', true);

select pg_temp.expect_error(
  $q$insert into public.profiles (id, full_name, role)
     values ('29000000-0000-0000-0000-000000000099', 'Forged', 'coordinator')$q$,
  '42501',
  'AC-029.3.6: an Attendee cannot insert a profile');

-- Signed in as the organiser requester.
set local role authenticated;
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000005', true);

select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(user_id = '29000000-0000-0000-0000-000000000005')
     from public.organiser_requests),
  'AC-029.3.7: a requester reads only their own organiser request');

select pg_temp.expect_error(
  $q$insert into public.organiser_requests (user_id, status)
     values ('29000000-0000-0000-0000-000000000003', 'pending')$q$,
  '42501',
  'AC-029.3.8: the browser cannot create an organiser request');

-- Self-approval and withdrawal: either refused outright or matching no rows is acceptable,
-- as long as nothing changes.
do $$
declare
  changed integer;
begin
  begin
    update public.organiser_requests set status = 'approved'
     where user_id = '29000000-0000-0000-0000-000000000005';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'FAIL: AC-029.3.8: a requester approved their own request'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.organiser_requests where user_id = '29000000-0000-0000-0000-000000000005';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'FAIL: AC-029.3.8: a requester deleted their own request'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);

select pg_temp.assert_true(
  (select status = 'pending' from public.organiser_requests
    where user_id = '29000000-0000-0000-0000-000000000005'),
  'AC-029.3.8: requests cannot be created, approved or deleted from the browser');

set local role authenticated;
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000005', true);

select pg_temp.expect_error(
  $q$select public.decide_organiser_request('29000000-0000-0000-0000-000000000005', true)$q$,
  '42501',
  'AC-029.3.9: the browser cannot call the decision function');

reset role;
select set_config('request.jwt.claim.sub', '', true);

select pg_temp.assert_true(
  (select role = 'attendee' from public.profiles where id = '29000000-0000-0000-0000-000000000005'),
  'AC-029.3.9: the role is unchanged after the refused decision call');

-- An administrator (no JWT: SQL editor or service role) decides requests.
select public.decide_organiser_request('29000000-0000-0000-0000-000000000005', true);

select pg_temp.assert_true(
  (select status = 'approved' and decided_at is not null from public.organiser_requests
    where user_id = '29000000-0000-0000-0000-000000000005')
  and (select role = 'organiser' from public.profiles
        where id = '29000000-0000-0000-0000-000000000005'),
  'AC-029.3.10: an administrator''s approval grants the Organiser role');

select public.decide_organiser_request('29000000-0000-0000-0000-000000000006', false);

select pg_temp.assert_true(
  (select status = 'rejected' and decided_at is not null from public.organiser_requests
    where user_id = '29000000-0000-0000-0000-000000000006')
  and (select role = 'attendee' from public.profiles
        where id = '29000000-0000-0000-0000-000000000006'),
  'AC-029.3.11: an administrator''s rejection leaves the Attendee role');

select pg_temp.expect_error(
  $q$select public.decide_organiser_request('29000000-0000-0000-0000-000000000005', false)$q$,
  '22000',
  'AC-029.3.12: a decided request cannot be decided again');

select pg_temp.assert_true(
  (select status = 'approved' from public.organiser_requests
    where user_id = '29000000-0000-0000-0000-000000000005')
  and (select role = 'organiser' from public.profiles
        where id = '29000000-0000-0000-0000-000000000005'),
  'AC-029.3.12: the earlier decision and role are unchanged');

commit;

-- Snapshot for AC-029.3.13, which the runner checks after replaying 0042.
create temp table profiles_before_us29_replay as select * from public.profiles;
create temp table organiser_requests_before_us29_replay as select * from public.organiser_requests;
