-- US12 Block Venue Availability (SCRUM-14), slice 4: preview a block before saving it
-- (SCRUM-122). Apply after 0028. Safe to replay.
--
-- preview_venue_block() lists what a block would overlap and writes nothing. It is
-- SECURITY DEFINER so Venue Staff can recognise an affected booking without being given
-- read access to events; it returns only the event reference and name.
begin;

create or replace function public.preview_venue_block(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[]
)
returns table (
  overlap_type    text,
  booking_id      uuid,
  booking_status  text,
  event_reference text,
  event_name      text,
  slot_date       date,
  slot            text,
  claim_kind      text,
  block_reason    text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select 'booking'::text, b.id, b.status::text, e.reference::text, e.name::text,
         c.slot_date, c.slot::text, c.kind::text, null::text
  from public.venue_slot_claims c
  join public.venue_bookings b on b.id = c.booking_id
  join public.events e on e.id = b.event_id
  where c.venue_id = p_venue_id
    and c.kind in ('event', 'buffer')
    and c.slot_date between p_starts_on and p_ends_on
    and c.slot = any (p_slots)
    -- A lapsed hold no longer reserves anything, so it is not an affected booking.
    and not (b.status = 'held' and b.hold_expires_at < now())
  order by 6, 7;
end;
$$;
revoke execute on function public.preview_venue_block(uuid, date, date, text[]) from public, anon;
grant execute on function public.preview_venue_block(uuid, date, date, text[]) to authenticated;

commit;
