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
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can block a venue' using errcode = '42501';
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
