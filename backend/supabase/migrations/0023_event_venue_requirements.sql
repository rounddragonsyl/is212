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

commit;