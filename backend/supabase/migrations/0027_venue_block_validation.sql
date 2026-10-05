-- US12 Block Venue Availability (SCRUM-14), slice 2: who may block, and input rules
-- (SCRUM-119, SCRUM-120). Apply after 0026. Safe to replay.
--
-- block_venue() refuses every invalid request. It saves nothing yet: saving arrives in
-- slice 3 with the tests that check it, so until then a valid request is refused too.
begin;

-- Shared by preview (slice 4) and block, so a preview can never accept what the block
-- would refuse. Internal: callable only from the functions below, never the browser.
create or replace function public.venue_block_request_slots(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[]
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can block a venue' using errcode = '42501';
  end if;

  select status into v_status from public.venues where id = p_venue_id;
  if not found then
    raise exception 'That venue could not be found' using errcode = 'P0002';
  end if;
  if v_status = 'retired' then
    raise exception 'A retired venue cannot be blocked' using errcode = '22023';
  end if;

  if p_ends_on < p_starts_on then
    raise exception 'A block must end on or after the day it starts' using errcode = '22023';
  end if;
  -- One row per cell will be written, so an unbounded range is an unbounded insert.
  -- A longer closure is entered as consecutive blocks.
  if p_ends_on - p_starts_on > 365 then
    raise exception 'A single block can cover at most 366 days' using errcode = '22023';
  end if;

  if cardinality(p_slots) = 0 then
    raise exception 'Choose at least one slot to block' using errcode = '22023';
  end if;

  return p_slots;
end;
$$;
revoke execute on function public.venue_block_request_slots(uuid, date, date, text[])
  from public, anon, authenticated;

create or replace function public.block_venue(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[], p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.venue_block_request_slots(p_venue_id, p_starts_on, p_ends_on, p_slots);

  raise exception 'Blocking a venue is not available yet' using errcode = '0A000';
end;
$$;
revoke execute on function public.block_venue(uuid, date, date, text[], text) from public, anon;
grant execute on function public.block_venue(uuid, date, date, text[], text) to authenticated;

commit;
