-- Local disposable runner only; existing synthetic users come from its US7 fixtures.
begin;
insert into public.events (id,organiser_id,purpose,proposed_start,proposed_end,expected_attendance,status)
select ('30000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000001','Direct review fixture',
 '2030-01-01 01:00+00','2030-01-01 02:00+00',10,'submitted'
from generate_series(1,3) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.expect_error($q$select public.review_submitted_event('30000000-0000-0000-0000-000000000001','approved',null)$q$,
 '42501','AC-004.2.31: organiser cannot invoke direct coordinator review');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true(
 public.review_submitted_event('30000000-0000-0000-0000-000000000001','approved',null)='approved',
 'AC-004.2.32: coordinator approves a submitted request in one operation');
select pg_temp.expect_error($q$select public.review_submitted_event('30000000-0000-0000-0000-000000000001','rejected','Too late')$q$,
 '22000','AC-004.2.33: already decided request cannot be overwritten');
reset role;
-- Force the second update to fail, proving the first update is rolled back too.
alter table public.events add constraint test_block_approval check (status <> 'approved') not valid;
set local role authenticated;
select pg_temp.expect_error($q$select public.review_submitted_event('30000000-0000-0000-0000-000000000002','approved',null)$q$,
 '23514','AC-004.2.34: a final-step failure is reported by the atomic operation');
reset role;
select pg_temp.assert_true(
 (select status='submitted' and reviewed_by is null from public.events where id='30000000-0000-0000-0000-000000000002'),
 'AC-004.2.35: failed decision does not leave the request started or stamped');
reset role;
alter table public.events drop constraint test_block_approval;
set local role authenticated;
select pg_temp.expect_error($q$select public.review_submitted_event('30000000-0000-0000-0000-000000000002','submitted',' ')$q$,
 '22000','AC-004.3.8: database rejects direct clarification without a reason');
select public.review_submitted_event('30000000-0000-0000-0000-000000000002','submitted','Explain attendance');
select pg_temp.assert_true(
 (select status='submitted' and review_note='Explain attendance' from public.events where id='30000000-0000-0000-0000-000000000002'),
 'AC-004.3.9: direct clarification retains the question for organiser display');
select public.review_submitted_event('30000000-0000-0000-0000-000000000003','rejected','No suitable venue');
reset role;
select pg_temp.assert_true(
 (select count(*)=2 from public.notification_outbox where event_id in (
 '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003')),
 'AC-004.4.6: direct approval and rejection each queue an email');
select pg_temp.assert_true(
 (select count(*)=3 from public.event_review_decisions where event_id in (
 '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003'))
 and exists (select 1 from public.event_review_decisions where event_id='30000000-0000-0000-0000-000000000002'
 and decision='returned' and reason='Explain attendance' and decided_by='00000000-0000-0000-0000-000000000003'),
 'AC-004.5.13: direct decisions retain one audit entry each including clarification actor and reason');
rollback;
