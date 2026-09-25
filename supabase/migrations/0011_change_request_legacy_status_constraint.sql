-- The shared US6 table used status_valid; 0007's fresh table uses status_check.
-- 0008 replaced only status_check, leaving the live four-status rule in force.
-- Keep one canonical constraint. Preserve every row and all access policies.
begin;

alter table public.event_change_requests
  drop constraint if exists event_change_requests_status_valid;
alter table public.event_change_requests
  drop constraint if exists event_change_requests_status_check;
alter table public.event_change_requests
  add constraint event_change_requests_status_check
  check (status in ('submitted', 'approved', 'partially_approved', 'rejected',
                   'clarification_requested', 'withdrawn'));

commit;
