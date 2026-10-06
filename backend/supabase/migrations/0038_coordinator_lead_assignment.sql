-- US17 slice 1: Coordinator Lead role and assignment permissions.
-- First increment: accept the role without changing existing accounts or permissions.
begin;

alter table public.profiles drop constraint if exists profiles_role_valid;
alter table public.profiles add constraint profiles_role_valid check (
  role in ('organiser', 'coordinator', 'coordinator_lead', 'operations_manager',
           'venue_staff', 'tech_support', 'attendee')
);

commit;
