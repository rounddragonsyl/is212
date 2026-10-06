-- US17 slice 2: reassignment restrictions, current-coordinator writes and history.
begin;

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
  -- Check both row versions so changing status in the same write cannot bypass the rule.
  -- The trigger protects the assignment RPC and direct database writes alike.
  if tg_op = 'UPDATE' then
    if old.status in ('completed', 'cancelled') or new.status in ('completed', 'cancelled') then
      raise exception 'Completed or cancelled events cannot be reassigned' using errcode = '22000';
    end if;
  end if;
  if new.coordinator_id is not null and not exists (
    select 1 from public.profiles where id = new.coordinator_id and role = 'coordinator'
  ) then
    raise exception 'Choose a coordinator profile' using errcode = '22000';
  end if;
  return new;
end $$;

-- US4 supports both direct updates and an atomic review RPC. Guard the row itself
-- so neither route can retain the previous coordinator's authority after reassignment.
-- UPDATE locks serialize this check with assignment changes on the same event.
create or replace function public.guard_assigned_coordinator_event_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and public.current_user_role() = 'coordinator'
     and old.coordinator_id is distinct from auth.uid() then
    raise exception 'Only the assigned coordinator may change this event' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists events_guard_assigned_coordinator_update on public.events;
create trigger events_guard_assigned_coordinator_update
  before update on public.events
  for each row execute function public.guard_assigned_coordinator_event_update();

-- Retain future Lead actions only; existing assignments have no reliable actor/time
-- to backfill. Foreign keys prevent deleting identities referenced by this audit trail.
create table if not exists public.event_coordinator_assignment_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  previous_coordinator_id uuid references public.profiles(id),
  new_coordinator_id uuid references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default clock_timestamp(),
  constraint coordinator_assignment_history_changed check (
    previous_coordinator_id is distinct from new_coordinator_id
  )
);
create index if not exists coordinator_assignment_history_event_idx
  on public.event_coordinator_assignment_history (event_id, assigned_at desc);

alter table public.event_coordinator_assignment_history enable row level security;
revoke all on public.event_coordinator_assignment_history from public, anon, authenticated;
grant select on public.event_coordinator_assignment_history to authenticated;
drop policy if exists coordinator_leads_read_assignment_history
  on public.event_coordinator_assignment_history;
create policy coordinator_leads_read_assignment_history
  on public.event_coordinator_assignment_history for select to authenticated
  using (public.current_user_role() = 'coordinator_lead');

create or replace function public.record_event_coordinator_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Administrator repairs are not attributed to an invented signed-in Lead.
  if auth.uid() is null or new.coordinator_id is not distinct from old.coordinator_id then
    return new;
  end if;
  if public.current_user_role() is distinct from 'coordinator_lead' then
    raise exception 'Only a Coordinator Lead may change the assignment' using errcode = '42501';
  end if;
  insert into public.event_coordinator_assignment_history (
    event_id, previous_coordinator_id, new_coordinator_id, assigned_by
  ) values (new.id, old.coordinator_id, new.coordinator_id, auth.uid());
  return new;
end $$;
revoke all on function public.record_event_coordinator_assignment() from public, anon, authenticated;
drop trigger if exists events_record_coordinator_assignment on public.events;
create trigger events_record_coordinator_assignment
  after update of coordinator_id on public.events
  for each row execute function public.record_event_coordinator_assignment();

commit;
