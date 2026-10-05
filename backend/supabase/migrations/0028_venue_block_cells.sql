-- US12 Block Venue Availability (SCRUM-14), slice 3: a saved block holds its cells
-- (SCRUM-119, SCRUM-121). Apply after 0027. Safe to replay.
begin;

-- A block covers chosen slots, not always whole days. Rows from before this migration
-- were whole-day closures, so the default is all three slots.
alter table public.venue_closures
  add column if not exists slots text[] not null default array['AM', 'PM', 'NIGHT'];

create or replace function public.block_venue(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[], p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closure uuid;
begin
  perform public.venue_block_request_slots(p_venue_id, p_starts_on, p_ends_on, p_slots);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to block a venue' using errcode = '22023';
  end if;

  -- Who blocked comes from the session, never from the browser.
  insert into public.venue_closures (venue_id, starts_on, ends_on, slots, reason, created_by)
  values (p_venue_id, p_starts_on, p_ends_on, p_slots, p_reason, auth.uid())
  returning id into v_closure;

  return v_closure;
end;
$$;
revoke execute on function public.block_venue(uuid, date, date, text[], text) from public, anon;
grant execute on function public.block_venue(uuid, date, date, text[], text) to authenticated;

commit;
