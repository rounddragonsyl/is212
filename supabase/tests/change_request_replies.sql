-- Disposable fixtures only. All RPCs run with the authenticated browser role.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.events (id,organiser_id,coordinator_id,purpose,name,proposed_start,proposed_end,expected_attendance,status)
values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000003','Reply test','Original','2030-01-01 01:00+00','2030-01-01 02:00+00',10,'submitted');
insert into public.event_change_requests (id,event_id,organiser_id,proposed_changes,reason)
values ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000001','{"name":"New title","expectedAttendance":"80"}','More guests');
create function pg_temp.reply(payload jsonb, version integer default 1) returns text language sql as $$
 select public.reply_to_change_request('50000000-0000-0000-0000-000000000001',version,payload);
$$;
create function pg_temp.reply_review(payload jsonb) returns text language sql as $$
 select public.review_event_change_request('50000000-0000-0000-0000-000000000001',
 (select updated_at from public.events where id='40000000-0000-0000-0000-000000000001'),payload);
$$;
create temp table event_before_reply as select to_jsonb(e) value from public.events e where id='40000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.reply_review('{"action":"decide","decisions":[{"field":"name","decision":"approved"},{"field":"expectedAttendance","decision":"clarification_requested","note":"Includes staff?"}]}');
select pg_temp.expect_error($q$select pg_temp.reply('{"replies":[{"field":"expectedAttendance","message":"Yes"}]}')$q$,'42501',
 'AC-007.2.32: coordinator cannot impersonate the organiser reply');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select pg_temp.expect_error($q$select pg_temp.reply('{"replies":[{"field":"expectedAttendance","message":"Yes"}]}')$q$,'42501',
 'AC-007.2.33: another organiser cannot reply to the request');
select set_config('request.jwt.claim.sub','',false);
select pg_temp.expect_error($q$select pg_temp.reply('{"replies":[{"field":"expectedAttendance","message":"Yes"}]}')$q$,'42501',
 'AC-007.2.34: an absent identity cannot reply');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.expect_error($q$update public.event_change_requests set reply_history='[]' where id='50000000-0000-0000-0000-000000000001'$q$,'42501',
 'AC-007.2.35: organiser cannot directly rewrite reply history');
select pg_temp.expect_error($q$select pg_temp.reply('{"replies":[]}')$q$,'22000',
 'AC-007.7.57: database rejects a missing field answer');
select pg_temp.expect_error($q$select pg_temp.reply('{"replies":[{"field":"expectedAttendance","message":" "}]}')$q$,'22000',
 'AC-007.7.58: database rejects a blank answer');
select pg_temp.expect_error($q$select pg_temp.reply('{"replies":[{"field":"expectedAttendance","message":"Yes"},{"field":"expectedAttendance","message":"Yes"}]}')$q$,'22000',
 'AC-007.7.59: database rejects duplicate field answers');
select pg_temp.expect_error($q$select pg_temp.reply('{"replies":[{"field":"expectedAttendance","message":"Yes"}],"proposedChanges":{"name":"Injected"}}')$q$,'22000',
 'AC-007.7.60: reply cannot replace proposed event values');
select pg_temp.expect_error($q$select pg_temp.reply('{"replies":[{"field":"expectedAttendance","message":"Yes"}]}',0)$q$,'22000',
 'AC-007.7.61: stale question version cannot be answered');
select pg_temp.assert_true(pg_temp.reply('{"replies":[{"field":"expectedAttendance","message":"  Yes  "}]}')='submitted',
 'AC-007.7.62: complete answers return the same request to review');
select pg_temp.expect_error($q$select pg_temp.reply('{"replies":[{"field":"expectedAttendance","message":"Yes"}]}')$q$,'22000',
 'AC-007.7.63: repeated submission cannot duplicate a saved reply');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.expect_error($q$select pg_temp.reply_review('{"action":"clarify","note":"Old question"}')$q$,'22000',
 'AC-007.7.64: an old review client without a request version cannot overwrite replies');
select pg_temp.expect_error($q$select pg_temp.reply_review('{"action":"clarify","note":"Old question","requestVersion":0}')$q$,'22000',
 'AC-007.7.65: a stale coordinator review is rejected even when event values are unchanged');
select pg_temp.reply_review('{"action":"clarify","note":"Please confirm again","requestVersion":2}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(pg_temp.reply('{"note":"  Confirmed again  "}',3)='submitted',
 'AC-007.7.66: a later whole-request question accepts a trimmed legacy reply');
reset role;
select pg_temp.assert_true((select to_jsonb(e)=s.value from public.events e cross join event_before_reply s
 where e.id='40000000-0000-0000-0000-000000000001'),
 'AC-007.8.3: clarification rounds and replies leave every event column unchanged');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ declare outcome text; begin
 outcome := pg_temp.reply_review('{"action":"decide","requestVersion":4,"decisions":[{"field":"name","decision":"approved"},{"field":"expectedAttendance","decision":"rejected","note":"Capacity"}]}');
 perform pg_temp.assert_true(outcome='partially_approved'
 and (select name='New title' and expected_attendance=10 from public.events where id='40000000-0000-0000-0000-000000000001'),
 'AC-007.9.17: final review after replies applies only accepted changes');
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true((select jsonb_array_length(reply_history)=2
 and reply_history->0->'reply'->'replies'->0->>'message'='Yes'
 and reply_history->0->'fieldDecisions'->1->>'note'='Includes staff?'
 and reply_history->0->>'repliedBy'='00000000-0000-0000-0000-000000000001'
 and reply_history->0->>'reviewedBy'='00000000-0000-0000-0000-000000000003'
 and reply_history->0->>'repliedAt' is not null
 and reply_history->1->'reply'->>'note'='Confirmed again'
 and reply_history->1->>'reviewNote'='Please confirm again'
 from public.event_change_requests where id='50000000-0000-0000-0000-000000000001'),
 'AC-007.13.7: organiser can read retained questions answers actors and timestamps across review rounds');
reset role;
select set_config('request.jwt.claim.sub','',false);
