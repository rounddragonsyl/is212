# US14 Reserve Equipment for an Event (SCRUM-20): test cases

Status: **implemented**. The table was approved on 4 October, and the tests were committed
failing (commit `5ce44a6`) before any implementation. On the final run all 104 pass:
82 database checks (Docker runner) and 22 app tests. The full suites total 468 app tests and
285 database checks, with nothing existing broken. Implementation is in migration
`0025_equipment_reservations.sql` and `frontend/src/features/equipment/` (reservation files).

Change to tests after approval (approved 4 October, intent unchanged): in AC-014.3.6, .4.3,
.6.4, .7.1, .8.1, .8.2, .8.6, .8.8, .9.1, .9.4, .9.5 and .11.4, the action now runs as its own
SQL statement before the assertion. A statement cannot see changes made by functions it
calls, so checking in the same statement either failed wrongly or passed without proving
anything.

Follow-up (agreed 4 October): AC-014.4 is met by the reserve form's return date. Changing
it after reserving (A1) is tested in the database and service, but has no screen yet; new
tests for that screen start at AC-014.4.12.

AC-014.7.6 and .7.7 already passed before implementation. They guard protections from 0019
and 0024 that 0025 must not reopen.

Test IDs follow `CLAUDE.md`: `AC-014.Y.Z`, where Y is the acceptance criterion in Jira order
and Z numbers the tests within it. Z is unique across the story and increases top to bottom
within each test file. Rules from a customer clarification cite the thread (for example #5).
Rules that are our team's proposal are marked **(A1)** to **(A10)** and listed below.

## Design the tests assume

US14 builds on Nicole's 0019 tables (agreed 4 October); there is no parallel catalogue.

| # | Design | Source |
|---|---|---|
| D1 | Units are `equipment_items` rows. Only `operational` units are usable. `needs_repair` = damaged, `under_repair` = under maintenance, and `retired` / `missing` = otherwise unavailable. | 0019, #13 |
| D2 | A reservation is one `equipment_allocations` row per unit, with whole-day `blocked_from` to `blocked_to`, both inclusive. Each requirement has one booking line (`booking_line_id`), and each event has one equipment booking. | 0019, 0024 |
| D3 | Reserving happens only through one database function, called with `supabase.rpc()`. It checks availability, locks, writes and notifies in a single transaction. Browsers cannot write allocations, lines or bookings directly. | Brief, #13 decision by Nicole |
| D4 | Dates are Singapore dates. First day = SGT date of `proposed_start`; last day = SGT date of `proposed_end`. | #36 |
| D5 | Per-unit window: `blocked_from` = first day − 1 (collection), or first day − 2 if the unit is not at one of the event's approved venues. `blocked_to` = return date. Available again from return date + 1. | #5, #13, A2 |
| D6 | When the system picks units, it prefers units already at one of the event's approved venues. Technical Support never chooses units, and any Technical Support member can reserve any type at any location. | #66 |
| D7 | US13's release trigger cancels a reservation when its requirement changes or is removed. US14 relies on it rather than adding its own release. | 0024 |
| D8 | The Event Coordinator gets one notification per requirement outcome, in-app and by email. Each channel is configurable for the notification type, using the existing settings-table and `notification_outbox` pattern. | #37 |

## Assumptions (team proposals, to confirm with the customer)

| # | Assumption | Basis | Tests |
|---|---|---|---|
| A1 | The return date defaults to the event's last day and cannot be earlier than it. It can be changed after reserving: extending re-checks availability under the same lock as a new reservation, and shortening frees units earlier. | Team proposal; no rule in #113, #82 | .4.1–.4.11, .12.5 |
| A2 | Only approved (`confirmed`) venue bookings count. A unit at **any** of the event's approved venues needs no transfer day. With no approved venue booking, every unit gets the transfer day. | Team proposal | .5.3–.5.5 |
| A3 | A partial reservation is allowed only when fewer units are available than requested, following the AC wording. Reserving fewer while enough are available is rejected. | AC-014.8 wording | .8.8 |
| A4 | An alternative must be a different catalogue type, and can be suggested only when there is a shortfall. | Team proposal; structured alternative from 0019 | .9.6–.9.7 |
| A5 | The new notification type has both in-app and email enabled by default. | #37 | .13.5 |
| A6 | Every allocation that is not `cancelled` blocks its unit for its days, including `checked_out` and `returned`. This matches 0019's no-double-booking constraint. | 0019 | .11.5 |
| A7 | "Unavailable" means 0 reserved. The requirement is still linked to a line, with line status `unavailable`. | Team proposal | .9.1 |
| A8 | Each event reuses one equipment booking. Its delivery venue is one of the event's approved venues, or empty if there is none, which needs 0019's `deliver_to_venue_id` to allow empty values. | Team proposal | .10.1 |
| A9 | Coordinators see their outcome notifications on the event's equipment page. **This touches the US13 page.** | Team proposal | .13.10–.13.11 |
| A10 | Reservations cannot be made for events that are no longer approved, planning or confirmed, the same window as US13. | Team proposal, aligned with US13 | .8.7 |

Out of scope, per clarification: topping up a partial reservation (#114), the Coordinator
accepting or declining alternatives (#90, 0019 parts left untouched), and moving units
(`current_venue_id` is not updated).

## Shared fixtures (database tests, disposable Docker database only)

| Fixture | Definition |
|---|---|
| Users | `TS1`, `TS2` Technical Support; `C1` assigned coordinator; `C2` other coordinator; `O1` organiser; `M1` operations manager; `A1` attendee; `V1` venue staff |
| Venues | `HALL` and `ANNEX` (event venues); `STORE` (elsewhere) |
| Types | `Projector`, `Wireless mic`, `Speaker` (alternative) |
| Projector units | `P1`, `P2` operational at `HALL`; `P3` operational at `STORE`; `P4` needs_repair at `HALL`; `P5` under_repair at `HALL`; `P6` retired at `HALL` |
| `E1` | Approved; 10–11 Mar 2035 SGT (two days); confirmed venue booking at `HALL`; coordinator `C1`; requirement `R1` = Projector × 2 (pending, essential) |
| `E2` | Approved; overlaps `E1`'s window; confirmed at `HALL`; coordinator `C1` |
| `E3` | Approved; starts on `E1`'s return date + 2 (no overlap) |
| `E-MULTI` | Confirmed bookings at `HALL` and `ANNEX` |
| `E-HELD` | Only a `held` / `pending_approval` venue booking |
| `E-NOVENUE` | No venue booking |

App tests (Vitest) mock Supabase, as the existing tests do.

## Planned test files

| Layer | File |
|---|---|
| SQL | `backend/supabase/tests/equipment_reservations.sql` (run by the Docker runner; concurrency tests use `dblink` for a second connection) |
| Vitest | `frontend/src/features/equipment/__tests__/reservationRules.test.ts` (pure rules), `reservationService.test.ts`, `ReservationQueue.test.tsx`, `ReserveForm.test.tsx`, `EquipmentOutcomeNotices.test.tsx` |

---

## AC-014.1: Technical Support views requirements pending review

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.1.1 | 014.1 | SQL | Pending essential requirements across all events are listed | `R1` on `E1`, a pending line on `E2` | As TS1, call the review-list function | none | Both lines returned, with event reference, type, requested quantity | **Pass** |
| AC-014.1.2 | 014.1 | SQL | Non-essential lines are excluded (#106) | Pending line with `essential = false` | As TS1, call the list | none | That line is not returned | **Pass** |
| AC-014.1.3 | 014.1 | SQL | Lines already reserved, partially reserved or unavailable are excluded | One line in each state | As TS1, call the list | none | None of them returned | **Pass** |
| AC-014.1.4 | 014.1 | SQL | Permission denied: other roles cannot use the list | as above | Call as C1, O1, A1, M1 | none | Refused (42501) for each | **Pass** |
| AC-014.1.5 | 014.1 | Vitest | Service loads and maps the list | mocked `rpc` | `loadReviewQueue()` | 2 rows | Typed rows with event, type, requested and available quantity | **Pass** |
| AC-014.1.6 | 014.1 | Vitest | Failure: list cannot load | mocked error | `loadReviewQueue()` | none | Clear error result, no partial data | **Pass** |
| AC-014.1.7 | 014.1 | Vitest | Queue screen lists each pending requirement | 2 rows | Render as TS1 | none | Each row shows event reference, type, requested quantity | **Pass** |
| AC-014.1.8 | 014.1 | Vitest | Boundary: nothing pending | 0 rows | Render | none | "No equipment requirements pending review." | **Pass** |

## AC-014.2: Available units shown for each requirement's window

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.2.1 | 014.2 | SQL | Available = usable units of the type with no overlapping reservation | Units P1–P6, no reservations | As TS1, availability for `R1` | none | 3 (P1, P2, P3) | **Pass** |
| AC-014.2.2 | 014.2 | SQL | Units of other types are not counted | Wireless mic units exist | Availability for `R1` | none | Still 3 | **Pass** |
| AC-014.2.3 | 014.2 | SQL | Boundary: no units of the type | Requirement for `Speaker`, no Speaker units | Availability | none | 0 | **Pass** |
| AC-014.2.4 | 014.2 | SQL | Permission denied: coordinators cannot see stock (0019 design) | as above | Call availability as C1 | none | Refused (42501) | **Pass** |
| AC-014.2.5 | 014.2 | Vitest | Each row shows available against requested | row requested 2, available 3 | Render queue | none | "3 available · 2 requested" | **Pass** |
| AC-014.2.6 | 014.2 | Vitest | Shortfall is highlighted | requested 2, available 1 | Render queue | none | Row shows a shortfall warning of 1 | **Pass** |

## AC-014.3: Window from the collection day through the return day

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.3.1 | 014.3 | SQL | Unit at the venue is blocked from collection day to return day (#5) | `R1`, P1 at `HALL` | Reserve 1 with default return | none | P1 allocation 9 Mar → 11 Mar 2035 | **Pass** |
| AC-014.3.2 | 014.3 | SQL | Multi-day event: collection is the day before the **first** day (#5) | `E1` runs 10–11 Mar | as above | none | `blocked_from` = 9 Mar, not 10 Mar | **Pass** |
| AC-014.3.3 | 014.3 | SQL | Boundary: days are Singapore dates (#36) | Event starts 00:30 SGT on 10 Mar (16:30 UTC 9 Mar) | Reserve | none | Collection day 9 Mar SGT, not 8 Mar | **Pass** |
| AC-014.3.4 | 014.3 | SQL | Overlap on the return day blocks another event | P1 reserved to 11 Mar; `E2` window includes 11 Mar | Availability for `E2` | none | P1 not counted | **Pass** |
| AC-014.3.5 | 014.3 | SQL | Boundary: available again from return day + 1 (#5) | P1 reserved to 11 Mar; event whose window starts 12 Mar | Availability, then reserve | none | P1 counted and reservable | **Pass** |
| AC-014.3.6 | 014.3 | SQL | Epic rule: same-day AM and PM events cannot share a unit | Only P1 usable; AM event and PM event on the same date | Reserve P1 for the AM event, then for the PM event | none | Second reservation finds 0 available | **Pass** |
| AC-014.3.7 | 014.3 | Vitest | Window rule: collection = first SGT day − 1, return defaults to last SGT day | none | `reservationWindow(start, end)` | `2035-03-09T16:30Z`, `2035-03-11T09:00Z` | collection 9 Mar, return 11 Mar | **Pass** |
| AC-014.3.8 | 014.3 | Vitest | Window rule with a transfer day | none | `reservationWindow(…, { transfer: true })` | as above | starts 8 Mar | **Pass** |
| AC-014.3.9 | 014.3 | Vitest | Reserve form shows the window before saving | `R1` selected | Open form | default return | "Collection 9 Mar 2035 · Return 11 Mar 2035" | **Pass** |

## AC-014.4: Return date defaults to the last day and can be changed

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.4.1 | 014.4 | SQL | Default return date = event's last SGT day (A1) | `R1` | Reserve without a return date | none | `blocked_to` = 11 Mar | **Pass** |
| AC-014.4.2 | 014.4 | SQL | A later return date extends the window (A1) | `R1` | Reserve with return 14 Mar | 14 Mar | `blocked_to` = 14 Mar | **Pass** |
| AC-014.4.3 | 014.4 | SQL | Boundary: return before the last day is rejected (A1) | `R1` | Reserve with return 10 Mar | 10 Mar | Rejected; nothing reserved | **Pass** |
| AC-014.4.4 | 014.4 | SQL | Extending after reserving updates every unit when free (A1) | `R1` reserved to 11 Mar | Change return to 13 Mar | 13 Mar | All of the line's allocations end 13 Mar | **Pass** |
| AC-014.4.5 | 014.4 | SQL | Conflict: extending into another reservation is rejected (A1) | P1 also reserved by `E3` from 13 Mar | Change `R1` return to 13 Mar | 13 Mar | Rejected; return stays 11 Mar | **Pass** |
| AC-014.4.6 | 014.4 | SQL | Shortening frees units earlier (A1) | `R1` reserved to 14 Mar | Change return to 11 Mar, then check availability for an event starting 13 Mar | 11 Mar | Units available from 12 Mar | **Pass** |
| AC-014.4.7 | 014.4 | SQL | Boundary: cannot shorten below the last day (A1) | `R1` reserved | Change return to 10 Mar | 10 Mar | Rejected | **Pass** |
| AC-014.4.8 | 014.4 | SQL | Permission denied: only Technical Support changes return dates | `R1` reserved | Call as C1, O1 | 13 Mar | Refused (42501) | **Pass** |
| AC-014.4.9 | 014.4 | Vitest | Form pre-fills the return date with the event's last day | `R1` | Open form | none | Return date field = 2035-03-11 | **Pass** |
| AC-014.4.10 | 014.4 | Vitest | Return before the last day shows an error and does not save | `R1` | Enter 10 Mar, submit | 2035-03-10 | Field error; `rpc` not called | **Pass** |
| AC-014.4.11 | 014.4 | Vitest | Changing a return date calls the database and explains a conflict | mocked `rpc` conflict | `changeReturnDate()` | 13 Mar | Clear "units already reserved" message | **Pass** |

## AC-014.5: Transfer day for units held elsewhere

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.5.1 | 014.5 | SQL | Unit held elsewhere gets one extra day before collection | Only P3 (at `STORE`) usable for `R1` | Reserve 1 | none | P3 allocation starts 8 Mar | **Pass** |
| AC-014.5.2 | 014.5 | SQL | Unit at the event's venue gets no transfer day | P1 at `HALL` | Reserve 1 | none | Starts 9 Mar | **Pass** |
| AC-014.5.3 | 014.5 | SQL | Multi-venue event: a unit at **any** approved venue needs no transfer day (A2) | `E-MULTI`; unit at `ANNEX` | Reserve | none | Starts first day − 1 | **Pass** |
| AC-014.5.4 | 014.5 | SQL | Held or pending venue bookings do not count (A2) | `E-HELD`; unit at the held venue | Reserve | none | Transfer day added | **Pass** |
| AC-014.5.5 | 014.5 | SQL | No approved venue booking: every unit gets the transfer day (A2) | `E-NOVENUE` | Reserve | none | All allocations start first day − 2 | **Pass** |
| AC-014.5.6 | 014.5 | SQL | Transfer days are per unit (#13) | P1 at `HALL`, P3 at `STORE` | Reserve 3 (P2 already taken elsewhere) | none | P1 starts 9 Mar, P3 starts 8 Mar | **Pass** |
| AC-014.5.7 | 014.5 | SQL | Units already at the venue are picked first (#66) | P1, P2 at `HALL`; P3 at `STORE` | Reserve 2 | none | P1 and P2 picked, not P3 | **Pass** |
| AC-014.5.8 | 014.5 | SQL | Boundary: the transfer day itself can clash | P3 reserved by another event to 8 Mar | Availability for `R1` | none | P3 not counted (its window would start 8 Mar) | **Pass** |
| AC-014.5.9 | 014.5 | SQL | Reserving does not move units | as .5.1 | Inspect P3 | none | `current_venue_id` unchanged | **Pass** |

## AC-014.6: Damaged, maintenance and otherwise unavailable units are excluded

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.6.1 | 014.6 | SQL | Damaged units are not counted | P4 `needs_repair` | Availability | none | P4 excluded | **Pass** |
| AC-014.6.2 | 014.6 | SQL | Under-maintenance units are not counted | P5 `under_repair` | Availability | none | P5 excluded | **Pass** |
| AC-014.6.3 | 014.6 | SQL | Retired and missing units are not counted | P6 `retired`, a `missing` unit | Availability | none | Both excluded | **Pass** |
| AC-014.6.4 | 014.6 | SQL | Reserving more than the usable units is rejected | 3 usable, 6 units total | Reserve 4 | 4 | Rejected; nothing reserved | **Pass** |
| AC-014.6.5 | 014.6 | SQL | A reservation never picks an unusable unit | as above | Reserve 3 | 3 | Only P1, P2, P3 allocated | **Pass** |

## AC-014.7: Only Technical Support can reserve

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.7.1 | 014.7 | SQL | Permission denied: the assigned Event Coordinator | `R1` | C1 calls the reserve function | 1 | Refused (42501); nothing created | **Pass** |
| AC-014.7.2 | 014.7 | SQL | Permission denied: the Event Organiser | `R1` | O1 calls it | 1 | Refused (42501) | **Pass** |
| AC-014.7.3 | 014.7 | SQL | Permission denied: Attendee, Operations Manager, Venue Staff | `R1` | Call as A1, M1, V1 | 1 | Refused (42501) for each | **Pass** |
| AC-014.7.4 | 014.7 | SQL | Technical Support cannot insert allocations directly | `R1` | TS1 inserts into `equipment_allocations` | P1 | Refused; no row | **Pass** |
| AC-014.7.5 | 014.7 | SQL | Technical Support cannot write booking lines or bookings directly | none | TS1 inserts / updates them | none | Refused | **Pass** |
| AC-014.7.6 | 014.7 | SQL | Coordinators cannot insert allocations directly | none | C1 inserts | P1 | Refused | **Pass** |
| AC-014.7.7 | 014.7 | SQL | Technical Support cannot set a requirement's status directly (US13 regression) | `R1` | TS1 updates `status` | reserved | Refused | **Pass** |
| AC-014.7.8 | 014.7 | Vitest | Non-Technical Support users see no reserve screen (courtesy only) | viewer C1 | Render the page | none | Message "for Technical Support staff"; no reserve controls | **Pass** |
| AC-014.7.9 | 014.7 | Vitest | A permission refusal is explained | mocked 42501 | `reserveRequirement()` | none | "Only Technical Support Staff can reserve equipment." | **Pass** |

## AC-014.8: Full or partial reservation

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.8.1 | 014.8 | SQL | Full reservation | `R1` (2), 3 available | Reserve 2 | 2 | Requirement `reserved`; line `fulfilled`; 2 allocations | **Pass** |
| AC-014.8.2 | 014.8 | SQL | Partial reservation when fewer are available | Requirement × 3, 2 available | Reserve 2 | 2 | `partially_reserved`; line `partially_fulfilled`; 2 allocations | **Pass** |
| AC-014.8.3 | 014.8 | SQL | Boundary: requested 1, reserved 1 | Requirement × 1 | Reserve 1 | 1 | `reserved` | **Pass** |
| AC-014.8.4 | 014.8 | SQL | More than requested is rejected | `R1` (2) | Reserve 3 | 3 | Rejected | **Pass** |
| AC-014.8.5 | 014.8 | SQL | Boundary: negative quantity rejected | `R1` | Reserve −1 | −1 | Rejected | **Pass** |
| AC-014.8.6 | 014.8 | SQL | Conflict: a requirement already decided cannot be reserved again (#114) | `R1` reserved | Reserve again | 2 | Rejected; no extra allocations | **Pass** |
| AC-014.8.7 | 014.8 | SQL | Event no longer approved (A10) | `R1`'s event cancelled | Reserve | 2 | Rejected | **Pass** |
| AC-014.8.8 | 014.8 | SQL | Partial while enough are available is rejected (A3) | `R1` (2), 3 available | Reserve 1 | 1 | Rejected | **Pass** |
| AC-014.8.9 | 014.8 | Vitest | Quantity must be a whole number from 0 to the requested quantity | form for `R1` | Enter 3, 1.5, −1 | each | Field error each time; `rpc` not called | **Pass** |
| AC-014.8.10 | 014.8 | Vitest | A valid reservation sends only the decision | mocked `rpc` | Submit 2, return 11 Mar | 2 | `rpc('reserve_equipment', { requirement, quantity, return date })`; no units, user or status sent | **Pass** |
| AC-014.8.11 | 014.8 | Vitest | After saving, the row leaves the queue with its outcome shown | mocked success | Submit | 2 | Row removed; "Reserved 2 of 2" shown | **Pass** |

## AC-014.9: Shortfall marked unavailable, with an optional alternative

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.9.1 | 014.9 | SQL | Nothing available: the requirement is marked unavailable (A7) | 0 usable units | Reserve 0 | 0 | Requirement `unavailable`; line `unavailable`; no allocations | **Pass** |
| AC-014.9.2 | 014.9 | SQL | The shortfall is recorded | Requirement × 3, reserve 2 | as .8.2 | none | Line requested 3, reserved 2 | **Pass** |
| AC-014.9.3 | 014.9 | SQL | Shortfall with an alternative type and note | Requirement × 3, 2 available | Reserve 2 with alternative `Speaker`, note "Use PA instead" | Speaker | Suggested line: origin `suggested`, status `proposed`, replaces the original line, quantity 1, note stored | **Pass** |
| AC-014.9.4 | 014.9 | SQL | Shortfall without an alternative | as above | Reserve 2, no alternative | none | No suggested line | **Pass** |
| AC-014.9.5 | 014.9 | SQL | Alternative type not in the catalogue is rejected | as above | Alternative = random id | random | Rejected; nothing reserved | **Pass** |
| AC-014.9.6 | 014.9 | SQL | Alternative must differ from the requested type (A4) | as above | Alternative = Projector | Projector | Rejected | **Pass** |
| AC-014.9.7 | 014.9 | SQL | No alternative without a shortfall (A4) | `R1` fully available | Reserve 2 with alternative | Speaker | Rejected | **Pass** |
| AC-014.9.8 | 014.9 | SQL | Suggesting an alternative reserves nothing for it | after .9.3 | Inspect allocations | none | No allocations on the suggested line | **Pass** |
| AC-014.9.9 | 014.9 | Vitest | Alternative fields appear only for a shortfall | form for `R1` | Quantity 2, then 1 | 2, 1 | Hidden at 2; shown at 1 with the shortfall | **Pass** |
| AC-014.9.10 | 014.9 | Vitest | Alternative picker offers catalogue types except the requested one | catalogue of 3 | Open picker | none | Speaker and Wireless mic; not Projector | **Pass** |

## AC-014.10: Reservation linked and attributed

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.10.1 | 014.10 | SQL | Allocations link to the event, requirement, type and quantity (A8) | after .8.1 | Inspect | none | Requirement → line; line → booking for `E1`; line type = Projector; 2 allocations | **Pass** |
| AC-014.10.2 | 014.10 | SQL | Records who reserved and when | after .8.1 | Inspect allocations | none | `reserved_by` = TS1; `reserved_at` set to the reservation time | **Pass** |
| AC-014.10.3 | 014.10 | SQL | The reserving user cannot be faked | none | TS1 reserves | none | `reserved_by` is TS1 even if another id is passed; no parameter accepts one | **Pass** |
| AC-014.10.4 | 014.10 | SQL | The line records the assessment | after .9.3 | Inspect line | none | `assessed_by` = TS1, `assessed_at` set | **Pass** |
| AC-014.10.5 | 014.10 | SQL | One booking per event is reused | `E1` with two requirements | Reserve both | none | Both lines share one booking | **Pass** |

## AC-014.11: Reservations reduce availability for other events

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.11.1 | 014.11 | SQL | Overlapping event sees fewer units | `R1` reserved 2 of 3 | Availability for `E2` | none | 1 | **Pass** |
| AC-014.11.2 | 014.11 | SQL | A non-overlapping event is unaffected | as above | Availability for `E3` | none | 3 | **Pass** |
| AC-014.11.3 | 014.11 | SQL | US13 removal releases units and availability recovers | as above | C1 removes `R1`; availability for `E2` | none | 3 | **Pass** |
| AC-014.11.4 | 014.11 | SQL | US13 change releases units and returns the line for review | as above | C1 changes `R1` quantity 2 → 3 | 3 | `R1` pending again; `E2` availability 3 | **Pass** |
| AC-014.11.5 | 014.11 | SQL | Cancelled allocations do not block; any other status does (A6) | One cancelled, one returned allocation in the window | Availability | none | Cancelled unit counted; returned unit not | **Pass** |

## AC-014.12: Never beyond availability, even concurrently

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.12.1 | 014.12 | SQL | Reserving more than available is rejected | Requirement × 4; 3 available | Reserve 4 | 4 | Rejected with "only 3 available"; nothing reserved | **Pass** |
| AC-014.12.2 | 014.12 | SQL | Concurrency: two reservations together exceeding availability | 3 available; `E1` and `E2` each request 2 | Session A (`dblink`) reserves and holds its transaction open; session B reserves; A commits | 2 + 2 | Exactly one gets 2; the other gets a fresh check and is rejected or limited; never more than 3 allocations | **Pass** |
| AC-014.12.3 | 014.12 | SQL | Reservations for different types do not block each other | Projector and Wireless mic requirements | Two sessions reserve at once | none | Both succeed | **Pass** |
| AC-014.12.4 | 014.12 | SQL | A rejected reservation leaves nothing behind | as .12.1 | Inspect | none | No booking, line, allocation, status change or notification | **Pass** |
| AC-014.12.5 | 014.12 | SQL | Concurrency: extending a return date uses the same lock (A1) | `R1` reserved; another event reserving the same unit's next days | Run both at once | none | Never two non-cancelled allocations overlapping on one unit | **Pass** |

## AC-014.13: Event Coordinator notified of each outcome

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-014.13.1 | 014.13 | SQL | Full reservation notifies the assigned coordinator in-app | `R1` | TS1 reserves 2 | 2 | One in-app notice for C1: reserved 2 of 2 Projector | **Pass** |
| AC-014.13.2 | 014.13 | SQL | Partial: the notice includes the shortfall | Requirement × 3 | Reserve 2 | 2 | Notice: reserved 2 of 3, shortfall 1 | **Pass** |
| AC-014.13.3 | 014.13 | SQL | Unavailable with an alternative: the notice includes it | 0 available | Reserve 0 with `Speaker`, note | Speaker | Notice: unavailable, alternative Speaker, note | **Pass** |
| AC-014.13.4 | 014.13 | SQL | Email queued for the coordinator (#37) | email enabled | Reserve | none | One `notification_outbox` row to C1's email | **Pass** |
| AC-014.13.5 | 014.13 | SQL | Channels are configurable per notification type (#37, A5) | Defaults, then in-app off, then email off | Reserve each time | none | Both by default; then only email; then only in-app | **Pass** |
| AC-014.13.6 | 014.13 | SQL | One notification per requirement outcome | `E1` with two requirements | Reserve both | none | Exactly two notices, not one per unit | **Pass** |
| AC-014.13.7 | 014.13 | SQL | Only the assigned coordinator reads them; nobody forges them | after .13.1 | Read as C1, C2, TS1; write as each | none | C1 sees 1; C2 and TS1 see 0; all writes refused | **Pass** |
| AC-014.13.8 | 014.13 | SQL | A rejected reservation sends nothing | as .12.1 | Inspect | none | No notice, no email | **Pass** |
| AC-014.13.9 | 014.13 | Vitest | Service loads the coordinator's outcome notices | mocked rows | `loadOutcomeNotices(eventId)` | 3 rows | Newest first, typed | **Pass** |
| AC-014.13.10 | 014.13 | Vitest | Equipment page shows outcome notices to the coordinator (A9) | 3 notices | Render for C1 | none | "Reserved 2 of 2", "Partially reserved 2 of 3 (short 1)", "Unavailable, suggested Speaker" | **Pass** |
| AC-014.13.11 | 014.13 | Vitest | Boundary: no notices yet | 0 rows | Render | none | Nothing shown; no empty panel | **Pass** |

---

## Regression (not new test IDs)

- All 446 existing app tests pass, including US13's 57.
- All 203 existing database checks pass, including US13's 56.
- US13 rows added to the runner stay in place; US14's file is appended after them.

## Coverage summary

| AC | SQL | Vitest | Count |
|---|---|---|---|
| AC-014.1 | .1.1–.1.4 | .1.5–.1.8 | 8 |
| AC-014.2 | .2.1–.2.4 | .2.5–.2.6 | 6 |
| AC-014.3 | .3.1–.3.6 | .3.7–.3.9 | 9 |
| AC-014.4 | .4.1–.4.8 | .4.9–.4.11 | 11 |
| AC-014.5 | .5.1–.5.9 | none | 9 |
| AC-014.6 | .6.1–.6.5 | none | 5 |
| AC-014.7 | .7.1–.7.7 | .7.8–.7.9 | 9 |
| AC-014.8 | .8.1–.8.8 | .8.9–.8.11 | 11 |
| AC-014.9 | .9.1–.9.8 | .9.9–.9.10 | 10 |
| AC-014.10 | .10.1–.10.5 | none | 5 |
| AC-014.11 | .11.1–.11.5 | none | 5 |
| AC-014.12 | .12.1–.12.5 | none | 5 |
| AC-014.13 | .13.1–.13.8 | .13.9–.13.11 | 11 |
| **Total** | **82** | **22** | **104** |

Required categories:
- **Window boundaries:** .3.1–.3.6, .5.8
- **Transfer day only when held elsewhere:** .5.1–.5.6
- **Default and changed return date:** .4.1–.4.7, .4.9–.4.10
- **Damaged and maintenance excluded:** .6.1–.6.5
- **Full, partial and zero:** .8.1–.8.3, .9.1–.9.4
- **More than available rejected:** .6.4, .12.1
- **Concurrent reservations:** .12.2, .12.5
- **Availability drops, then recovers on US13 release:** .11.1–.11.4
- **Coordinator, Organiser and Attendee blocked:** .7.1–.7.3, .7.6
- **Linkage and attribution:** .10.1–.10.5
- **Coordinator notified for each outcome:** .13.1–.13.3
