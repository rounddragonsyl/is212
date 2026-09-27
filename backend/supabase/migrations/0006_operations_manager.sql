-- Apply after both 0005 scripts. Managers oversee submitted events without gaining
-- coordinator lifecycle writes. Assignment/reassignment belongs to its own story.
begin;
alter table public.profiles drop constraint if exists profiles_role_valid;
alter table public.profiles add constraint profiles_role_valid check (
  role in ('organiser', 'coordinator', 'operations_manager', 'venue_staff', 'tech_support', 'attendee')
);

drop policy if exists events_select_for_operations_managers on public.events;
create policy events_select_for_operations_managers on public.events
  for select to authenticated
  using (public.current_user_role() = 'operations_manager' and status <> 'draft');

-- A user switched from organiser to another role must not retain owner write access.
drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events
  for update to authenticated
  using (organiser_id = auth.uid() and public.current_user_role() = 'organiser')
  with check (organiser_id = auth.uid() and public.current_user_role() = 'organiser');

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert to authenticated
  with check (organiser_id = auth.uid() and public.current_user_role() = 'organiser');

create or replace function public.enforce_event_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- No JWT means the SQL editor or a service key: an administrator fixing data, which we
  -- do not stand in the way of.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_valid_status_transition(old.status, new.status) then
    raise exception 'An event cannot move from % to %', old.status, new.status
      using errcode = '22000';
  end if;

  actor_role := public.current_user_role();

  if actor_role = 'coordinator' then
    -- A coordinator reviews, but does not file requests on an organiser's behalf.
    if new.status = 'submitted' and old.status = 'draft' then
      raise exception 'Only the organiser may submit their own request'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if actor_role = 'organiser' and old.organiser_id = auth.uid() then
    -- The organiser submits and may withdraw. Approval is not theirs to grant, which is
    -- the whole point of having a review step.
    if new.status not in ('submitted', 'cancelled') then
      raise exception 'An organiser cannot move their own request to %', new.status
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'You are not permitted to change the status of this event'
    using errcode = '42501';
end;
$$;

commit;
