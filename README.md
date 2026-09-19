# ConnectSphere — Event Planning and Venue Booking

SMU IS212 team project. React + TypeScript front end on Supabase (PostgreSQL, Auth, Row
Level Security).

Implemented so far: **US-005 — submit an event request**.

In progress: **Save Draft Event Request**. Draft validation and the save/update
service are connected to Save Draft on the event form. Repeated saves reuse the draft ID,
and explicit submission updates that same request. My Drafts lists saved drafts and
opens them in the existing form for editing. Automated tests use mocks; browser/live
database verification and draft access-policy work remain pending.

## Prerequisites

- Node.js 22+
- A Supabase project (free tier is enough)
- Optional: the [Supabase CLI](https://supabase.com/docs/guides/cli) for applying
  migrations from the command line

## Setup

All npm commands run from `frontend/`:

```bash
cd frontend
npm install
cp .env.example .env    # Windows: copy .env.example .env
```

Fill in `frontend/.env` from **Supabase dashboard → Project Settings → API**:

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` |

`.env` is gitignored. Never put the `service_role` key in it — anything prefixed `VITE_`
is compiled into the browser bundle.

## Applying the migration

**Option A — dashboard (no CLI).** Open SQL Editor in your Supabase project, paste the
contents of [`backend/supabase/migrations/0001_events.sql`](backend/supabase/migrations/0001_events.sql)
and run it. The script is idempotent, so re-running it is safe.

**Option B — Supabase CLI.** The CLI looks for a `supabase/` folder in the current
directory, so run it from `backend/`:

```bash
cd backend
supabase link --project-ref <your-project-ref>
supabase db push
```

Apply migrations **in order**, `0001` through `0005`.

## Roles

Roles live in `public.profiles.role`, never in `auth.users` — Supabase owns that table and
it cannot take extra columns. Valid values are constrained by `profiles_role_valid`:
`organiser`, `coordinator`, `venue_staff`, `tech_support`, `attendee`.

**Roles are assigned, not chosen.** `prevent_role_self_assignment` blocks a signed-in user
from updating their own role, and no client may insert a profile at all: the
`handle_new_user` trigger (`0005`) creates it in the same transaction as the account, with
the role decided server-side. An administrator assigns roles from the SQL editor, where
statements run without a JWT:

```sql
update public.profiles set role = 'coordinator'
where id = (select id from auth.users where email = 'someone@example.com');
```

Policies read the caller's role through `public.current_user_role()`. That function is
`SECURITY DEFINER` for a reason worth knowing: a policy on `profiles` that queries
`profiles` re-enters itself and Postgres fails with *infinite recursion detected in policy*.
Running as the owner with RLS bypassed breaks the cycle.

During development, the **Dev · act as** switcher changes your own role so one test account
can exercise stories written for all five. It calls `dev_set_my_role()`, which deliberately
reopens the escalation the trigger prevents. Before release:

```sql
drop function if exists public.dev_set_my_role(text);
```

and delete `DevAuthPanel` and `DevRoleSwitcher`.

### Seed a test organiser

US-005 needs a signed-in organiser; the real login screen is US-002. Until then the app
shows a **development sign-in panel**, visible only under `npm run dev` and never in a
production build.

1. Supabase dashboard → **Authentication → Users → Add user**.
2. Enter an email and password, and tick **Auto Confirm User** — without it Supabase
   waits for an email confirmation that never arrives on a local project.
3. Run `npm run dev`, enter those credentials in the development sign-in panel.

Adding the user creates their `organiser` profile automatically, through the
`on_auth_user_created` trigger in `0005`.

> **Note for the oral exam:** the profile used to be created by the browser after first
> sign-in. That raced the session lookup — a new user saw *No organiser profile* until they
> reloaded — and let the client take part in choosing its own role. Creating it in a trigger
> on `auth.users` fixes both: the row exists before any session can, and the client never
> inserts into `profiles`. See [`0005_profile_on_signup.sql`](backend/supabase/migrations/0005_profile_on_signup.sql).

## Running

From `frontend/`:

```bash
npm run dev        # Vite dev server
npm run test       # Vitest, once
npm run test:watch # Vitest, watch mode
npm run coverage   # coverage report for src/features
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # typecheck + production build
```

## Project structure

```
frontend/                            React app (Vite, Tailwind, Vitest)
├── package.json, vite.config.ts, tsconfig.json, .env
└── src/
    ├── lib/supabase.ts              single Supabase client
    ├── components/ui/               shared presentational components
    ├── components/layout/           app shell, navigation, footer
    └── features/
        ├── auth/                    session plumbing (US-002 owns the real story)
        └── events/                  one folder per backlog component
            ├── types.ts
            ├── validation.ts        PURE functions — no React, no Supabase, no I/O
            ├── useEventRequestForm.ts form state and separate save/submit actions
            ├── draftValidation.ts   incomplete draft validation, separate from submission
            ├── eventService.ts      submits new event requests to Supabase
            ├── eventDraftQueryService.ts lists and loads a signed-in organiser’s drafts
            ├── eventDraftService.ts saves new drafts and updates existing owned drafts
            ├── components/
            └── __tests__/
backend/
└── supabase/migrations/             database schema, RLS, triggers
```

The split follows where code runs, not a separate API server. The browser talks to
Supabase directly, so the backend is the database itself: its schema, its RLS policies
and its triggers. That is why the business rules enforced in `backend/` are the real
control, and the checks in `frontend/` are there for the user's benefit.

Future features (`venues`, `bookings`, `equipment`, `registration`, `notifications`)
become sibling folders under `frontend/src/features/`. The folder name is simultaneously a backlog
component, a C4 component and a directory, so tracing a requirement to its implementation
is one step.

See [CLAUDE.md](CLAUDE.md) for the architecture rules the whole team follows.

## Acceptance criteria → tests (US-005)

| AC | Covered by |
| --- | --- |
| AC-005.1 — capture preliminary information | `validation.test.ts` (`AC-005.1: …`), `EventRequestForm.test.tsx` |
| AC-005.2 — cannot submit with missing/invalid required fields | `validation.test.ts` (`AC-005.2: …`), `EventRequestForm.test.tsx` |
| AC-005.3 — informed on success | `EventRequestForm.test.tsx`, `eventService.test.ts` |
| AC-005.4 — informed on failure, with a reason | `eventService.test.ts` (`AC-005.4: …`), `EventRequestForm.test.tsx` |
| AC-005.5 — unique reference, status Submitted | `eventService.test.ts` (`AC-005.5: …`), `0001_events.sql` trigger |

Every test name begins with the acceptance criterion it covers, so
`npm run test -- --reporter=verbose` prints the traceability matrix.

## Acceptance criteria → tests (Save Draft Event Request, in progress)

Save Draft Event Request is **US-001**. Its criteria follow the Jira order:

| Requirement ID | Acceptance criterion |
| --- | --- |
| AC-001.1 | Save an event request as a draft before submitting it |
| AC-001.2 | Save a draft with incomplete information required for final submission |
| AC-001.3 | Identify a saved draft as Draft status |
| AC-001.4 | Reopen a saved draft and continue editing its information |
| AC-001.5 | Saving or editing a draft does not submit it for review |
| AC-001.6 | Treat the request as submitted only after an explicit submission action |

Each automated case has a unique ID, for example `AC-001.2-01`. The final number
identifies a test case, not another acceptance criterion. IDs are unique across the
story's test files, including each parameterised input row. Within each file, group
tests by criterion and sort numerically by story, criterion, then case number. Keep existing IDs stable
and allocate the next unused number for new cases. Tests spanning several criteria use
one primary ID and name additional criteria in parentheses. Invalid-value and failure
checks support the associated criterion; they are not new customer requirements.

Current automated case ranges:

| Criterion | Case IDs | Count |
| --- | --- | ---: |
| AC-001.1 | AC-001.1-01 through AC-001.1-12 | 12 |
| AC-001.2 | AC-001.2-01 through AC-001.2-22 | 22 |
| AC-001.3 | AC-001.3-01 through AC-001.3-02 | 2 |
| AC-001.4 | AC-001.4-01 through AC-001.4-34 | 34 |
| AC-001.5 | AC-001.5-01 through AC-001.5-04 | 4 |
| AC-001.6 | AC-001.6-01 through AC-001.6-09 | 9 |

Run `npm run test -- --reporter=verbose` to see individual case IDs and results.
Automated tests live in
[`draftValidation.test.ts`](frontend/src/features/events/__tests__/draftValidation.test.ts) and
[`eventDraftService.test.ts`](frontend/src/features/events/__tests__/eventDraftService.test.ts),
with form tests in `EventRequestForm.test.tsx` and draft-submission tests in `eventService.test.ts`.
`eventDraftQueryService.test.ts`, `draftFormValues.test.ts` and `DraftPages.test.tsx`
cover listing, restored values and the list-to-editor workflow.
Tests check validation, services with mocked Supabase responses, and the form with mocked services.
They do not connect to Supabase or prove the complete user flow or RLS enforcement works.

| AC / supporting rule | Current evidence | Remaining checks |
| --- | --- | --- |
| AC-001.2 — allow incomplete required fields | Unit tests accept empty drafts, blank fields and a single supplied date | Save incomplete data to Supabase and reopen it |
| Supplied values respect database constraints | Unit tests reject invalid dates, unordered date ranges, and invalid attendance; include boundary values | Verify constraints against live Supabase |
| AC-001.6 — explicit submission | Form and service tests verify submission uses the saved draft ID and full validation | Verify transition and reference trigger against live Supabase |
| AC-001.1, AC-001.4, AC-001.5 — save/edit without submission | Service and form tests check draft saves, repeated edits, guarded updates and failures | Live database tests |
| AC-001.3 — identifiable Draft | Form and page tests verify Draft indicators after saving and in the list | Browser and live database verification |

Run the draft checks from `frontend/` with:

```bash
npm run test -- src/features/events/__tests__
```

Drafts use the existing `events` table. Empty text, dates and attendance become `null`.
Supplied attendance must be a positive PostgreSQL integer, and an end date must follow
the start when both are supplied. Past dates may remain in drafts; submission still
requires a future start. These validation rules do not save data or change status.

`saveEventDraft(input, draftId?)` accepts the complete form snapshot. Omit the ID for
a new draft; reuse the returned `draft.id` for later saves. Updates filter by ID,
signed-in owner and current Draft status, and never set workflow fields such as status
or reference. Missing input fields clear their stored values, so this is not a partial
patch API. A missing/stale draft returns a failure rather than inserting a replacement.
Network failures are reported without automatically retrying a potentially successful save.

The form keeps its draft ID during the current visit, preserves fields after saves/errors,
and disables editing and both actions while saving/submitting. It uses the shared Draft
badge and clears outdated success messages when values change. `useEventRequestForm`
keeps this state separate from the form markup. Switching accounts remounts the form.
`submitEventRequest(input, draftId?)` validates all submission fields, then updates the
owned draft's latest details and status together; a stale ID never falls back to an insert.
Saved drafts can be reopened through `/drafts` or directly at `/drafts/:id`, including
after refreshing that editor URL. The new-request page does not restore unsaved changes;
use My Drafts to find a request saved before leaving that page.

Before completing the story, verify owner access and coordinator draft restrictions
with authenticated users. The inspected live coordinator policies currently do not
exclude drafts; coordinate the policy change with the request-status work. Record live
test results and review evidence in the team's Jira/test tracker, without treating unit
test success as completion of the story.

## Design decisions worth knowing

- **Validation lives in two places on purpose.** `validation.ts` exists for the error
  message; the database CHECK constraints exist for integrity when something bypasses the
  UI. Defence in depth, not accidental duplication.
- **Business rules run in the client and in Postgres, with no middle tier.** That is the
  Supabase model. The trade-off — no server-side application layer to hold logic that
  cannot be expressed in SQL — is recorded in the C4 documentation rather than left to
  look accidental. If a rule ever needs a server, it becomes one Edge Function.
- **Required fields are not `NOT NULL` columns.** US-001 lets organisers save incomplete
  drafts, so the requirement is enforced by a CHECK keyed on `status` instead.
- **References come from a database trigger**, not the client, so two simultaneous
  submissions cannot mint the same number. The sequence is global, so reference numbers do
  not restart each January.
- **Statuses are stored lowercase** (`submitted`) and rendered from `EVENT_STATUS_LABELS`
  (`Submitted`).

### Loading a saved draft

`getEventDraft(id)` in `eventDraftQueryService.ts` reads one draft using ID, signed-in
owner and Draft status filters. It restores existing field names, converts missing
values to empty inputs, and keeps stored date timestamps unchanged for the editor to
format. Opening a draft performs no write. Missing, inaccessible and submitted requests
share one unavailable message.

`eventDraftQueryService.test.ts` covers loading, incomplete data, filters and failures
using mocked Supabase responses. These checks do not prove live RLS enforcement.
`listEventDrafts()` retrieves owned drafts ordered by most recently saved. My Drafts
(`/drafts`) is linked from organiser navigation, home and the new-request page. It shows
Draft badges, last-saved times and an Untitled draft fallback for unnamed requests.
The resume page (`/drafts/:id`) loads an existing draft into `EventRequestForm`; subsequent
saves and explicit submission retain its ID. Loading never writes or submits anything.
After successful submission, the resume page shows confirmation rather than offering
another save of the same draft. Returning to My Drafts reloads the list.

Both pages provide loading, empty/error and retry states as appropriate. Their access
guard waits for a signed-in organiser and resets loaded state on account changes. Stale
responses from a previous account or draft cannot replace the current editor.
`draftFormValues.ts` restores attendance as text and converts stored date timestamps
for datetime-local inputs, matching the existing submission parser's browser timezone.
This does not enforce Singapore time for users outside Singapore; a consistent
application-wide timezone policy still needs coordination with the submission feature.

The page tests use mocked services and the query tests use mocked Supabase. They do not
prove live persistence, RLS, or trigger behaviour. No fake database is shipped in the app.
There is no autosave: users must save changes before navigating away.
