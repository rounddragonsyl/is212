-- US10 / SCRUM-17, AC8: a rejected venue booking needs a recorded reason.
begin;

alter table public.venue_bookings
  drop constraint if exists venue_bookings_rejection_reason_required;
alter table public.venue_bookings
  add constraint venue_bookings_rejection_reason_required
  check (
    status <> 'rejected'
    or (review_note is not null and review_note ~ '[^[:space:]]')
  ) not valid;

-- NOT VALID preserves legacy rows without inventing historical reasons, while
-- PostgreSQL still enforces the rule on every new insert/update.
commit;
