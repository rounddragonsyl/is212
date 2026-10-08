-- US10 Slice 2, AC2: bounded Venue Staff read; no general event SELECT grant.
begin;
create or replace function public.get_venue_booking_review(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can read booking review details' using errcode='42501';
  end if;
  select jsonb_build_object(
    'id',b.id,'venueName',v.name,'status',b.status,
    'reviewNote',b.review_note,'reviewAlternative',b.review_alternative,
    'reviewedBy',b.reviewed_by,'reviewedAt',b.reviewed_at,
    'details',jsonb_build_object(
      'eventName',e.name,'reference',e.reference,
      'startsAt',e.proposed_start,'endsAt',e.proposed_end,
      'attendance',e.expected_attendance,'layoutPreference',e.layout_preference,
      'accessibilityNotes',e.accessibility_requirements,'specialArrangements',e.special_arrangements,
      'requirementsRecorded',r.event_id is not null,'layout',r.layout,
      'accessibility',coalesce(r.accessibility,'{}'::text[]),
      'facilities',coalesce(r.facilities,'{}'::text[]))) into result
  from public.venue_bookings b
  join public.venues v on v.id=b.venue_id
  join public.events e on e.id=b.event_id
  left join public.event_venue_requirements r on r.event_id=e.id
  where b.id=p_booking_id;
  if result is null then
    raise exception 'Booking unavailable' using errcode='P0002';
  end if;
  return result;
end;
$$;
revoke execute on function public.get_venue_booking_review(uuid) from public, anon;
grant execute on function public.get_venue_booking_review(uuid) to authenticated;
commit;
