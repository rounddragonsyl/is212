-- Run after the runner recreates the live legacy constraint and applies 0011 twice.
begin;
update public.event_change_requests set status='partially_approved'
  where id='20000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select status='partially_approved' from public.event_change_requests
   where id='20000000-0000-0000-0000-000000000001'),
  'AC-007.5.38: partial approval is allowed after replacing the live legacy constraint');
update public.event_change_requests set status='clarification_requested'
  where id='20000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select status='clarification_requested' from public.event_change_requests
   where id='20000000-0000-0000-0000-000000000001'),
  'AC-007.7.36: clarification is allowed after replacing the live legacy constraint');
rollback;
select pg_temp.assert_true(
  not exists ((select * from public.event_change_requests except select * from field_reviews_before_repeat)
    union all (select * from field_reviews_before_repeat except select * from public.event_change_requests)),
  'AC-007.13.6: applying the constraint correction twice preserves every saved request');
