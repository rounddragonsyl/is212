-- US13 (SCRUM-19): the assigned Event Coordinator records equipment requirements for an
-- approved event. Apply after 0023; it depends on 0019, which provides the catalogue and reservation tables.
--
-- Recording is deliberately separate from reserving (AC-013.5). A requirement is a line on
-- the Coordinator's list; US14 reserves units against it through 0019's booking lines and
-- allocations, then links the line back here with booking_line_id. Until then every line
-- is pending review and nothing in this migration creates a booking or allocation.
begin;

create table if not exists public.event_equipment_requirements (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete cascade,
  type_id         uuid not null references public.equipment_types (id),
  quantity        integer not null check (quantity >= 1),
  technical_notes text,
  -- The Coordinator's own judgement; drives the "non-essential" display (AC-013.3).
  essential       boolean not null default true,
  -- Set only by this migration's triggers or by reservation work (US14), never the browser.
  status          text not null default 'pending_review'
    check (status in ('pending_review', 'reserved', 'partially_reserved', 'unavailable')),
  -- The US14 hook: the booking line whose allocations hold units for this requirement.
  booking_line_id uuid references public.equipment_booking_lines (id) on delete set null,
  created_by      uuid not null default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists event_equipment_requirements_event_id_idx
  on public.event_equipment_requirements (event_id);

-- Removal notices must outlive the requirement they describe, so requirement_id has no
-- foreign key and the type name and quantity are copied at the time of the change.
create table if not exists public.equipment_requirement_notifications (
  id             uuid primary key default gen_random_uuid(),
  requirement_id uuid,
  event_id       uuid not null references public.events (id) on delete cascade,
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  action         text not null check (action in ('added', 'changed', 'removed')),
  type_name      text not null,
  quantity       integer not null,
  created_at     timestamptz not null default now()
);
create index if not exists equipment_requirement_notifications_recipient_idx
  on public.equipment_requirement_notifications (recipient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Column grants: the browser writes only what the Coordinator decides
-- ---------------------------------------------------------------------------
-- Status, the reservation link, the creator and the event are not grantable, so a direct
-- PostgREST call cannot mark a line reserved, fake a reservation, write in another user's
-- name or move a line to another event. Policies cannot express "this column only".
revoke all on public.event_equipment_requirements from public, anon, authenticated;
grant select, delete on public.event_equipment_requirements to authenticated;
grant insert (event_id, type_id, quantity, technical_notes, essential)
  on public.event_equipment_requirements to authenticated;
grant update (type_id, quantity, technical_notes, essential)
  on public.event_equipment_requirements to authenticated;

-- Notifications are written only by the trigger below; the browser may only read its own.
revoke all on public.equipment_requirement_notifications from public, anon, authenticated;
grant select on public.equipment_requirement_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Relationship checks used by policies
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER for the same reason as current_user_role(): the requirement policies
-- read events and the events policy reads requirements, which would recurse under RLS.
create or replace function public.is_assigned_event_coordinator(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_role() = 'coordinator'
    and exists (select 1 from public.events e where e.id = p_event_id and e.coordinator_id = auth.uid());
$$;
revoke all on function public.is_assigned_event_coordinator(uuid) from public, anon;
grant execute on function public.is_assigned_event_coordinator(uuid) to authenticated;

-- Technical Support needs the event behind a requirement or notification, but no others.
create or replace function public.is_equipment_event_for_tech_support(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_role() = 'tech_support' and (
    exists (select 1 from public.event_equipment_requirements r where r.event_id = p_event_id)
    or exists (select 1 from public.equipment_requirement_notifications n
               where n.event_id = p_event_id and n.recipient_id = auth.uid()));
$$;
revoke all on function public.is_equipment_event_for_tech_support(uuid) from public, anon;
grant execute on function public.is_equipment_event_for_tech_support(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security (SCRUM-127)
-- ---------------------------------------------------------------------------
alter table public.event_equipment_requirements enable row level security;
alter table public.equipment_requirement_notifications enable row level security;

drop policy if exists equipment_requirements_select on public.event_equipment_requirements;
create policy equipment_requirements_select on public.event_equipment_requirements
  for select to authenticated
  using (public.current_user_role() = 'tech_support' or public.is_assigned_event_coordinator(event_id));

drop policy if exists equipment_requirements_insert on public.event_equipment_requirements;
create policy equipment_requirements_insert on public.event_equipment_requirements
  for insert to authenticated
  with check (public.is_assigned_event_coordinator(event_id));

drop policy if exists equipment_requirements_update on public.event_equipment_requirements;
create policy equipment_requirements_update on public.event_equipment_requirements
  for update to authenticated
  using (public.is_assigned_event_coordinator(event_id))
  with check (public.is_assigned_event_coordinator(event_id));

drop policy if exists equipment_requirements_delete on public.event_equipment_requirements;
create policy equipment_requirements_delete on public.event_equipment_requirements
  for delete to authenticated
  using (public.is_assigned_event_coordinator(event_id));

drop policy if exists equipment_notifications_select_own on public.equipment_requirement_notifications;
create policy equipment_notifications_select_own on public.equipment_requirement_notifications
  for select to authenticated
  using (recipient_id = auth.uid() and public.current_user_role() = 'tech_support');

drop policy if exists events_select_for_tech_support on public.events;
create policy events_select_for_tech_support on public.events
  for select to authenticated
  using (public.is_equipment_event_for_tech_support(id));

-- ---------------------------------------------------------------------------
-- Releasing reserved units (SCRUM-131)
-- ---------------------------------------------------------------------------
-- 0019 already models reservations, so release goes through it: cancel the line's
-- 'reserved' allocations and 0019's trigger recounts quantity_reserved. Cancelling keeps
-- the history. Checked-out or returned units describe physical equipment and stay as they
-- are. Coordinators have no access to allocations, hence SECURITY DEFINER, and no grant.
create or replace function public.release_equipment_for_line(p_line_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.equipment_allocations set status = 'cancelled'
  where line_id = p_line_id and status = 'reserved';
$$;
revoke all on function public.release_equipment_for_line(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Approved events only, and reserved lines return to pending review (SCRUM-130)
-- ---------------------------------------------------------------------------
-- A trigger rather than a policy so the refusal has its own message and code (22000),
-- distinct from "not your event" (42501). It runs before RLS's WITH CHECK on insert.
-- No JWT means an administrator or reservation work, which this does not stand in front of.
create or replace function public.guard_equipment_requirement_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  event_status text;
begin
  if auth.uid() is not null then
    select status into event_status from public.events where id = coalesce(new.event_id, old.event_id);
    if event_status is null or event_status not in ('approved', 'planning', 'confirmed') then
      raise exception 'Equipment requirements can only be changed for approved events'
        using errcode = '22000';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- Held units were chosen for the old type and quantity, so they no longer fit: release
  -- them and send the line back for review. Notes or the essential flag do not affect fit.
  if tg_op = 'UPDATE' and old.status in ('reserved', 'partially_reserved')
     and (new.type_id is distinct from old.type_id or new.quantity is distinct from old.quantity) then
    perform public.release_equipment_for_line(old.booking_line_id);
    new.status := 'pending_review';
    new.booking_line_id := null;
  end if;
  return new;
end $$;
revoke all on function public.guard_equipment_requirement_change() from public, anon, authenticated;

drop trigger if exists event_equipment_requirements_guard on public.event_equipment_requirements;
create trigger event_equipment_requirements_guard
  before insert or update or delete on public.event_equipment_requirements
  for each row execute function public.guard_equipment_requirement_change();

-- After the delete, so units are released only when the row is really gone.
create or replace function public.release_removed_equipment_requirement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.booking_line_id is not null then
    perform public.release_equipment_for_line(old.booking_line_id);
  end if;
  return null;
end $$;
revoke all on function public.release_removed_equipment_requirement() from public, anon, authenticated;

drop trigger if exists event_equipment_requirements_release on public.event_equipment_requirements;
create trigger event_equipment_requirements_release
  after delete on public.event_equipment_requirements
  for each row execute function public.release_removed_equipment_requirement();

drop trigger if exists event_equipment_requirements_set_updated_at on public.event_equipment_requirements;
create trigger event_equipment_requirements_set_updated_at
  before update on public.event_equipment_requirements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notify every Technical Support user (SCRUM-132)
-- ---------------------------------------------------------------------------
-- Only Coordinator-controlled fields count as a change. A status set by reservation work
-- is Technical Support's own action and would only echo back to them.
create or replace function public.notify_equipment_requirement_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  changed public.event_equipment_requirements;
  v_action text;
begin
  if tg_op = 'INSERT' then
    changed := new; v_action := 'added';
  elsif tg_op = 'DELETE' then
    -- A cascade from a deleted event leaves nothing to notify about.
    if not exists (select 1 from public.events where id = old.event_id) then return null; end if;
    changed := old; v_action := 'removed';
  else
    if (new.type_id, new.quantity, new.technical_notes, new.essential)
       is not distinct from (old.type_id, old.quantity, old.technical_notes, old.essential) then
      return null;
    end if;
    changed := new; v_action := 'changed';
  end if;

  insert into public.equipment_requirement_notifications
    (requirement_id, event_id, recipient_id, action, type_name, quantity)
  select changed.id, changed.event_id, p.id, v_action, t.name, changed.quantity
  from public.profiles p
  join public.equipment_types t on t.id = changed.type_id
  where p.role = 'tech_support';
  return null;
end $$;
revoke all on function public.notify_equipment_requirement_change() from public, anon, authenticated;

drop trigger if exists event_equipment_requirements_notify on public.event_equipment_requirements;
create trigger event_equipment_requirements_notify
  after insert or update or delete on public.event_equipment_requirements
  for each row execute function public.notify_equipment_requirement_change();

commit;
