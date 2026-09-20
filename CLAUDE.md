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
- Name each test case with its requirement ID and a unique case suffix:
  test('AC-001.2-01: accepts an empty draft', ...)
- Save Draft Event Request is US-001; AC-001.1 through AC-001.6 follow Jira order.
  Case IDs must stay unique across the story, including parameterised rows. Preserve
  existing case IDs when adding tests. Group tests by criterion and sort numerically
  by story, criterion, then case number within each file. Preserve setup/helper scope
  when rearranging tests. See README for the current allocations.
- Every story needs at least one boundary, conflict or failure test.
- We must reach high coverage and be able to trace acceptance criteria to tests.

## Roles and authorisation
- Roles live in public.profiles.role, never in auth.users. Values: organiser, coordinator,
  venue_staff, tech_support, attendee.
- Read the caller's role in SQL with public.current_user_role(). It is SECURITY DEFINER on
  purpose: a policy on profiles that queries profiles recurses infinitely.
- Roles are assigned by an administrator, never chosen by the user. A trigger blocks a
  signed-in user from changing their own role.
- Hiding UI from a role is a courtesy. The RLS policy is the control. Every role-gated
  screen must have a matching policy, or it is not actually protected.
- dev_set_my_role() and the DevAuthPanel / DevRoleSwitcher components are scaffolding.
  Drop them before release.

## Event status values
draft, submitted, under_review, approved, planning, confirmed, completed, cancelled,
rejected. Review transitions belong in eventReviewService. Explicit draft submission
belongs in eventService so validated details and status change atomically on the same
owned Draft row. Both paths use expected-status filters and database transition triggers.
Draft saves in eventDraftService must never change an existing request's status.

## Change-request database baseline
- `0007_event_change_requests.sql` captures the shared US6 table, policies and timestamp
  trigger. It preserves existing rows and does not implement US7 review decisions.
- US7 is Event Coordinator Reviewing Change Requests. Use the agreed `AC-007.Y.Z`
  test naming format for new tests, with criteria in the agreed Jira order.
- Follow-up work must cover assigned-coordinator access, per-change decisions and
  reasons, and atomic application of accepted changes. Existing request policies are
  a baseline, not proof of secure review or withdrawal. See README for known gaps.
- Both `0005` migrations precede `0006`; their duplicate version prefix needs resolving
  before relying on CLI migration discovery. Do not silently renumber applied files.

## House style
- No `any`. Prefer explicit types.
- Comment *why*, not *what*. We are examined orally on our design decisions.
- Small components. Extract when a file passes ~150 lines.

## Out of scope for the first release
Reporting, analytics, recurring events, multi-session events, dashboards.
