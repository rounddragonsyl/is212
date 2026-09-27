-- 0002_submitted_requires_end.sql
--
-- Closes a gap between the two halves of our defence in depth: validation.ts requires a
-- preferred end time before it will submit, but 0001's CHECK did not, so a caller posting
-- straight to PostgREST could store a submitted event with no end time.
--
-- A booking needs an interval, not just a start — every later story (venue suitability,
-- booking conflict detection) reads [proposed_start, proposed_end) and would have to
-- special-case a null end for rows the UI can never produce.
--
-- Still keyed on status, so US-004 drafts remain free to omit it.

alter table public.events
  drop constraint if exists submitted_requires_core_fields;

alter table public.events
  add constraint submitted_requires_core_fields check (
    status = 'draft' or (
      purpose is not null and btrim(purpose) <> ''
      and proposed_start is not null
      and proposed_end is not null
      and expected_attendance is not null
    )
  );
