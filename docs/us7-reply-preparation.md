# Organiser reply preparation (26 September)

`src/features/events/changeRequestReplyValidation.ts` prepares answers without I/O.
Every field marked clarification_requested needs exactly one nonblank answer; reply
input cannot change proposed values or review decisions. Older whole-request questions
use a single note. `changeRequestReplyTypes.ts` defines the reply/result types. The reply service and database operation are now implemented, but no reply UI is connected.
Migration 0013 verifies ownership and the displayed request version, preserves the
question/answer history, and returns the request to submitted without changing the event.
It has not been applied to shared Supabase. Apply it after 0011 before loading the new
version-aware queries; 0012 is reserved for the separate pending US4 PR.


All 11 tests live in `src/features/events/__tests__/changeRequestReplyValidation.test.ts`:

| ID | Check |
| --- | --- |
| AC-007.7.37 | Separate answers are trimmed and returned in question order. |
| AC-007.7.38 | Missing answers are rejected. |
| AC-007.7.39 | Duplicate answers cannot replace a missing answer. |
| AC-007.7.40 | Answers for fields without questions are rejected. |
| AC-007.7.41 | Whitespace-only answers are rejected. |
| AC-007.7.42 | Reply input cannot include changes to proposed event values. |
| AC-007.7.43 | Requests already returned for review cannot accept another reply. |
| AC-007.7.44 | Inconsistent saved decisions are rejected. |
| AC-007.7.45 | Legacy whole-request clarification accepts a trimmed text answer. |
| AC-007.7.46 | Legacy clarification also requires a nonblank answer. |
| AC-007.7.47 | Validation preserves proposals, questions, provisional decisions and input. |


## Files changed in this increment

- `changeRequestReplyService.ts`: validates answers, checks sign-in and calls the reply RPC;
  translates failures into user messages without retrying an uncertain save.
- `0013_change_request_replies.sql`: adds the version counter/history and protected reply
  operation. Replaces the existing review function to check the request version too;
  most of that function is unchanged from 0010.
- `types.ts`, `eventChangeRequestService.ts`, `changeRequestReviewQueryService.ts`:
  read/map the request version. `changeRequestReviewService.ts` sends it with decisions.
- `run_change_request_review.sh`: restores the newest RPC after earlier migration replay
  checks, runs reply checks and checks migration replay preserves saved replies.
- README/CLAUDE: setup, behavior, test allocations and unfinished UI work.

## Additional automated cases

`src/features/events/__tests__/changeRequestReplyService.test.ts`:

| ID | Check |
| --- | --- |
| AC-007.7.48 | Trimmed answers and displayed version are sent; no client actor/event values. |
| AC-007.7.49 | Missing answers prevent an RPC call. |
| AC-007.7.50 | Missing version requires reloading. |
| AC-007.7.51 | Missing session prevents saving. |
| AC-007.7.52 | Stale request response asks for reload. |
| AC-007.7.53 | Another pending request produces a useful conflict message. |
| AC-007.7.54 | Permission denial produces a safe message. |
| AC-007.7.55 | Lost response is not automatically retried. |
| AC-007.7.56 | Unexpected response is not reported as success. |

`changeRequestReviewService.test.ts`: AC-007.5.39 sends the displayed request version;
AC-007.5.40 maps a stale request to the reload message.
Existing query case AC-007.3.1 also verifies that the loaded version survives mapping.

`supabase/tests/change_request_replies.sql` (real disposable PostgreSQL):

| ID | Check |
| --- | --- |
| AC-007.2.32 | Coordinator cannot reply as the organiser. |
| AC-007.2.33 | Another organiser cannot reply. |
| AC-007.2.34 | Missing identity cannot reply. |
| AC-007.2.35 | Browser cannot overwrite answer history directly. |
| AC-007.7.57 | Missing field answer rejected. |
| AC-007.7.58 | Blank answer rejected. |
| AC-007.7.59 | Duplicate answers rejected. |
| AC-007.7.60 | Proposed-value injection rejected. |
| AC-007.7.61 | Stale reply version rejected. |
| AC-007.7.62 | Complete replies return the request to review. |
| AC-007.7.63 | Repeated save cannot duplicate an answer. |
| AC-007.7.64 | Old review client cannot overwrite an answered request. |
| AC-007.7.65 | Stale coordinator version rejected even though the event is unchanged. |
| AC-007.7.66 | Later legacy whole-request clarification accepts an answer. |
| AC-007.8.3 | All event columns stay unchanged throughout clarification rounds. |
| AC-007.9.17 | Final review applies accepted values only. |
| AC-007.13.7 | Both rounds retain questions, answers, actors and timestamps readable by owner. |

The runner also checks AC-007.13.8: replaying 0013 preserves all request rows and history.

## Remaining work

Build the organiser reply form and coordinator answer-history display, then demonstrate
that loop against shared Supabase. Notifications, significance/revalidation and complete
activity history are separate remaining US7 work. Do not mark the story complete yet.
