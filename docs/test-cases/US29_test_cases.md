# US29 Create an Attendee account (SCRUM-227): test cases

Status: **implemented; automated cases pass, manual cases not yet run.** The table was approved
on 7 October and the tests were committed failing (commit `9b546b5`) before any
implementation: 43 of the 46 automated cases failed for the expected reasons. On the final run
all 46 pass: 30 app tests and 16 database cases (19 checks, because .3.8, .3.9 and .3.12 each
check twice). The full suites total 794 app tests and 428 database checks. Implementation is
in migration `0042_attendee_self_signup.sql` and `frontend/src/features/auth/`. The 3 manual
cases (.1.18, .2.5, .4.10) need the shared Supabase project, with 0042 applied and the
redirect URL added (A2).

Three cases already passed before implementation. They guard behaviour that exists today and
that US29 must not break:
- AC-029.1.14: the existing `signUp` already returns Supabase's error message.
- AC-029.2.3: the existing `signUp` already treats a normal new account as a success.
- AC-029.3.6: browsers have been unable to insert profiles since 0005.

Test IDs follow `CLAUDE.md`: `AC-029.Y.Z`, where Y is the acceptance criterion in Jira order
and Z numbers the tests within it. Z is unique across the story and increases top to bottom
within each test file.

## Agreed design inputs (7 October)

| # | Decision | Source |
|---|---|---|
| D1 | "Confirm email" stays **on** in Supabase Auth. A new user has no session until they click the confirmation link. | Team decision, option 1(b) |
| D2 | The role is decided only by the database. Migration `0042_attendee_self_signup.sql` replaces `handle_new_user()` so every new account gets `role = 'attendee'`, whatever the browser sends. 0005 is not edited. | Brief, key security rules |
| D3 | Organisers use **request, then approval**. A sign-up option "I want to organise events" sends `requested_role: 'organiser'` in the sign-up metadata. The trigger still creates an Attendee, and also a `pending` row in a new `organiser_requests` table. Any other `requested_role` value is ignored. | Team decision |
| D4 | Only an administrator (SQL editor or service role, where `auth.uid()` is null) decides requests, through `decide_organiser_request(user_id, approve)`. Approval sets the role to `organiser`; rejection leaves `attendee`. The browser cannot call it, and cannot write `organiser_requests`. | Team decision; CLAUDE.md "roles are assigned by an administrator" |
| D5 | Duplicate emails are detected and reported. With confirmation on, Supabase returns a user with an empty `identities` list instead of an error. That case, and a `user_already_exists` error, both show "An account with this email already exists. Sign in instead." | Team decision |
| D6 | After sign-up the user is sent to `/events/open`, a placeholder for "events open for registration". It shows no event data; the real list belongs to US15/US52. Sign-up passes `emailRedirectTo = <origin>/events/open`, so the confirmation link lands there signed in. | Team decision, option 3(a) |
| D7 | Sign-up moves to its own page, `/signup` (React Hook Form + Zod), linked from `/signin`. The sign-in page's in-page "Create account" mode, which promised an organiser account, is removed. | Brief, Step 4 |
| D8 | Name, email and password rules reuse the existing ones: email required and well formed, password at least 6 characters (`MINIMUM_PASSWORD_LENGTH`). Name is required after trimming. | Existing `validation.ts`, 0001 `full_name not null` |

## Assumptions (to confirm with the team or customer)

| # | Assumption | Tests affected |
|---|---|---|
| A1 | With confirmation on, AC-029.4's "after signing up" means "after confirming the email address". The confirmation link signs the user in. | .4.3, .4.10 |
| A2 | `<origin>/events/open` is added to Supabase → Authentication → URL Configuration → Redirect URLs. Otherwise Supabase sends the link to the Site URL instead. This is a dashboard change, not code. | .4.10 |
| A3 | Reporting duplicates gives up Supabase's protection against discovering who has an account (D5). | .2.1–.2.5 |
| A4 | There is no Safety Officer role. AC-029.3 is tested against every role that exists: coordinator, coordinator_lead, operations_manager, venue_staff, tech_support, organiser. | .3.1 |
| A5 | Names have no maximum length or character rules, because the schema sets none. | .1.4–.1.6 |
| A6 | Supabase's project password minimum is still the default of 6. The public settings endpoint does not show it. | .1.10–.1.11 |
| A7 | Organiser requests have no in-app approval screen. An administrator decides them in the SQL editor, as roles are assigned today. A requester is told that approval is needed but sees no status page yet. | .3.9–.3.12, .3.15 |

## Fixtures

SQL tests use the disposable Docker database only. Supabase Auth is simulated by inserting
into `auth.users`, as `bootstrap.sql` already does; this proves the trigger and policies but not
Supabase Auth itself. Vitest tests mock Supabase, as the existing tests do.

| Fixture | Definition |
|---|---|
| `U-NEW` | A new `auth.users` row with `raw_user_meta_data = {"full_name": "Ada Tan"}` |
| `U-BARE` | A new `auth.users` row with no metadata |
| `U-ROLE` | New rows whose metadata also claims a role: `{"role": X}` for each existing internal role and organiser |
| `U-ORG` | A new row with `{"full_name": "Org Lim", "requested_role": "organiser"}` |
| `U-OTHER` | A row whose request is for another user, to check isolation |

## Planned test files

| Layer | File |
|---|---|
| SQL | `backend/supabase/tests/attendee_signup.sql`, appended to the Docker runner |
| Vitest | `frontend/src/features/auth/__tests__/signUpValidation.test.ts`, `signUpService.test.ts`, `SignUpPage.test.tsx`, `SignInPage.test.tsx` (existing), `frontend/src/features/events/__tests__/OpenEventsPage.test.tsx`, `frontend/src/components/layout/__tests__/TopNav.test.tsx` (existing) |
| Manual | Shared app and shared Supabase, using new throwaway email addresses |

---

## AC-029.1: A person can sign up with their name, email and password, and receives the Attendee role

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-029.1.1 | 029.1 | SQL | A new account gets exactly one profile, with the Attendee role and the given name | 0042 applied | Insert `U-NEW` into `auth.users` as Supabase Auth would | full_name "Ada Tan" | Exactly one `profiles` row for that id: role `attendee`, full_name "Ada Tan" | **Pass** |
| AC-029.1.2 | 029.1 | SQL | Boundary: a blank name falls back instead of failing the sign-up | 0042 applied | Insert a user whose full_name is whitespace | full_name "   ", email `ada@example.test` | Profile created, role `attendee`, full_name "ada" (existing fallback) | **Pass** |
| AC-029.1.3 | 029.1 | SQL | Boundary: an account created with no metadata is still an Attendee | 0042 applied | Insert `U-BARE` | no metadata | Profile role `attendee` | **Pass** |
| AC-029.1.4 | 029.1 | Vitest | Valid name, email and password are accepted and trimmed | none | `validateSignUp(input)` | "  Ada Tan ", " ada@example.test ", "secret1" | Valid; name "Ada Tan", email "ada@example.test", password unchanged | **Pass** |
| AC-029.1.5 | 029.1 | Vitest | Missing name is rejected | none | same | name "" | Error on name: "Enter your name." | **Pass** |
| AC-029.1.6 | 029.1 | Vitest | Boundary: whitespace-only name is rejected | none | same | name "   " | Same error | **Pass** |
| AC-029.1.7 | 029.1 | Vitest | Missing email is rejected | none | same | email "" | "Enter your email address." | **Pass** |
| AC-029.1.8 | 029.1 | Vitest | Invalid email is rejected | none | same | "ada.example.test" | "That does not look like an email address." | **Pass** |
| AC-029.1.9 | 029.1 | Vitest | Missing password is rejected | none | same | password "" | "Enter your password." | **Pass** |
| AC-029.1.10 | 029.1 | Vitest | Boundary: 5-character password is rejected | none | same | "abcde" | "Your password must be at least 6 characters." | **Pass** |
| AC-029.1.11 | 029.1 | Vitest | Boundary: 6-character password is accepted | none | same | "abcdef" | Valid | **Pass** |
| AC-029.1.12 | 029.1 | Vitest | All problems are reported at once, one per field | none | same | all three empty | Exactly three issues: name, email, password | **Pass** |
| AC-029.1.13 | 029.1 | Vitest | The service sends the name with the sign-up and never a role | mocked `supabase.auth.signUp` | `signUp({ fullName, email, password })` | "Ada Tan" | Called with email, password and `options.data = { full_name: "Ada Tan" }`; no `role` key anywhere | **Pass** |
| AC-029.1.14 | 029.1 | Vitest | Failure: a Supabase error is returned as a clear reason | mocked error "Password is too weak" | `signUp(...)` | valid input | `{ ok: false, reason: "Password is too weak" }` | **Pass** |
| AC-029.1.15 | 029.1 | Vitest | Filling in and submitting the form signs up with the cleaned values | page rendered, signed out, mocked service | Type name, email, password; click "Create account" | "  Ada Tan ", "ada@example.test", "secret1" | Service called once with "Ada Tan", "ada@example.test", "secret1" | **Pass** |
| AC-029.1.16 | 029.1 | Vitest | Invalid input shows field errors and does not call the service | as above | Submit with an empty name and a 5-character password | "", "abcde" | Errors shown next to Name and Password; service not called | **Pass** |
| AC-029.1.17 | 029.1 | Vitest | Failure: a sign-up error is shown and the input is kept | mocked service failure | Submit valid input | reason "Password is too weak" | Alert shows the reason; fields keep their values; button enabled again | **Pass** |
| AC-029.1.18 | 029.1 | Manual | A real sign-up creates an Attendee with the given name | Shared app, new email address | Sign up at `/signup`; inspect `profiles` in Supabase | new name and email | One `auth.users` row and one `profiles` row: role `attendee`, the given name | Not run yet (manual, shared Supabase) |

## AC-029.2: An email address that already has an account cannot be used to sign up again

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-029.2.1 | 029.2 | Vitest | A duplicate hidden by email confirmation is detected | mocked `signUp` returns a user with `identities: []` and no error | `signUp(...)` | existing email | `{ ok: false, reason: "An account with this email already exists. Sign in instead." }` | **Pass** |
| AC-029.2.2 | 029.2 | Vitest | A duplicate reported as an error gets the same message | mocked error, code `user_already_exists` | `signUp(...)` | existing email | Same reason | **Pass** |
| AC-029.2.3 | 029.2 | Vitest | Boundary: a new email with one identity is not a duplicate | mocked user with one identity | `signUp(...)` | new email | `{ ok: true, ... }` | **Pass** |
| AC-029.2.4 | 029.2 | Vitest | The form explains a duplicate and offers sign-in | mocked duplicate result | Submit valid input | existing email | Alert with the duplicate message and a "Sign in" link to `/signin`; no "check your email" notice | **Pass** |
| AC-029.2.5 | 029.2 | Manual | A real duplicate creates no second account | Shared app; an email that already has an account | Sign up again with that email; inspect `auth.users` | existing email | Duplicate message shown; still one `auth.users` row for that email; no new profile | Not run yet (manual, shared Supabase) |

## AC-029.3: Self sign-up never grants an internal role or the Event Organiser role

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-029.3.1 | 029.3 | SQL | A role claimed in the sign-up metadata is ignored | 0042 applied | Insert one `U-ROLE` user per claimed role | `role`: coordinator, coordinator_lead, operations_manager, venue_staff, tech_support, organiser | Every profile has role `attendee` | **Pass** |
| AC-029.3.2 | 029.3 | SQL | Requesting any role other than organiser records nothing | 0042 applied | Insert a user with `requested_role: "coordinator"` | coordinator | Profile `attendee`; no `organiser_requests` row | **Pass** |
| AC-029.3.3 | 029.3 | SQL | An organiser request is recorded but grants nothing | 0042 applied | Insert `U-ORG` | requested_role organiser | Profile `attendee`; one `organiser_requests` row, status `pending` | **Pass** |
| AC-029.3.4 | 029.3 | SQL | Permission denied: an Attendee cannot change their own role | signed in as `U-NEW` | Update own `profiles.role` to `organiser`, then to `coordinator` | organiser, coordinator | Both refused (42501); role still `attendee` | **Pass** |
| AC-029.3.5 | 029.3 | SQL | An Attendee can still edit their own name | signed in as `U-NEW` | Update own full_name | "Ada T." | Updated; role unchanged | **Pass** |
| AC-029.3.6 | 029.3 | SQL | Permission denied: an Attendee cannot insert a profile | signed in as `U-NEW` | Insert a profile row with role `coordinator` | a new id | Refused; no row | **Pass** |
| AC-029.3.7 | 029.3 | SQL | A requester reads only their own organiser request | `U-ORG` and `U-OTHER` both have requests | Select `organiser_requests` as `U-ORG` | none | Sees exactly their own row | **Pass** |
| AC-029.3.8 | 029.3 | SQL | Permission denied: requests cannot be created, approved or deleted from the browser | signed in as `U-ORG` | Insert a request; update own status to `approved`; delete own request | approved | Insert refused; update and delete affect 0 rows; still `pending` | **Pass** |
| AC-029.3.9 | 029.3 | SQL | Permission denied: the browser cannot call the decision function | signed in as `U-ORG` | Call `decide_organiser_request(own id, true)` | true | Refused (42501); role still `attendee` | **Pass** |
| AC-029.3.10 | 029.3 | SQL | An administrator's approval grants the Organiser role | no JWT (administrator) | Call `decide_organiser_request(U-ORG, true)` | true | Request `approved` with `decided_at` set; role `organiser` | **Pass** |
| AC-029.3.11 | 029.3 | SQL | An administrator's rejection leaves the Attendee role | no JWT; a second pending request | Call `decide_organiser_request(user, false)` | false | Request `rejected`; role `attendee` | **Pass** |
| AC-029.3.12 | 029.3 | SQL | Conflict: a decided request cannot be decided again | after .3.10 | Call `decide_organiser_request(U-ORG, false)` | false | Refused; still `approved`; role still `organiser` | **Pass** |
| AC-029.3.13 | 029.3 | SQL | Replaying 0042 changes no existing profile or request | runner, after the tests above | Re-run 0042; compare `profiles` and `organiser_requests` with a snapshot | none | No differences | **Pass** |
| AC-029.3.14 | 029.3 | Vitest | The service sends an organiser request only when asked | mocked `signUp` | `signUp` with and without `requestOrganiser: true` | true, false | With: `options.data.requested_role = "organiser"`; without: no `requested_role` key | **Pass** |
| AC-029.3.15 | 029.3 | Vitest | The form offers an organiser request, never a role choice | page rendered | Inspect the form; tick "I want to organise events"; submit | valid input | No role selector; service called with `requestOrganiser: true`; text says organiser access needs approval and the account starts as an Attendee | **Pass** |
| AC-029.3.16 | 029.3 | Vitest | The sign-in page no longer promises an organiser account | sign-in page rendered | Inspect the page | none | No "set up as an event organiser" text and no in-page sign-up; a "Create an account" link goes to `/signup` | **Pass** |

## AC-029.4: After signing up, the Attendee is signed in and can see events open for registration

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-029.4.1 | 029.4 | Vitest | The confirmation link is set to open the events page | mocked `signUp`; origin `http://localhost:5173` | `signUp(...)` | valid input | `options.emailRedirectTo = "http://localhost:5173/events/open"` | **Pass** |
| AC-029.4.2 | 029.4 | Vitest | The service says whether the user is already signed in | mocked user with and without a session | `signUp(...)` | both cases | `{ ok: true, signedIn: false }` without a session; `{ ok: true, signedIn: true }` with one | **Pass** |
| AC-029.4.3 | 029.4 | Vitest | With confirmation on, the form explains the next step (A1) | mocked `{ ok: true, signedIn: false }` | Submit valid input | valid input | Status message: check your email; the link signs you in and shows events open for registration. The form is replaced by the message | **Pass** |
| AC-029.4.4 | 029.4 | Vitest | If a session comes back, the user goes straight to the events page | mocked `{ ok: true, signedIn: true }` | Submit valid input | valid input | Navigates to `/events/open` | **Pass** |
| AC-029.4.5 | 029.4 | Vitest | A signed-in user who opens `/signup` is sent home | signed-in session | Render `/signup` | none | Redirected to `/` | **Pass** |
| AC-029.4.6 | 029.4 | Vitest | A signed-in Attendee sees the events-open-for-registration page | signed-in attendee | Render `/events/open` | none | Heading "Events open for registration" and placeholder text saying events will appear here | **Pass** |
| AC-029.4.7 | 029.4 | Vitest | Boundary: a visitor who is not signed in is sent to sign in | signed out | Render `/events/open` | none | Redirected to `/signin`, remembering `/events/open` as the destination | **Pass** |
| AC-029.4.8 | 029.4 | Vitest | Boundary: while the session loads, nothing redirects | session loading | Render `/events/open` | none | Loading message; no redirect | **Pass** |
| AC-029.4.9 | 029.4 | Vitest | The Attendee navigation links to the events page | attendee profile | Render the top navigation | attendee, organiser | Attendee sees "Open events" → `/events/open`; organiser does not | **Pass** |
| AC-029.4.10 | 029.4 | Manual | The confirmation link signs the Attendee in on the events page (A1, A2) | Shared app; redirect URL added (A2) | Sign up with a new email; open the confirmation email; click the link | new email | Lands on `/events/open`, signed in as Attendee; nav shows "Open events" | Not run yet (manual, shared Supabase) |

---

## Regression and changes to existing tests (needs your approval)

- **All existing app tests and database checks must still pass,** including the sign-in tests.
- **Existing SQL fixtures depended on the old default role (approved 7 October).** Five test
  files (`change_request_review`, `coordinator_assignment`, `equipment_requirements`,
  `equipment_reservations`, `venue_booking_review`) created organisers by inserting into
  `auth.users` and relying on `handle_new_user()` giving them `organiser`. Each now sets
  `role = 'organiser'` as administrator straight after the insert, as the files already did for
  coordinators. This changes only setup, not what any test checks. The other three files that
  insert users (`review_decisions_test`, `venue_blocks`, `venue_suitability`) already set every
  role or profile explicitly. With the change, all 409 existing database checks still pass.
- **One existing sign-in test was superseded (approved 7 October).** `SignInPage.test.tsx`
  "asks a new user to confirm their email when sign-up returns no session yet" tested the
  in-page sign-up mode that D7 removes. It was replaced by AC-029.3.16; AC-029.4.3 covers the
  confirm-your-email behaviour on `/signup`.

## Coverage summary

| AC | SQL | Vitest | Manual | Count |
|---|---|---|---|---|
| AC-029.1 | .1.1–.1.3 | .1.4–.1.17 | .1.18 | 18 |
| AC-029.2 | none (Supabase Auth owns email uniqueness) | .2.1–.2.4 | .2.5 | 5 |
| AC-029.3 | .3.1–.3.13 | .3.14–.3.16 | none | 16 |
| AC-029.4 | none | .4.1–.4.9 | .4.10 | 10 |
| **Total** | **16** | **30** | **3** | **49** |

Required categories, by test ID:

- **Successful sign-up, Attendee role only:** .1.1, .1.3, .1.15, .1.18
- **Missing or invalid name, email or password:** .1.5–.1.12, .1.16
- **Duplicate email:** .2.1–.2.5
- **Role sent in metadata still gives Attendee (SQL):** .3.1, .3.2, .3.3
- **Attendee cannot update own role (SQL, RLS and trigger):** .3.4, .3.6
- **Organiser request without self-approval:** .3.7–.3.12, .3.14, .3.15
- **Signed in and on the events page:** .4.3, .4.4, .4.6, .4.10
- **Boundary:** .1.2, .1.3, .1.6, .1.10, .1.11, .2.3, .4.7, .4.8
- **Failure or conflict:** .1.14, .1.17, .3.12
