# Direct event-request decisions — 26 September

The same open status-label PR now removes the coordinator's Start review button.
Submitted requests offer Approve, Reject and Return for more detail immediately.
This is US4 initial event review; US7 change-request review already worked directly.

## Files and behaviour

- `src/features/events/statusRules.ts`: removes the Start review action and permits
  coordinator direct decisions as compound actions. Direct table transition rules
  remain unchanged; organisers gain no approval permission.
- `src/features/events/eventReviewService.ts`: uses one `review_submitted_event` RPC
  for submitted-request decisions and requires reasons for rejection/clarification.
  Existing under_review and later lifecycle operations keep their existing path.
- `supabase/migrations/0012_review_submitted_event.sql`: checks the actual coordinator
  role, locks a submitted event, then performs submitted → under_review → decision
  in one transaction. Existing RLS, transition/reason guards, audit and email triggers
  still run. Failure rolls back both updates. Existing rows are not migrated.
- Three existing tests updated: `statusRules.test.ts` AC-004.2.14 and
  `ReviewActions.test.tsx` AC-004.2.22 now expect direct buttons; `eventReviewService.test.ts`
  AC-004.2.18 now uses draft → approved as the forbidden transition.
- The existing database test runner includes `direct_event_review.sql`.
- README and CLAUDE describe the new workflow and deployment prerequisite.

## New tests

`src/features/events/__tests__/directEventReview.test.ts` adds six mocked cases:

| ID | Check |
| --- | --- |
| AC-004.2.27 | Direct approval uses one RPC, without browser table updates. |
| AC-004.2.28 | Direct rejection uses one RPC. |
| AC-004.2.29 | Direct return for clarification uses one RPC. |
| AC-004.2.30 | Stale request failure produces no fallback write. |
| AC-004.3.6 | Clarification requires a reason before contacting the database. |
| AC-004.3.7 | Rejection requires a reason before contacting the database. |

`backend/supabase/tests/direct_event_review.sql` adds nine real PostgreSQL checks:

| ID | Check |
| --- | --- |
| AC-004.2.31 | Organiser cannot call coordinator review. |
| AC-004.2.32 | Coordinator can approve a submitted request directly. |
| AC-004.2.33 | An already decided event cannot be overwritten. |
| AC-004.2.34 | Failure during the second update is reported. |
| AC-004.2.35 | That failure leaves the original submitted status and review stamp intact. |
| AC-004.3.8 | Database rejects clarification with a blank reason. |
| AC-004.3.9 | Direct clarification saves the organiser-visible question. |
| AC-004.4.6 | Approval/rejection each queue their email, without sending live emails. |
| AC-004.5.13 | Each decision has one audit record; clarification retains actor/reason. |

Verified locally: 330 application tests (including 11 uncommitted reply-preparation
tests), 77 disposable database checks, build and lint pass. The existing bundle-size
warning remains. This PR without the unfinished reply tests has 319 application tests.

## Deployment and review

Apply **0012 only**, after the previously applied 0011, to the team's shared Supabase
before using the direct-decision UI. This migration has not been applied there by
the assistant. Do not rerun old migrations. Verify approval, rejection and clarification
using test events, with the relevant US4 teammate reviewing the change.

Commit and push to the same source branch to update the existing open PR. The
unfinished organiser reply types, validator, tests and notes are a separate change.
