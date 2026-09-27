-- US7 AC12: integration hook only. No booking cancellation, worker or lifecycle change.
-- Apply after 0013. Only final accepted significant fields create a pending record.
begin;

create table if not exists public.event_change_revalidations (
  change_request_id uuid primary key references public.event_change_requests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  approved_fields text[] not null check (cardinality(approved_fields) > 0),
  venue_required boolean not null,
  equipment_required boolean not null,
  status text not null default 'pending' check (status in ('pending')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (venue_required or equipment_required)
);
create index if not exists event_change_revalidations_event_idx
  on public.event_change_revalidations(event_id);
alter table public.event_change_revalidations enable row level security;
revoke all on public.event_change_revalidations from public, anon, authenticated;
grant select on public.event_change_revalidations to authenticated;
drop policy if exists staff_read_change_revalidations on public.event_change_revalidations;
create policy staff_read_change_revalidations on public.event_change_revalidations
for select to authenticated using (
  public.current_user_role() = 'operations_manager'
  or (public.current_user_role() = 'coordinator' and exists (
    select 1 from public.events e where e.id=event_change_revalidations.event_id and e.coordinator_id=auth.uid()
  ))
);

create or replace function public.queue_change_request_revalidation()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  accepted text[];
  venue_needed boolean;
  equipment_needed boolean;
begin
  if old.status <> 'submitted' or new.status not in ('approved','partially_approved') then
    return new;
  end if;
  -- Derive from the saved decisions and proposal, never a browser-supplied flag.
  select array_agg(d->>'field' order by d->>'field') into accepted
    from jsonb_array_elements(coalesce(new.field_decisions,'[]'::jsonb)) d
    where d->>'decision'='approved'
      and new.proposed_changes ? (d->>'field')
      and d->>'field' in ('proposedStart','proposedEnd','expectedAttendance',
        'layoutPreference','accessibilityRequirements','equipmentRequirements');
  if accepted is null then return new; end if;
  venue_needed := accepted && array['proposedStart','proposedEnd','expectedAttendance','layoutPreference','accessibilityRequirements'];
  equipment_needed := accepted && array['proposedStart','proposedEnd','expectedAttendance','equipmentRequirements'];
  insert into public.event_change_revalidations
    (change_request_id,event_id,approved_fields,venue_required,equipment_required,created_by)
    values (new.id,new.event_id,accepted,venue_needed,equipment_needed,new.reviewed_by);
  return new;
end $$;
revoke all on function public.queue_change_request_revalidation() from public, anon, authenticated;
drop trigger if exists event_change_requests_queue_revalidation on public.event_change_requests;
create trigger event_change_requests_queue_revalidation after update on public.event_change_requests
for each row execute function public.queue_change_request_revalidation();
commit;
