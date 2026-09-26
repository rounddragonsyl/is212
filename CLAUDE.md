# ConnectSphere Event Planning System — Project Context

## What this is
University project (SMU IS212). Event planning and venue booking for an events company.
Roles: Event Organiser, Event Coordinator, Venue Staff, Technical Support Staff, Attendee.

## Stack
React 18 + TypeScript + Vite · Tailwind · React Hook Form + Zod
Supabase (PostgreSQL + Auth + RLS) · Vitest + React Testing Library · GitHub Actions

## Architecture rules — follow these without being asked
- Feature folders: src/features/<feature>/ with types.ts, validation.ts, <x>Service.ts,
  components/, __tests__/
- validation.ts holds PURE functions only. No React, no Supabase, no I/O.
- Only <x>Service.ts talks to Supabase. Components never import the Supabase client.
- Business rules are validated in the client (UX) AND constrained in the database
  (integrity). This is deliberate defence in depth.
- Time intervals are half-open [start, end). Touching intervals do not overlap.
- Never use NOT NULL on a field a draft may legitimately omit; use a conditional CHECK
  keyed on status instead.

## Testing
- Every test case ID has the form `AC-00X.Y.Z`:
  X = user story number from the backlog (US1-US15, not the Jira SCRUM key),
  Y = acceptance criterion, numbered in Jira bullet order,
  Z = test case number within that criterion (unpadded: .1, .2 ... .12).
  Example: test('AC-001.2.1: accepts an empty draft', ...)
- Current story numbers: US1 Save Draft (SCRUM-8), US2 Submit Event Request (SCRUM-7),
  US3 View Event Request Status (SCRUM-24), US4 Review and Approve/Reject/Return
  (SCRUM-9), US6 Organiser Requesting Changes (SCRUM-11), US7 Coordinator Reviewing
  Change Requests (SCRUM-12).
- Z is unique per criterion across the whole story, including parameterised rows and
  tests in different files. Before adding a test, use the next unused Z for that
  criterion (see README allocations); never reuse or renumber an existing ID.
- Within a file, Z must increase top to bottom for each criterion. Group tests by
  criterion and preserve setup/helper scope when rearranging tests.
- Tests with no backlog story (AC-LIFECYCLE, AC-ROLES) are pending tickets; do not add
  more ad-hoc prefixes.
- Every story needs at least one boundary, conflict or failure test.
- We must reach high coverage and be able to trace acceptance criteria to tests.
- CI provides placeholder Supabase URL/key values separately for the Test and Build
  steps. These let the client initialise during imports; they do not connect to a real
  database. US4 ReviewActions tests mock the review function but import the real service
  for its messages. Keep mocked tests from making real network calls; live integration
  tests require a separate test environment, fixtures and cleanup.

## Roles and authorisation
- Roles live in public.profiles.role, never in auth.users. Values: organiser, coordinator,
  operations_manager, venue_staff, tech_support, attendee.
- Read the caller's role in SQL with public.current_user_role(). It is SECURITY DEFINER on
  purpose: a policy on profiles that queries profiles recurses infinitely.
- Roles are assigned by an administrator, never chosen by the user. A trigger blocks a
  signed-in user from changing their own role.
- Hiding UI from a role is a courtesy. The RLS policy is the control. Every role-gated
  screen must have a matching policy, or it is not actually protected.
- dev_set_my_role() and the DevAuthPanel / DevRoleSwitcher components are scaffolding.
  Drop them before release.

## Organiser status presentation
- Use status/organiserStatusLabel.ts for event badges and submission results: submitted
  and under_review display In review; submitted with a nonblank review note displays
  Clarification required. Pass organiserView on shared badges/panels only for organisers.
- Internal states remain unchanged. US4 submitted-request decisions use the atomic
  review_submitted_event RPC from 0012 instead of a Start review button. It runs the
  existing transitions and triggers together; older under_review rows retain their
  existing path. Apply 0012 before deploying this UI. Change-request submitted
  displays In review via changeRequestDisplay.ts. Replies will return to that same label.

## Event status values
draft, submitted, under_review, approved, planning, confirmed, completed, cancelled,
rejected. Review transitions belong in eventReviewService. Explicit draft submission
belongs in eventService so validated details and status change atomically on the same
owned Draft row. Both paths use expected-status filters and database transition triggers.
Draft saves in eventDraftService must never change an existing request's status.

## Change-request database baseline
- Shared Supabase used `event_change_requests_status_valid`, not just the fresh
  baseline's `event_change_requests_status_check`. Apply `0011` after `0010` to
  consolidate these into the six-status rule. Without it, clarification and partial
  approval fail even with the current RPC. The runner reproduces the mismatch and
  checks the fix; the reply increment brings the runner to 86 database checks. Never rerun 0007 after later migrations
  as a deployment shortcut: it restores the older, broader access policies.
- `0007_event_change_requests.sql` captures the shared US6 table, policies and timestamp
  trigger. It preserves existing rows and does not implement US7 review decisions.
- US7 is Event Coordinator Reviewing Change Requests; its tests follow the standard
  `AC-00X.Y.Z` format with criteria in the agreed Jira order.
- Follow-up work must cover assigned-coordinator access, per-change decisions and
  reasons, and atomic application of accepted changes. Existing request policies are
  a baseline, not proof of secure review or withdrawal. See README for known gaps.
- Both `0005` migrations precede `0006`; their duplicate version prefix needs resolving
  before relying on CLI migration discovery. Do not silently renumber applied files.
- `changeRequestReviewValidation.ts` is pure US7 review preparation.
  Decisions cover each proposed field once; rejected fields require explanations and
  clarification_requested fields require questions. Any unresolved field makes all
  approvals provisional: no event changes apply until every field is resolved.
  Do not treat prepared values as a validated event or bypass database permissions.
  README records the 27 validator test IDs using the supplied Jira AC order.
- `changeRequestReviewService.ts` calls that validator and the existing review RPC;
  the coordinator detail page now uses it through ChangeRequestReviewPanel/Form.
  Pass the exact event `updated_at` shown to the reviewer,
  never refresh it just before saving. Only decisions/notes go to the RPC, not proposed
  values or reviewer identity. Do not automatically retry a lost review response.
  Its 23 mocked tests continue the existing AC allocations; see README. Choose the
  RPC payload by the presence of decisions, not by status: field-level clarification
  also uses action=decide. Legacy whole-request action=clarify remains supported.
- `0008_change_request_review.sql` adds coordinator assignment and the atomic review
  RPC. Only Operations Managers assign; only the assigned coordinator reviews a
  pending request with a matching event updated_at. Values come from the stored
  proposal. Submitted event details cannot be edited directly by the browser;
  US4 status transitions and US1 draft edits still work. Never apply this migration
  silently to shared Supabase. Notifications/revalidation are pending.
- `0010_change_request_field_clarification.sql` replaces the review RPC to save mixed
  provisional decisions/questions without changing the event. It still accepts only
  submitted requests. Organiser replies/resubmission are implemented in 0013, and the reply UI/history are now connected. The browser loop still needs live
  verification; never bypass the reply operation with direct status updates.
  reviewed_at/by record the review action even if clarification is still outstanding.
  Per-field questions are in field_decisions.note, not the legacy review_note.
- `changeRequestReviewQueryService.ts` loads the event, exact version and embedded
  requests together, restricted to the signed-in assigned coordinator. Review forms
  do not poll: manual reload discards unsaved choices; failed saves require reloading.
  ChangeRequestSummary exposes per-field questions/reasons and provisional decisions
  to the organiser. Status wording is shared in changeRequestDisplay.ts.
  See `docs/us7-review-ui.md` for all 37 new test cases and the file-by-file change log.
  Existing US6 confirmed-event eligibility remains a recorded follow-up.
- Database checks live in `supabase/tests/`; run
  `bash supabase/tests/run_change_request_review.sh` with Docker running. Synthetic
  fixtures and Auth helpers are for the disposable container only, not shared Supabase.
  82 US7 SQL case IDs continue the unit-test allocations (see README), with four
  additional cross-story regression checks. These tests are separate from Vitest/CI.

## Review decisions and email (US4)
- `0009_review_decisions.sql`: `event_review_decisions` is the retained AC-004.5 record and
  `notification_outbox` queues AC-004.4 emails. Both are written only by the AFTER UPDATE
  trigger `record_event_review_decision`, using auth.uid() as the actor. Never add a
  client insert path or a write policy to either table.
- The decision log is staff-only (coordinator, operations_manager); reviewer identity stays
  internal. The outbox is service-role only.
- Emails are sent by the Edge Function `supabase/functions/send-review-notifications`
  (Deno, not part of the Vite build). Provider keys live in Supabase secrets, never `VITE_`.
- Database checks: `supabase/tests/review_decisions_test.sql`, disposable databases only.

## House style
- No `any`. Prefer explicit types.
- Comment *why*, not *what*. We are examined orally on our design decisions.
- Small components. Extract when a file passes ~150 lines.

## Out of scope for the first release
Reporting, analytics, recurring events, multi-session events, dashboards.

## Organiser clarification reply increment
- `0013_change_request_replies.sql` follows 0011; 0012 is reserved in another PR and
  is not a dependency. Apply 0013 before deploying the readers of review_version.
  Jaydon reported applying 0013 to shared Supabase on 27 September. Live UI checks remain.
- Only the owning organiser may call reply_to_change_request. All outstanding field
  questions require answers; legacy whole-request questions accept a note. Answers
  cannot edit proposed values. The request returns to submitted, the event stays unchanged.
- review_version increments on every request update. Pass the displayed version to
  reply and review calls; never refresh it silently before writing. Requests with reply
  history cannot be reviewed by an old client that omits the version.
- reply_history retains questions/answers/actors/times per reply round. It is not yet
  the complete US7 activity log. Reply form/history UI are connected; live verification remains pending.
- See docs/us7-reply-preparation.md for each changed file and new test case.
  Reply validation: AC-007.7.37–47; reply service: .48–56; SQL replies: .57–66,
  plus AC-007.2.32–35, .8.3, .9.17, .13.7–8. Review-service tests: .5.39–40.

- Reply UI: ChangeRequestReplyForm is owner-only in ChangeRequestList, for clarification
  status only. No polling/focus refresh in that list while typing. Explicit reload discards
  text; failed writes retain text and lock retry until reload. Other status panels still poll.
- ChangeRequestReplyHistory is shared through ChangeRequestSummary by organiser and
  coordinator. Query services select reply_history and map missing fixture values to [].
  Do not replace retained questions with the latest field_decisions when rendering history.
- UI tests: AC-007.7.67–74 form, .75–77 list; AC-007.13.9 coordinator panel,
  .13.10–11 shared history. Existing AC-007.3.1 also verifies history mapping.
  349 app tests; database suite unchanged at 86. See docs/us7-reply-preparation.md.
