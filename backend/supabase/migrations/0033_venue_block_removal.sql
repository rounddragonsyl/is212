-- US12 Block Venue Availability (SCRUM-14), slice 7: remove a block (SCRUM-124).
-- Apply after 0032. Safe to replay.
--
-- Removal is soft: the block row stays as the record of who blocked, why, and who lifted
-- it and when (AC-012.10).
begin;

alter table public.venue_closures
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles (id);
alter table public.venue_closures
  drop constraint if exists venue_closures_removal_recorded;
alter table public.venue_closures
  add constraint venue_closures_removal_recorded
  check ((removed_at is null) = (removed_by is null));

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

  -- Who removed it comes from the session, never from the browser.
  update public.venue_closures
  set removed_at = now(), removed_by = auth.uid()
  where id = p_closure_id and removed_at is null;

  -- Only the block's own cells. Booking cells inside it never belonged to the block.
  delete from public.venue_slot_claims
  where closure_id = p_closure_id and kind = 'maintenance';
end;
$$;
revoke execute on function public.remove_venue_block(uuid) from public, anon;
grant execute on function public.remove_venue_block(uuid) to authenticated;

commit;
