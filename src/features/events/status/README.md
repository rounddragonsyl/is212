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
| AC-24.3: clearly identify current status | `RequestStatusPanel` reuses all nine existing status labels; component tests |
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

Apply migrations 0001 through 0005 in order. `0005_request_status.sql` tightens
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
