# SCRUM-24 - View Event Request Status

This folder contains the status panel, refresh hook and their tests. It extends the
existing `events` feature, shared request routes and Supabase service rather than
creating a second application or a separate backend.

## Requirements and implementation

The six description bullets in SCRUM-24.doc are numbered AC-24.1 through AC-24.6
locally for test traceability; the export does not assign acceptance criterion IDs.

| Criterion | Implementation / verification |
| --- | --- |
| AC-24.1: view accessible request status | Existing `/requests` and `/requests/:id`, including organiser drafts; service tests |
| AC-24.2: see updates | `useRequestResource`: initial read, 30-second polling, focus and manual refresh; hook tests |
| AC-24.3: clearly identify current status | `RequestStatusPanel` shows organisers In review for submitted/under_review, and Clarification required for a returned request; internal states are unchanged; component tests |
| AC-24.4: show rejection/return reasons | Shared `review_note`, with fallback for missing legacy rejection notes; component tests |
| AC-24.5: outstanding clarification/amendment | Submitted request with a nonblank review note; component tests |
| AC-24.6: restrict requests/internal data | Migration 0005, explicit service projection, missing/forbidden response, account-change and revoked-access tests |

## Existing workflow

A coordinator returns a request by moving `under_review` to `submitted` with a
shared review note. That note is the current outstanding clarification/amendment
request. Starting the next review through the existing service clears the note.
The existing schema supports one current review note, not separate amendment
items or a history. This story displays that existing workflow; it does not add
an amendment submission or resolution workflow. `review_note` is explicitly
organiser-facing in the existing coordinator UI; `reviewed_by` is internal.

## Database setup

Apply migrations 0001 through 0004, then the required 0005 scripts through the
Supabase SQL Editor if they have not already been applied. This branch contains
both `0005_profile_on_signup.sql` and `0005_request_status.sql`: their duplicate
version prefix must be reconciled with the team's remote migration history before
using CLI migration push. Do not blindly rename an already recorded migration. `0005_request_status.sql` tightens
owner reads to organisers, hides drafts from coordinators, restricts API SELECT
to public-facing columns and requires a reason for rejection/return transitions.
Internal reviewer identity is unavailable to browser clients (including the
coordinator UI, which does not consume it). Server/admin access is unchanged.
New columns require an explicit read grant. Browser `select('*')` is intentionally
unsupported; existing application queries use explicit projections.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`.
With migrations applied in a test Supabase project, verify with two organisers
and a coordinator: each organiser sees only their own drafts/requests, another
owner's detail URL returns unavailable, coordinators cannot read drafts, and
an authenticated direct SELECT of `reviewed_by` is refused. Return/reject a
request with a reason and verify the owner sees it after refresh; a blank reason
must fail even via the database API. Unit tests mock Supabase and do not prove
live database policy enforcement.


## Review against the expanded story (19 September 2026)

- Existing owner RLS covers the responsible organiser and denies other organisers,
  including those in unrelated organisations. `profiles.client_org_id` exists,
  but no same-organisation event read policy exists. This feature does not add
  one or widen any update permissions (expanded AC 6-8).
- Status and shared reasons come from the existing Supabase/PostgREST reads.
  Status explanations distinguish Approved/Planning from Confirmed and explain
  returned requests without adding a clarification status.
- Malformed UUIDs return the same unavailable message as missing/forbidden IDs.
- Refresh clicks during a pending read queue one follow-up read, including when
  the existing coordinator decision completes during polling.
- All nine existing statuses and transition rules are preserved. The project does
  not yet represent Withdrawn or Postponed separately. The existing workflow uses
  Cancelled for organiser withdrawal; separate state persistence/transitions must
  be agreed with the lifecycle story owner. This feature cannot display separate
  states that the database does not support. No coordinator actions were added.
- No schema or migration changes were made during this review. The existing
  migration's role/ownership checks and internal-column grants were inspected;
  mocked service tests are not evidence of live RLS enforcement.

Existing test files were extended only. Test IDs from the original six-bullet
export are retained; added cases use unique suffixes. The expanded eight-bullet
request is described above without renumbering existing test cases.

### Manual checks

1. Run `npm run dev`, sign in as the responsible organiser, and open a request
   through My requests. Check its badge against the database status.
2. In another session use the existing coordinator review actions. On the organiser
   page check manual refresh, returning focus, and the next 30-second refresh.
3. Check Approved says arrangements are being prepared and is not yet Confirmed.
4. Reject or return a request with a note; verify the reason/follow-up is visible.
5. As a different organiser in another organisation, paste the same request URL
   and query that ID through the authenticated API: no event must be returned.
   Repeat with a same-organisation non-owner; current policies also deny access.
6. Try a malformed ID and an absent but valid UUID: both should be unavailable.
7. Verify organisers have no coordinator decision buttons, and API selection of
   `reviewed_by` is denied. These live checks require migrated test data/accounts.


## Operations manager and lifecycle actions

Migration `0006_operations_manager.sql` adds the sixth role, `operations_manager`.
Apply it after both 0005 scripts using the SQL Editor; reconcile the existing
0005 version collision before CLI migration push. Assign the role through an
administrator, or the existing development role switcher during development.

The manager can view non-draft event requests through Requests and the home page,
but cannot change event status. Coordinator assignment/reassignment is still a
separate story. No manager assignment workflow or new lifecycle states were added.

Coordinators now see Start planning (Approved), Confirm event (Planning), Mark
completed (Confirmed), and Cancel event for active submitted events. Cancellation
asks for confirmation. Drafts remain private; completed, cancelled and rejected
requests have no actions. These buttons use the existing guarded status service
and optimistic concurrency filter. Organisers and other roles receive no new
lifecycle controls. Confirming readiness and event completion are coordinator
judgements: venue/equipment checks and date-based completion gates are not automated.

The migration also requires the organiser role for owner insert/update access,
so an owner switched to manager/staff cannot retain organiser write privileges.
Test with organiser, coordinator and manager accounts: run an event through
Approved -> Planning -> Confirmed -> Completed; cancel a separate active event;
check manager read access and denial of direct API writes, including on a request
they owned before changing roles. Database policy checks still need a live project.
