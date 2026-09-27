# US7 retained review history (AC13)

Review timestamps use Singapore time through the shared event formatter, independently
of the viewer's device timezone. AC-007.13.27 retains its fixed 09:00 SGT assertion
for the 01:00 UTC fixture; run it under UTC as well as Asia/Singapore.

Migration 0017 records future coordinator review actions in event_change_review_history.
It preserves the outcome, proposed values, field decisions/comments, reviewer ID/name
and time for each request version. Clarification rounds remain after replies and final
review. It does not invent history for reviews performed before migration deployment.
The existing organiser question/answer history remains separate.

The trigger writes in the review transaction: a history failure rolls back the review
and event changes. Browser users cannot insert, update or delete history. Reads are
limited to the currently assigned coordinator and Operations Manager, following the
staff-only reviewer identity convention. Direct SQL administration without an auth
identity is not recorded as a coordinator review. Deleting an event/request through
administration cascades to its history; this is not an independent archival system.

## Files changed

- backend/supabase/migrations/0017_change_request_review_history.sql: table, access rules and trigger.
- backend/supabase/tests/change_request_review_history.sql: database tests below.
- backend/supabase/tests/run_change_request_review.sh: runs tests and migration replay check.
- frontend/src/features/events/types.ts: typed historical review snapshot.
- frontend/src/features/events/eventChangeRequestService.ts: maps optional embedded history, newest version first.
- frontend/src/features/events/changeRequestReviewQueryService.ts: coordinator query embeds history in the existing snapshot.
- frontend/src/features/events/components/ChangeRequestReviewHistory.tsx: expandable history with reviewer, time and field comments.
- frontend/src/features/events/components/ChangeRequestReviewPanel.tsx: displays history below each request summary.
- frontend/src/features/events/__tests__/ChangeRequestReviewHistory.test.tsx and changeRequestReviewQueryService.test.ts: five new app tests.
- README.md and CLAUDE.md: deployment and progress notes.

## New tests

IDs below all start with AC-007.13. They follow the Jira criterion order, not subtasks.

| ID suffix | Check | Location |
| --- | --- | --- |
| 12 | All four review outcomes are retained | SQL |
| 13 | Earlier clarification survives reply and subsequent review | SQL |
| 14 | Actor identity, name and time are stored | SQL |
| 15 | Rejected proposal and explanation are saved | SQL |
| 16 | Profile renaming does not rewrite saved reviewer names | SQL |
| 17 | Other coordinator cannot read the history | SQL |
| 18 | Organiser cannot read staff identity history | SQL |
| 19 | Operations Manager can read history | SQL |
| 20 | Assigned coordinator can read history | SQL |
| 21 | Browser cannot delete history | SQL |
| 22 | Browser cannot edit history | SQL |
| 23 | Browser cannot fabricate history | SQL |
| 24 | History write failure prevents review success | SQL |
| 25 | Failure leaves event and request unchanged | SQL |
| 26 | Replaying migration preserves history | Runner |
| 27 | Display reviewer, time, saved proposal and question | UI |
| 28 | Earlier clarification and final review displayed together | UI |
| 29 | Empty display explains tracking starts at deployment | UI |
| 30 | Legacy whole-request question is displayed | UI |
| 31 | Embedded query maps and sorts history newest first | Query service |

## Manual verification after applying 0017

Apply 0017 to shared Supabase before using the updated coordinator page. Sign in as the
assigned coordinator, request clarification, then sign in as the organiser and reply.
Review again as coordinator. Expand Review decision history: both review actions should
remain, with names/times and original field comments. Clarification approvals must be
labelled provisional. A pre-migration request can have empty history until its next review.

No shared migration or live browser verification was performed by the agent this round.
Coordinator notification delivery remains a team integration dependency; an outbox row
alone does not demonstrate receipt. Organiser notifications are deferred by agreement.
