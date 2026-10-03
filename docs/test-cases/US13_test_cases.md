# US13 Record Equipment Requirements for an Event: test cases

Status: **implemented**. The table was approved on 3 October; the tests were written and
shown failing before any implementation. On the final run, all 113 automated cases pass:
57 app tests (`npm test`) and 56 database checks
(`bash backend/supabase/tests/run_change_request_review.sh`, Docker only). Of the 3 manual
E2E cases, AC-013.1.25 and .4.19 passed on shared Supabase on 3 October. AC-013.6.22 is
deferred until US14 can create a reservation.
Design notes and the file-by-file change log are in
[docs/us13-equipment-requirements.md](../us13-equipment-requirements.md).

Changes to tests after approval, all without changing their intent:
- AC-013.1.9 now looks for "Projector" inside the requirement list, because the
  catalogue picker also offers it (approved on 3 October).
- AC-013.4.8, .6.16 and .6.19 assert their preconditions as well. Before that, they
  passed with no implementation at all.
- AC-013.6.4 passes changed notes and essential values instead of identical inputs.
- AC-013.4.8 uses E-UNASSIGNED, because AC-013.1.15 adds a requirement to E-CONF.

Test IDs follow the project format `AC-013.Y.Z`: Y is the acceptance criterion in Jira
order and Z numbers the tests within that criterion. Z is unique across the whole story
and increases top to bottom within each test file.

## Agreed design inputs

These are the decisions agreed on 3 October. The tests depend on them.

| # | Decision | Source |
|---|---|---|
| D1 | Requirements live in a new table, `event_equipment_requirements` (migration 0020). 0019 is not modified. A nullable `booking_line_id` links a requirement to the `equipment_booking_lines` row that US14 uses to reserve it. | Option (b), agreed |
| D2 | The assigned Coordinator is `events.coordinator_id` (0008). US17 is not needed. | Existing schema |
| D3 | Requirements can be changed while the event is `approved`, `planning` or `confirmed`. | Agreed |
| D4 | Stored status: `pending_review`, `reserved`, `partially_reserved`, `unavailable`. Only the database or US14 sets it, never the Coordinator. A Coordinator-set `essential` flag drives the **non-essential** display. | Agreed |
| D5 | Technical Support gets in-app notifications through a trigger, one row per Technical Support user, for **add, change and remove**. There is no email. | Agreed |
| D6 | "Reserved" in AC-013.6 includes **partially reserved**. A type or quantity change releases the held units and returns the line to pending review. Editing only the notes or the essential flag keeps the status. | Agreed |
| D7 | The "Organiser's original equipment needs" are the current `events.equipment_requirements` text. | Default; open for review |

### Assumptions (accepted with the table on 3 October)

| # | Assumption | Tests affected |
|---|---|---|
| A1 | **Display precedence:** reserved or partially reserved is shown even if the line is non-essential. Non-essential replaces pending review and unavailable. | AC-013.3.5–6 |
| A2 | Only the assigned Coordinator and Technical Support can read requirements. Other Coordinators, Organisers, Operations Managers, Venue Staff and Attendees cannot. | AC-013.3.16, AC-013.4.9 |
| A3 | Technical Support can read events that have at least one requirement, or that they have a notification about (so a "removed" notice still shows its event), and no other events. | AC-013.4.7–8 |
| A4 | Changing an **unavailable** or **pending** line does not change its status. The story only mentions reserved lines. | AC-013.6.6 |
| A5 | "Releasing" means cancelling allocations whose status is `reserved`. Allocations that are `checked_out` or `returned` describe physical units and are left alone. | AC-013.6.20 |
| A6 | Released allocations are kept with status `cancelled`, not deleted, so history survives. | AC-013.6.15 |
| A7 | There is no upper limit on quantity and no rule against two lines with the same type. The story sets neither. | AC-013.2.3 |

## Shared fixtures

UI and service tests use mocked Supabase, as the existing tests do. Database tests use the
disposable Docker database only, never shared Supabase.

| Fixture | Definition |
|---|---|
| Users | `C1` the assigned coordinator, `C2` another coordinator, `O1` the organiser who owns the events, `TS1` and `TS2` technical support, `M1` operations manager, `V1` venue staff, `A1` attendee |
| Catalogue | `Projector`, `Wireless mic` in `equipment_types`. `X` is a random UUID that is not in the catalogue. |
| Units | Projectors `P1`, `P2`, `P3` (operational) |
| `E-APP` | Approved event, coordinator `C1`, organiser text "2 projectors, 4 mics" |
| `E-PLAN`, `E-CONF` | Planning and confirmed events, coordinator `C1` |
| `E-BLOCKED` | One event each in draft, submitted, under_review, rejected, cancelled and completed, coordinator `C1` where assignment is allowed |
| `E-UNASSIGNED` | Approved event, `coordinator_id` null |
| `R-PENDING` | Requirement on `E-APP`: Projector × 2, unlinked, `pending_review` |
| `R-RESERVED` | Requirement on `E-APP`: Projector × 2, linked to a booking line with active `reserved` allocations of `P1` and `P2`, status `reserved`. Set up as admin to stand in for US14. |
| `R-PARTIAL` | As `R-RESERVED` but only `P1` allocated, status `partially_reserved` |

## Planned test files

| Type | File |
|---|---|
| Unit | `frontend/src/features/equipment/__tests__/validation.test.ts` |
| Integration (service, mocked) | `frontend/src/features/equipment/__tests__/equipmentRequirementService.test.ts` |
| Integration (UI) | `frontend/src/features/equipment/__tests__/EquipmentRequirementsEditor.test.tsx`, `TechSupportEquipmentView.test.tsx` |
| Integration (DB) | `backend/supabase/tests/equipment_requirements.sql`, run by the Docker runner, not CI |
| E2E (manual) | Steps below, run against the shared app with the README test accounts |

---

## AC-013.1: Only the assigned Coordinator records, edits or removes, for an approved event, with the Organiser's needs shown

| Test ID | AC | Type | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-013.1.1 | 013.1 | Unit | Assigned coordinator may manage requirements on eligible events | none | Call `canManageRequirements(event, user)` | status approved, planning, confirmed; user = C1, coordinator | `true` for all three | **Pass** |
| AC-013.1.2 | 013.1 | Unit | Non-eligible event statuses are blocked | none | Same call | status draft, submitted, under_review, rejected, cancelled, completed; user = C1 | `false` for all six | **Pass** |
| AC-013.1.3 | 013.1 | Unit | Permission denied: a different coordinator | none | Same call | approved event assigned to C1; user = C2 | `false` | **Pass** |
| AC-013.1.4 | 013.1 | Unit | Permission denied: a non-coordinator role whose id matches `coordinator_id` | none | Same call | roles organiser, tech_support, operations_manager, venue_staff, attendee | `false` for each | **Pass** |
| AC-013.1.5 | 013.1 | Unit | Boundary: no coordinator assigned | none | Same call | `coordinator_id` null | `false` for every user | **Pass** |
| AC-013.1.6 | 013.1 | Integration (service) | Loads the Organiser's original needs with the requirements | mocked client | Call `loadEventRequirements(eventId)` | event row with `equipment_requirements` "2 projectors, 4 mics" | Result contains the original text, event status, coordinator id and requirement lines in one query | **Pass** |
| AC-013.1.7 | 013.1 | Integration (service) | Failure: the database denies a write | mocked client returns code `42501` | Call `addRequirement` | valid input | Returns error "Only the assigned Event Coordinator can change equipment requirements." | **Pass** |
| AC-013.1.8 | 013.1 | Integration (service) | Failure: event not eligible | mocked client returns the not-eligible error | Call `addRequirement` | valid input | Returns error "Equipment requirements can only be changed for approved events." | **Pass** |
| AC-013.1.9 | 013.1 | Integration (UI) | Organiser's original needs shown alongside the editor | editor rendered for C1 on E-APP | Render | original text "2 projectors, 4 mics" | Text visible in a section labelled "Organiser's equipment request" next to the list | **Pass** |
| AC-013.1.10 | 013.1 | Integration (UI) | Boundary: Organiser listed no equipment | as above | Render | `equipment_requirements` null, then "   " | Shows "The organiser did not list any equipment." | **Pass** |
| AC-013.1.11 | 013.1 | Integration (UI) | Viewer without write permission sees no write controls (courtesy only) | `canManage` false | Render | TS1 or C2 viewing E-APP | No Add, Edit or Remove buttons; lines still listed | **Pass** |
| AC-013.1.12 | 013.1 | Integration (DB) | Assigned coordinator can add | E-APP | As C1, insert a requirement | Projector × 2 | 1 row inserted | **Pass** |
| AC-013.1.13 | 013.1 | Integration (DB) | Assigned coordinator can edit | R-PENDING | As C1, update quantity | 2 → 3 | 1 row updated | **Pass** |
| AC-013.1.14 | 013.1 | Integration (DB) | Assigned coordinator can remove | R-PENDING | As C1, delete | none | 1 row deleted | **Pass** |
| AC-013.1.15 | 013.1 | Integration (DB) | Planning and confirmed events also accept changes | E-PLAN, E-CONF | As C1, insert one requirement on each | Projector × 1 | Both inserted | **Pass** |
| AC-013.1.16 | 013.1 | Integration (DB) | Non-approved event: insert rejected | E-BLOCKED | As C1, insert on each | Projector × 1 | All six rejected; no rows | **Pass** |
| AC-013.1.17 | 013.1 | Integration (DB) | Boundary: unassigned event | E-UNASSIGNED | As C1 and as C2, insert | Projector × 1 | Both rejected | **Pass** |
| AC-013.1.18 | 013.1 | Integration (DB) | Permission denied: different coordinator | R-PENDING | As C2: insert on E-APP, update R-PENDING, delete R-PENDING | Projector × 1 | Insert rejected; update and delete affect 0 rows; R-PENDING unchanged | **Pass** |
| AC-013.1.19 | 013.1 | Integration (DB) | Permission denied: the event's Organiser | E-APP owned by O1 | As O1, insert | Projector × 1 | Rejected | **Pass** |
| AC-013.1.20 | 013.1 | Integration (DB) | Permission denied: Technical Support writes | R-PENDING | As TS1: insert, update, delete | Projector × 1 | Insert rejected; update and delete affect 0 rows | **Pass** |
| AC-013.1.21 | 013.1 | Integration (DB) | Permission denied: Operations Manager | E-APP | As M1, insert | Projector × 1 | Rejected | **Pass** |
| AC-013.1.22 | 013.1 | Integration (DB) | Conflict: a requirement cannot be moved to another event | R-PENDING; E-PLAN also assigned to C1 | As C1, update `event_id` to E-PLAN | none | Rejected; `event_id` unchanged | **Pass** |
| AC-013.1.23 | 013.1 | Integration (DB) | Conflict: coordinator reassigned | R-PENDING; M1 reassigns E-APP to C2 | As C1 update; then as C2 update | quantity 3 | C1's update affects 0 rows; C2's succeeds | **Pass** |
| AC-013.1.24 | 013.1 | Integration (DB) | Existing lines lock when the event leaves the eligible statuses | R-PENDING; E-APP moved to cancelled (admin) | As C1, update and delete | quantity 3 | Both rejected; row unchanged | **Pass** |
| AC-013.1.25 | 013.1 | E2E (manual) | Coordinator records, edits and removes with the Organiser's request visible | Shared app; C1 account assigned to an approved event | Sign in as C1 → open event → Equipment → add Projector × 2 → edit to 3 → remove | Projector, 2, then 3 | Organiser's text visible throughout; each change is reflected after reload | **Pass** (3 Oct, shared Supabase, EVT-2026-0015: add, edit 2→3 and remove as coordinator@test.com; changes confirmed in the database) |

## AC-013.2: Equipment type from the catalogue, quantity of at least 1, and technical requirements

| Test ID | AC | Type | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-013.2.1 | 013.2 | Unit | Valid requirement accepted | catalogue [Projector, Wireless mic] | `validateRequirement(input, catalogue)` | Projector, quantity 3, notes "HDMI, 4K" | Valid; returns typed value | **Pass** |
| AC-013.2.2 | 013.2 | Unit | Boundary: quantity 1 | same | same | quantity 1 | Valid | **Pass** |
| AC-013.2.3 | 013.2 | Unit | Boundary: large quantity (no upper limit in story, A7) | same | same | quantity 500 | Valid | **Pass** |
| AC-013.2.4 | 013.2 | Unit | Boundary: quantity 0 | same | same | quantity 0 | Error on quantity: "Quantity must be at least 1." | **Pass** |
| AC-013.2.5 | 013.2 | Unit | Boundary: negative quantity | same | same | quantity −1 | Same error | **Pass** |
| AC-013.2.6 | 013.2 | Unit | Boundary: non-integer quantity | same | same | quantity 1.5 | Error: "Quantity must be a whole number." | **Pass** |
| AC-013.2.7 | 013.2 | Unit | Boundary: blank or non-numeric quantity | same | same | "", "abc" | Error on quantity for each | **Pass** |
| AC-013.2.8 | 013.2 | Unit | Missing equipment type | same | same | type empty | Error: "Choose an equipment type." | **Pass** |
| AC-013.2.9 | 013.2 | Unit | Equipment type not in the catalogue | same | same | type X | Error: "Choose an equipment type from the catalogue." | **Pass** |
| AC-013.2.10 | 013.2 | Unit | Technical requirements are optional | same | same | notes "", "   " | Valid; notes become `null` | **Pass** |
| AC-013.2.11 | 013.2 | Unit | Technical requirements are trimmed | same | same | "  needs HDMI  " | Notes "needs HDMI" | **Pass** |
| AC-013.2.12 | 013.2 | Integration (service) | Save sends only fields the Coordinator controls | mocked client | `addRequirement` | valid input | Insert payload has exactly `event_id`, `type_id`, `quantity`, `technical_notes`, `essential`; no status, link or creator | **Pass** |
| AC-013.2.13 | 013.2 | Integration (service) | Invalid input never reaches Supabase | mocked client | `addRequirement` | quantity 0 | Returns field errors; client not called | **Pass** |
| AC-013.2.14 | 013.2 | Integration (service) | Failure: type removed from catalogue between loading and saving | mocked client returns `23503` | `addRequirement` | valid input | Error: "That equipment type is no longer in the catalogue." | **Pass** |
| AC-013.2.15 | 013.2 | Integration (service) | Catalogue loaded for the picker | mocked rows | `loadCatalogue()` | 2 types | Sorted by category, then name | **Pass** |
| AC-013.2.16 | 013.2 | Integration (UI) | Picker lists catalogue types | catalogue loaded | Open Add form | 2 types | Both offered; free text not accepted | **Pass** |
| AC-013.2.17 | 013.2 | Integration (UI) | Quantity validation shown and save blocked | Add form | Enter 0, submit | quantity 0 | Error shown next to quantity; service not called | **Pass** |
| AC-013.2.18 | 013.2 | Integration (UI) | Boundary: empty catalogue | catalogue [] | Render | none | Message "No equipment types in the catalogue yet."; Add disabled | **Pass** |
| AC-013.2.19 | 013.2 | Integration (UI) | Failure: catalogue fails to load | service returns error | Render | none | Error message shown; Add disabled | **Pass** |
| AC-013.2.20 | 013.2 | Integration (DB) | Quantity 0 rejected by the database | E-APP | As C1, insert | quantity 0 | Check violation; no row | **Pass** |
| AC-013.2.21 | 013.2 | Integration (DB) | Negative quantity rejected | E-APP | As C1, insert | quantity −1 | Check violation | **Pass** |
| AC-013.2.22 | 013.2 | Integration (DB) | Quantity 1 accepted | E-APP | As C1, insert | quantity 1 | Inserted | **Pass** |
| AC-013.2.23 | 013.2 | Integration (DB) | Non-integer is rejected, not rounded | E-APP | As C1, insert via a JSON record as PostgREST would | `{"quantity": 1.5}` | Error; no row with quantity 1 or 2 | **Pass** |
| AC-013.2.24 | 013.2 | Integration (DB) | Type not in catalogue rejected | E-APP | As C1, insert | type X | Foreign-key violation | **Pass** |
| AC-013.2.25 | 013.2 | Integration (DB) | Technical requirements stored, or null | E-APP | As C1, insert two lines | "HDMI, 4K"; null | Both stored as given | **Pass** |
| AC-013.2.26 | 013.2 | Integration (DB) | Creator cannot be forged | E-APP | As C1, insert with `created_by` = C2 | C2's id | Rejected, or stored as C1; never C2 | **Pass** |

## AC-013.3: Coordinator can view each requirement's status

| Test ID | AC | Type | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-013.3.1 | 013.3 | Unit | Pending review | none | `requirementDisplayStatus(status, essential)` | pending_review, true | "Pending review" | **Pass** |
| AC-013.3.2 | 013.3 | Unit | Reserved | none | same | reserved, true | "Reserved" | **Pass** |
| AC-013.3.3 | 013.3 | Unit | Partially reserved | none | same | partially_reserved, true | "Partially reserved" | **Pass** |
| AC-013.3.4 | 013.3 | Unit | Unavailable | none | same | unavailable, true | "Unavailable" | **Pass** |
| AC-013.3.5 | 013.3 | Unit | Non-essential replaces pending and unavailable (A1) | none | same | pending_review, false; unavailable, false | "Non-essential" for both | **Pass** |
| AC-013.3.6 | 013.3 | Unit | Reservation outranks non-essential (A1) | none | same | reserved, false; partially_reserved, false | "Reserved"; "Partially reserved" | **Pass** |
| AC-013.3.7 | 013.3 | Integration (service) | Rows mapped to display statuses | mocked rows, one per status | `loadEventRequirements` | 5 rows | Each line carries the expected display status | **Pass** |
| AC-013.3.8 | 013.3 | Integration (service) | Failure: load error | mocked error | `loadEventRequirements` | none | Error result; no partial data | **Pass** |
| AC-013.3.9 | 013.3 | Integration (UI) | Each line shows its status | 5 lines, one per display status | Render as C1 | none | Five badges with the five labels | **Pass** |
| AC-013.3.10 | 013.3 | Integration (UI) | Boundary: no requirements yet | 0 lines | Render | none | "No equipment requirements recorded yet." | **Pass** |
| AC-013.3.11 | 013.3 | Integration (UI) | Coordinator marks a line non-essential | Add form | Untick "Essential", save | Wireless mic × 1 | Service called with `essential: false` | **Pass** |
| AC-013.3.12 | 013.3 | Integration (DB) | New requirement starts pending review | E-APP | As C1, insert | Projector × 1 | status `pending_review` | **Pass** |
| AC-013.3.13 | 013.3 | Integration (DB) | Coordinator cannot insert a status | E-APP | As C1, insert with status reserved | reserved | Rejected | **Pass** |
| AC-013.3.14 | 013.3 | Integration (DB) | Coordinator cannot change a status | R-PENDING | As C1, update status | reserved | Rejected; still pending_review | **Pass** |
| AC-013.3.15 | 013.3 | Integration (DB) | Coordinator can set essential | R-PENDING | As C1, update | essential false | Updated | **Pass** |
| AC-013.3.16 | 013.3 | Integration (DB) | Assigned coordinator reads statuses; others cannot (A2) | R-PENDING, R-RESERVED | Select as C1, then as C2 | none | C1 sees both with statuses; C2 sees 0 rows | **Pass** |
| AC-013.3.17 | 013.3 | Integration (DB) | Unknown status rejected | R-PENDING | As admin, set status | "lost" | Check violation | **Pass** |

## AC-013.4: All Technical Support Staff can view requirements and are notified when they are added or changed

| Test ID | AC | Type | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-013.4.1 | 013.4 | Integration (service) | Technical Support list | mocked rows | `loadAllRequirements()` | 2 events | Lines include event reference, name, dates, type name, quantity, notes, display status | **Pass** |
| AC-013.4.2 | 013.4 | Integration (service) | Technical Support notifications | mocked rows | `loadMyEquipmentNotifications()` | 3 rows | Newest first | **Pass** |
| AC-013.4.3 | 013.4 | Integration (service) | Failure: notification load error | mocked error | same | none | Error result | **Pass** |
| AC-013.4.4 | 013.4 | Integration (UI) | Read-only Technical Support view | requirements loaded | Render as TS1 | 2 lines | All fields and statuses shown; no Add, Edit or Remove | **Pass** |
| AC-013.4.5 | 013.4 | Integration (UI) | Notification list | 3 notifications | Render | added, changed, removed | Each shows the action, event reference and equipment type | **Pass** |
| AC-013.4.6 | 013.4 | Integration (DB) | Every Technical Support user reads requirements on any event | R-PENDING (E-APP), one line on E-PLAN | Select as TS1, then TS2 | none | Both see both lines | **Pass** |
| AC-013.4.7 | 013.4 | Integration (DB) | Technical Support sees context for events with requirements (A3) | as above | As TS1, select reference, name and dates from events | none | E-APP and E-PLAN visible | **Pass** |
| AC-013.4.8 | 013.4 | Integration (DB) | No over-sharing: events without requirements (A3) | E-UNASSIGNED has none | As TS1, select E-UNASSIGNED | none | 0 rows | **Pass** |
| AC-013.4.9 | 013.4 | Integration (DB) | Permission denied: other roles read nothing (A2) | R-PENDING | Select as O1, M1, V1, A1 | none | 0 rows each | **Pass** |
| AC-013.4.10 | 013.4 | Integration (DB) | Adding notifies every Technical Support user | TS1, TS2 exist | As C1, insert | Projector × 2 | Exactly 2 notifications, action `added`, one each for TS1 and TS2 | **Pass** |
| AC-013.4.11 | 013.4 | Integration (DB) | Quantity change notifies | R-PENDING | As C1, update quantity | 2 → 3 | 1 `changed` per Technical Support user | **Pass** |
| AC-013.4.12 | 013.4 | Integration (DB) | Notes-only change notifies | R-PENDING | As C1, update notes | "needs HDMI" | 1 `changed` per Technical Support user | **Pass** |
| AC-013.4.13 | 013.4 | Integration (DB) | Removal notifies (D5) and the notice survives deletion | R-PENDING | As C1, delete | none | 1 `removed` per Technical Support user, with event, type and quantity kept | **Pass** |
| AC-013.4.14 | 013.4 | Integration (DB) | Boundary: an update that changes nothing | R-PENDING | As C1, update quantity to the same value | 2 → 2 | No notification | **Pass** |
| AC-013.4.15 | 013.4 | Integration (DB) | Status set by the system (US14 stand-in) does not notify | R-PENDING | As admin, set status reserved | reserved | No notification | **Pass** |
| AC-013.4.16 | 013.4 | Integration (DB) | Users read only their own notifications | after AC-013.4.10 | Select as TS1, TS2, C1 | none | TS1 sees 1, TS2 sees 1, C1 sees 0 | **Pass** |
| AC-013.4.17 | 013.4 | Integration (DB) | Browser cannot forge or remove notifications | any | As TS1 and C1: insert, update, delete | forged row | All rejected or affect 0 rows | **Pass** |
| AC-013.4.18 | 013.4 | Integration (DB) | Boundary: no Technical Support users exist | TS users' roles set elsewhere (admin) | As C1, insert | Projector × 1 | Insert succeeds; 0 notifications | **Pass** |
| AC-013.4.19 | 013.4 | E2E (manual) | Technical Support is notified and can view | After AC-013.1.25 steps | Sign in as TS1 → Equipment | none | Notifications for add, change and remove; current requirements listed read-only | **Pass** (3 Oct: tech@test.com received added, changed and removed notifications with the event reference; the Technical Support view was not screenshotted) |

## AC-013.5: Recording a requirement does not reserve equipment

| Test ID | AC | Type | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-013.5.1 | 013.5 | Integration (service) | Saving touches only the requirements table | mocked client | `addRequirement`, `updateRequirement` | valid input | `from()` is called only with `event_equipment_requirements`; no booking or allocation tables, no RPC | **Pass** |
| AC-013.5.2 | 013.5 | Integration (UI) | A newly added line shows pending review | Add form | Save Projector × 2 | service returns new row | Line shows "Pending review", never "Reserved" | **Pass** |
| AC-013.5.3 | 013.5 | Integration (DB) | Recording creates no booking, booking line or allocation | counts taken first | As C1, insert | Projector × 3 | Counts of `equipment_bookings`, `equipment_booking_lines` and `equipment_allocations` unchanged | **Pass** |
| AC-013.5.4 | 013.5 | Integration (DB) | No reservation link and stock unchanged | as above | Inspect the new row and `equipment_stock` | none | `booking_line_id` null; stock figures unchanged | **Pass** |
| AC-013.5.5 | 013.5 | Integration (DB) | Conflict: Coordinator cannot link a reservation on insert | an existing fulfilled booking line | As C1, insert with `booking_line_id` set | that line's id | Rejected | **Pass** |
| AC-013.5.6 | 013.5 | Integration (DB) | Conflict: Coordinator cannot link a reservation on update | R-PENDING | As C1, update `booking_line_id` | same id | Rejected; still null | **Pass** |
| AC-013.5.7 | 013.5 | Integration (DB) | Editing a pending line reserves nothing | R-PENDING | As C1, update quantity | 2 → 5 | Allocation count unchanged | **Pass** |

## AC-013.6: Changing a reserved requirement's type or quantity returns it to pending review; removing one releases its equipment

| Test ID | AC | Type | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-013.6.1 | 013.6 | Unit | Reserved line, quantity changed | none | `changeReturnsToPendingReview(before, after)` | reserved; 2 → 3 | `true` | **Pass** |
| AC-013.6.2 | 013.6 | Unit | Reserved line, type changed | none | same | reserved; Projector → Wireless mic | `true` | **Pass** |
| AC-013.6.3 | 013.6 | Unit | Partially reserved line, quantity changed (D6) | none | same | partially_reserved; 2 → 1 | `true` | **Pass** |
| AC-013.6.4 | 013.6 | Unit | Notes or essential changed only | none | same | reserved; notes changed; essential changed | `false` for both | **Pass** |
| AC-013.6.5 | 013.6 | Unit | Boundary: same quantity re-entered | none | same | reserved; 2 → 2 | `false` | **Pass** |
| AC-013.6.6 | 013.6 | Unit | Nothing reserved, so no status change (A4) | none | same | pending_review or unavailable; type changed | `false` | **Pass** |
| AC-013.6.7 | 013.6 | Integration (UI) | Warning before changing a reserved line's type or quantity | line R-RESERVED | Edit quantity 2 → 3 | none | Warning "Saving returns this line to pending review and releases its reserved equipment." shown before save | **Pass** |
| AC-013.6.8 | 013.6 | Integration (UI) | Warning before removing a reserved line | line R-RESERVED | Click Remove | none | Confirmation mentions releasing reserved equipment; nothing removed until confirmed | **Pass** |
| AC-013.6.9 | 013.6 | Integration (UI) | Line shows pending review after the change | service returns updated row | Confirm save | status pending_review | Badge "Pending review" | **Pass** |
| AC-013.6.10 | 013.6 | Integration (DB) | Reserved line, quantity change → pending review | R-RESERVED | As C1, update quantity | 2 → 3 | status `pending_review` | **Pass** |
| AC-013.6.11 | 013.6 | Integration (DB) | Reserved line, type change → pending review | R-RESERVED | As C1, update type | Wireless mic | status `pending_review` | **Pass** |
| AC-013.6.12 | 013.6 | Integration (DB) | Partially reserved line, quantity change → pending review | R-PARTIAL | As C1, update quantity | 2 → 1 | status `pending_review` | **Pass** |
| AC-013.6.13 | 013.6 | Integration (DB) | That change releases the held units | R-RESERVED | As in AC-013.6.10, then inspect as admin | none | P1 and P2 allocations `cancelled`; `booking_line_id` null; the line's `quantity_reserved` is 0 | **Pass** |
| AC-013.6.14 | 013.6 | Integration (DB) | Notes-only edit keeps the reservation | R-RESERVED | As C1, update notes | "needs HDMI" | Still `reserved`; link and allocations unchanged | **Pass** |
| AC-013.6.15 | 013.6 | Integration (DB) | Removing a reserved line releases its equipment (A6) | R-RESERVED | As C1, delete | none | Row gone; P1 and P2 allocations still exist with status `cancelled` | **Pass** |
| AC-013.6.16 | 013.6 | Integration (DB) | Released units can be reserved again | after AC-013.6.15 | As admin, allocate P1 to another line for overlapping dates | same dates | Succeeds; the exclusion constraint no longer blocks it | **Pass** |
| AC-013.6.17 | 013.6 | Integration (DB) | Removing a partially reserved line releases its unit | R-PARTIAL | As C1, delete | none | P1 allocation `cancelled` | **Pass** |
| AC-013.6.18 | 013.6 | Integration (DB) | Removing a pending line changes no allocations | R-PENDING | As C1, delete | none | Allocation table unchanged | **Pass** |
| AC-013.6.19 | 013.6 | Integration (DB) | Conflict: release touches only this line's units | R-RESERVED; another event holds P3 | As C1, delete R-RESERVED | none | P3 allocation still `reserved` | **Pass** |
| AC-013.6.20 | 013.6 | Integration (DB) | Units already checked out or returned are left alone (A5) | R-RESERVED with P1 `checked_out` | As C1, delete | none | P1 stays `checked_out`; P2 becomes `cancelled` | **Pass** |
| AC-013.6.21 | 013.6 | Integration (DB) | Permission denied: another coordinator cannot trigger a release | R-RESERVED | As C2, delete and update quantity | 2 → 3 | 0 rows affected; status and allocations unchanged | **Pass** |
| AC-013.6.22 | 013.6 | E2E (manual) | Reserved line returns to pending review, then is released | Shared app; an admin links a requirement to allocations, standing in for US14 until it exists | As C1: change quantity, check status; reserve again; remove | quantity 2 → 3 | Status "Pending review" after the change; after removal TS1 sees the units free | Deferred until US14 (no way to create a reservation in the app yet; behaviour covered by AC-013.6.1–.21) |

---

## Coverage summary

| AC | Unit | Integration (service) | Integration (UI) | Integration (DB) | E2E | Count |
|---|---|---|---|---|---|---|
| AC-013.1 | .1.1–.1.5 | .1.6–.1.8 | .1.9–.1.11 | .1.12–.1.24 | .1.25 | 25 |
| AC-013.2 | .2.1–.2.11 | .2.12–.2.15 | .2.16–.2.19 | .2.20–.2.26 | (in .1.25) | 26 |
| AC-013.3 | .3.1–.3.6 | .3.7–.3.8 | .3.9–.3.11 | .3.12–.3.17 | n/a | 17 |
| AC-013.4 | n/a | .4.1–.4.3 | .4.4–.4.5 | .4.6–.4.18 | .4.19 | 19 |
| AC-013.5 | n/a | .5.1 | .5.2 | .5.3–.5.7 | n/a | 7 |
| AC-013.6 | .6.1–.6.6 | n/a | .6.7–.6.9 | .6.10–.6.21 | .6.22 | 22 |
| **Total** | 28 | 13 | 16 | 56 | 3 | **116** |

Required categories, by test ID:

- **Boundary:** quantity 0 (.2.4, .2.20), 1 (.2.2, .2.22), negative (.2.5, .2.21), non-integer (.2.6, .2.23), blank or non-numeric (.2.7), type not in catalogue (.2.9, .2.24), empty catalogue (.2.18), no organiser text (.1.10), no-op update (.4.14), same quantity (.6.5), no Technical Support users (.4.18).
- **Permission denied:** different Coordinator (.1.3, .1.18, .3.16, .6.21), Organiser (.1.4, .1.19), Technical Support writing (.1.4, .1.20), Operations Manager (.1.21), other roles reading (.4.9), forged fields (.2.26, .3.13–.3.14, .5.5–.5.6, .4.17).
- **Non-approved event:** .1.2, .1.16, .1.17, .1.24.
- **Failure:** .1.7, .1.8, .2.14, .2.19, .3.8, .4.3.
- **Conflict:** .1.22, .1.23, .5.5, .5.6, .6.19.
