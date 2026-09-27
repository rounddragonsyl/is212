-- Capture the existing US6 table before adding US7 coordinator review behaviour.
-- Based on the shared Supabase schema/policy/trigger exports (21 September 2026).
-- Apply after 0006. Existing rows are preserved; an existing table is not reshaped.
begin;

create table if not exists public.event_change_requests (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id),
  organiser_id     uuid not null references public.profiles (id),
  proposed_changes jsonb not null check (proposed_changes <> '{}'::jsonb),
  reason           text not null check (btrim(reason) <> ''),
  status           text not null default 'submitted' check (
    status in ('submitted', 'approved', 'rejected', 'withdrawn')
  ),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  submitted_at     timestamptz not null default now(),
  reviewed_by      uuid references public.profiles (id),
  reviewed_at      timestamptz,
  review_note      text
);

drop trigger if exists event_change_requests_set_updated_at
  on public.event_change_requests;
create trigger event_change_requests_set_updated_at
  before update on public.event_change_requests
  for each row execute function public.set_updated_at();

alter table public.event_change_requests enable row level security;

-- Explicit privileges make fresh setup independent of dashboard default grants.
-- RLS below determines which rows these operations may reach.
grant select, insert, update on public.event_change_requests to authenticated;

drop policy if exists organisers_select_own_change_requests on public.event_change_requests;
create policy organisers_select_own_change_requests on public.event_change_requests
  for select to authenticated
  using (organiser_id = auth.uid());

-- Preserve the existing all-coordinator read scope for this baseline. US7 must
-- restrict review access once coordinator assignment is represented in the schema.
-- Use the existing role helper, as required by the project's RLS convention.
drop policy if exists coordinators_select_all_change_requests on public.event_change_requests;
create policy coordinators_select_all_change_requests on public.event_change_requests
  for select to authenticated
  using (public.current_user_role() = 'coordinator');

drop policy if exists organisers_insert_own_change_requests on public.event_change_requests;
create policy organisers_insert_own_change_requests on public.event_change_requests
  for insert to authenticated
  with check (
    organiser_id = auth.uid()
    and exists (
      select 1 from public.events
      where events.id = event_change_requests.event_id
        and events.organiser_id = auth.uid()
    )
  );

drop policy if exists organisers_withdraw_own_change_requests on public.event_change_requests;
create policy organisers_withdraw_own_change_requests on public.event_change_requests
  for update to authenticated
  using (organiser_id = auth.uid() and status = 'submitted')
  with check (organiser_id = auth.uid() and status = 'withdrawn');

-- These reproduce the supplied baseline, not complete US6/US7 protections.
-- They do not validate event eligibility, prevent duplicate submitted requests,
-- restrict which other columns can change during withdrawal, or guard review fields
-- on insert. No coordinator write policy or event-update action is added here.
commit;
