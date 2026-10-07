-- US10 / SCRUM-17, AC8: mandatory rejection reasons. Disposable runner only.
-- .9-.12 avoid the existing tentative-hold story's AC-010.8.4-.8 allocations.
-- No new RPC or production stub: exercise the existing Venue Staff UPDATE policy.
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into auth.users (id, email, raw_user_meta_data) values
 ('b10a0000-0000-0000-0000-000000000001', 'review10@example.test', '{"full_name":"US10 Venue Staff"}'),
 ('b10a0000-0000-0000-0000-000000000002', 'owner10@example.test', '{"full_name":"US10 Organiser"}');
-- Self sign-up creates Attendees since US29 (0042), so organisers are assigned like other roles.
update public.profiles set role='organiser'
 where id='b10a0000-0000-0000-0000-000000000002';
update public.profiles set role='venue_staff'
 where id='b10a0000-0000-0000-0000-000000000001';
insert into public.venues (id,name,location,capacity,layout,status) values
 ('b10a0000-0000-0000-0000-000000000003','US10 Review Hall','Test',100,'Theatre','active');
insert into public.events (id,organiser_id,status)
select ('b10a0000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 'b10a0000-0000-0000-0000-000000000002','draft' from generate_series(101,104) n;
insert into public.venue_bookings (id,event_id,venue_id,requested_by,status)
select ('b10a0000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 ('b10a0000-0000-0000-0000-' || lpad((n-100)::text,12,'0'))::uuid,
 'b10a0000-0000-0000-0000-000000000003',
 'b10a0000-0000-0000-0000-000000000002','pending_approval'
from generate_series(201,204) n;

create temp table us10_results (label text, passed boolean);
grant insert, select on us10_results to authenticated;
create function pg_temp.check_rejection(booking_id uuid, reason text, should_refuse boolean, label text)
returns void language plpgsql as $$
declare
  refused boolean := false;
  changed integer;
  passed boolean;
begin
  begin
    update public.venue_bookings set status='rejected', review_note=reason,
      reviewed_by=auth.uid(), reviewed_at=now() where id=booking_id;
    get diagnostics changed = row_count;
    if changed <> 1 then
      raise exception 'Fixture/access failure: expected one visible pending booking, got %', changed;
    end if;
  exception when check_violation or invalid_parameter_value then
    refused := true;
  end;
  if should_refuse then
    passed := refused and exists(select 1 from public.venue_bookings
      where id=booking_id and status='pending_approval' and review_note is null);
  else
    passed := not refused and exists(select 1 from public.venue_bookings
      where id=booking_id and status='rejected' and review_note=reason);
  end if;
  insert into us10_results values(label,passed);
  raise notice '%: %', case when passed then 'PASS' else 'FAIL' end, label;
end;
$$;
set role authenticated;
select set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000001',false);
select pg_temp.check_rejection('b10a0000-0000-0000-0000-000000000201',null,true,
 'AC-010.8.9: missing rejection reason is refused and request remains pending');
select pg_temp.check_rejection('b10a0000-0000-0000-0000-000000000202','',true,
 'AC-010.8.10: empty rejection reason is refused and request remains pending');
select pg_temp.check_rejection('b10a0000-0000-0000-0000-000000000203',E' \t\n ',true,
 'AC-010.8.11: whitespace-only rejection reason is refused and request remains pending');
select pg_temp.check_rejection('b10a0000-0000-0000-0000-000000000204','Venue unsuitable',false,
 'AC-010.8.12: Venue Staff can reject with a recorded nonblank reason');
reset role;
select label, case when passed then 'PASS' else 'FAIL' end as result from us10_results;
select count(*) as total, count(*) filter(where passed) as passed,
 count(*) filter(where not passed) as failed from us10_results;
do $$ begin
 if exists(select 1 from us10_results where not passed) then
   raise exception 'US10 AC8 assertions failed: rejection reasons must be mandatory';
 end if;
end $$;
