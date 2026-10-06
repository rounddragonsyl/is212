-- US17 slice 1: Coordinator Lead role and assignment permissions.
-- Existing accounts remain unchanged; assignment authority moves to Coordinator Lead.
begin;

alter table public.profiles drop constraint if exists profiles_role_valid;
alter table public.profiles add constraint profiles_role_valid check (
  role in ('organiser', 'coordinator', 'coordinator_lead', 'operations_manager',
           'venue_staff', 'tech_support', 'attendee')
);

create or replace function public.guard_event_coordinator_assignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.coordinator_id is not distinct from old.coordinator_id then return new; end if;
  elsif new.coordinator_id is null then
    return new;
  end if;
  if auth.uid() is not null and public.current_user_role() is distinct from 'coordinator_lead' then
    raise exception 'Only a Coordinator Lead may assign a coordinator' using errcode = '42501';
  end if;
  if new.status = 'draft' then
    raise exception 'Submit the event before assigning a coordinator' using errcode = '22000';
  end if;
  if new.coordinator_id is not null and not exists (
    select 1 from public.profiles where id = new.coordinator_id and role = 'coordinator'
  ) then
    raise exception 'Choose a coordinator profile' using errcode = '22000';
  end if;
  return new;
end $$;

-- Keep the operation narrowly scoped: it changes assignment, not general event details.
create or replace function public.assign_event_coordinator(p_event_id uuid, p_coordinator_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator_lead' then
    raise exception 'Only a Coordinator Lead may assign a coordinator' using errcode = '42501';
  end if;
  if p_coordinator_id is null then
    raise exception 'Choose a coordinator' using errcode = '22000';
  end if;
  update public.events set coordinator_id = p_coordinator_id
    where id = p_event_id and status <> 'draft';
  if not found then raise exception 'Event unavailable' using errcode = '22000'; end if;
end $$;
revoke all on function public.assign_event_coordinator(uuid, uuid) from public, anon;
grant execute on function public.assign_event_coordinator(uuid, uuid) to authenticated;

commit;
