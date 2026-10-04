-- US18 Check venue suitability (SCRUM-165), slice 4: the coordinator's structured venue requirements.
-- The organiser's layout/accessibility fields are free text (US2) and cannot be matched against a
-- venue, so the assigned coordinator records a structured version here (Q&A #111).
-- Expected attendance is NOT copied: it stays on events (Q&A #119). Safe to replay.
begin;

create table if not exists public.event_venue_requirements (
  event_id      uuid primary key references public.events (id) on delete cascade,
  layout        text,
  accessibility text[] not null default '{}',
  facilities    text[] not null default '{}',
  updated_by    uuid not null references public.profiles (id),
  updated_at    timestamptz not null default now()
);

drop trigger if exists event_venue_requirements_set_updated_at on public.event_venue_requirements;
create trigger event_venue_requirements_set_updated_at
  before update on public.event_venue_requirements
  for each row execute function public.set_updated_at();

alter table public.event_venue_requirements enable row level security;
revoke all on public.event_venue_requirements from anon, authenticated;
-- No delete: clearing requirements is saving empty lists, which keeps who changed them.
grant select, insert, update on public.event_venue_requirements to authenticated;

drop policy if exists event_venue_requirements_select on public.event_venue_requirements;
create policy event_venue_requirements_select on public.event_venue_requirements
  for select to authenticated
  using (
    public.current_user_role() = 'venue_staff'
    or (
      public.current_user_role() = 'coordinator'
      and exists (select 1 from public.events e
                  where e.id = event_venue_requirements.event_id and e.coordinator_id = auth.uid())
    )
  );

-- Only the currently assigned coordinator writes, stamping themselves as the editor.
-- Keyed on the current assignment, so a reassigned coordinator loses access at once.
drop policy if exists event_venue_requirements_insert on public.event_venue_requirements;
create policy event_venue_requirements_insert on public.event_venue_requirements
  for insert to authenticated
  with check (
    public.current_user_role() = 'coordinator'
    and updated_by = auth.uid()
    and exists (select 1 from public.events e
                where e.id = event_venue_requirements.event_id and e.coordinator_id = auth.uid())
  );

drop policy if exists event_venue_requirements_update on public.event_venue_requirements;
create policy event_venue_requirements_update on public.event_venue_requirements
  for update to authenticated
  using (
    public.current_user_role() = 'coordinator'
    and exists (select 1 from public.events e
                where e.id = event_venue_requirements.event_id and e.coordinator_id = auth.uid())
  )
  with check (
    updated_by = auth.uid()
    and exists (select 1 from public.events e
                where e.id = event_venue_requirements.event_id and e.coordinator_id = auth.uid())
  );

commit;