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

  raise exception 'Removing a venue block is not available yet' using errcode = '0A000';
end;
$$;
revoke execute on function public.remove_venue_block(uuid) from public, anon;
grant execute on function public.remove_venue_block(uuid) to authenticated;

commit;
