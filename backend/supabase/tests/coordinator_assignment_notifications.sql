-- US17 slice 4: run only in the disposable database test runner.
-- This checks queued delivery, not receipt by a live email provider.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('17400000-0000-0000-0000-000000000001', 'lead-us17-notify@example.test'),
  ('17400000-0000-0000-0000-000000000002', 'organiser-us17-notify@example.test'),
  ('17400000-0000-0000-0000-000000000003', 'coordinator-us17-notify@example.test');
-- 0042 defaults new users to attendees; provision each fixture explicitly.
update public.profiles set role = case id
  when '17400000-0000-0000-0000-000000000001'::uuid then 'coordinator_lead'
  when '17400000-0000-0000-0000-000000000002'::uuid then 'organiser'
  else 'coordinator' end
where id in ('17400000-0000-0000-0000-000000000001',
  '17400000-0000-0000-0000-000000000002', '17400000-0000-0000-0000-000000000003');

insert into public.events (id, organiser_id, name, purpose, proposed_start,
  proposed_end, expected_attendance, status)
values ('17410000-0000-0000-0000-000000000001',
  '17400000-0000-0000-0000-000000000002', 'US17 notification fixture',
  'Check assignment recipients', '2030-01-01 01:00+00', '2030-01-01 02:00+00', 10, 'submitted');

set local role authenticated;
select set_config('request.jwt.claim.sub', '17400000-0000-0000-0000-000000000001', true);
select public.assign_event_coordinator('17410000-0000-0000-0000-000000000001',
  '17400000-0000-0000-0000-000000000003');

-- Inspect private delivery records as test administrator, never grant browser
-- access to the email outbox just to make this assertion possible.
reset role;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare recipients text[]; notice_recipients uuid[];
begin
  select array_agg(recipient_email order by recipient_email) into recipients
  from public.notification_outbox
  where event_id = '17410000-0000-0000-0000-000000000001';
  if recipients is distinct from array[
    'coordinator-us17-notify@example.test', 'organiser-us17-notify@example.test'
  ]::text[] then
    raise exception 'FAIL: AC-017.5.1: successful assignment must queue one email each for the new coordinator and organiser; received %', recipients;
  end if;
  if exists (select 1 from public.notification_outbox
    where event_id = '17410000-0000-0000-0000-000000000001'
      and (status <> 'pending' or attempts <> 0 or sent_at is not null
        or nullif(btrim(subject), '') is null or nullif(btrim(body), '') is null)) then
    raise exception 'FAIL: AC-017.5.1: assignment emails must contain a message and await delivery';
  end if;
  if to_regclass('public.coordinator_assignment_notifications') is null then
    raise exception 'FAIL: AC-017.5.1: assignment must retain in-app notifications for its recipients';
  end if;
  select array_agg(recipient_id order by recipient_id) into notice_recipients
  from public.coordinator_assignment_notifications
  where event_id = '17410000-0000-0000-0000-000000000001';
  if notice_recipients is distinct from array[
    '17400000-0000-0000-0000-000000000002'::uuid,
    '17400000-0000-0000-0000-000000000003'::uuid
  ] then
    raise exception 'FAIL: AC-017.5.1: in-app recipients must be exactly the organiser and new coordinator';
  end if;
  raise notice 'PASS: AC-017.5.1: assignment records in-app notifications and queues email for the new coordinator and organiser';
end $$;
rollback;
