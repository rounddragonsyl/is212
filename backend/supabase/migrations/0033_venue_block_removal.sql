-- US12 Block Venue Availability (SCRUM-14), slice 7: remove a block (SCRUM-124).
-- Apply after 0032. Safe to replay.
begin;

create or replace function public.remove_venue_block(p_closure_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can remove a venue block' using errcode = '42501';
  end if;

  -- Only the block's own cells. Booking cells inside it never belonged to the block.
  delete from public.venue_slot_claims
  where closure_id = p_closure_id and kind = 'maintenance';
end;
$$;
revoke execute on function public.remove_venue_block(uuid) from public, anon;
grant execute on function public.remove_venue_block(uuid) to authenticated;

commit;
