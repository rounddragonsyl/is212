# US14 Reserve Equipment for an Event (SCRUM-20)

Technical Support reviews the equipment requirements recorded in US13, sees how many units
are free for each event's window, and reserves the full quantity, a partial quantity, or
none, optionally suggesting an alternative type. The Event Coordinator is notified of each
outcome. Test cases and results: [test-cases/US14_test_cases.md](test-cases/US14_test_cases.md).

## Deploying

1. Apply `backend/supabase/migrations/0021_equipment_reservations.sql` after 0020. It alters
   Nicole's 0019 tables, with her agreement:
   - allocations gain `reserved_at`
   - a booking's delivery venue may be empty
   - Technical Support's direct write policies on allocations, booking lines and bookings
     are replaced by read-only access
2. Shared Supabase needs units (`equipment_items`) at venues, and 0019's read policies on
   units, allocations and bookings, before the screens show anything. Check those first:
   `equipment_types` was found with no policies on 3 October.
3. Technical Support opens **Reserve equipment** (`/equipment/reservations`). Coordinators see
   the outcomes on each event's equipment page.

## How it works

| Part | What it does | Why |
|---|---|---|
| Window | Per unit: from the collection day (first SGT day − 1), or one day earlier if the unit is not at an approved venue of the event, through the return day | #5, #13, #36. Whole days mean same-day AM and PM events can never share a unit (epic rule). |
| Availability | Operational units of the type whose window overlaps no non-cancelled allocation | Damaged, under-repair, retired and missing units never count (AC-014.6). A unit held elsewhere is checked with its transfer day. |
| `reserve_equipment` | One function call: role check, lock, re-check, pick units, write the booking, line and allocations, set the requirement status, notify | The browser never checks and then writes separately, so nothing can slip in between. |
| Locking | A transaction-level advisory lock per equipment type | Two reservations of the same type queue up, and the second re-counts after the first commits (AC-014.12). Different types never wait for each other. 0019's no-double-allocation constraint stays as the final backstop. |
| SECURITY DEFINER | Every public function checks `current_user_role() = 'tech_support'` itself and sets `search_path = ''` | Units, allocations and venue bookings are hidden from most roles by design, so the functions need owner rights to read them. The role check is what admits only Technical Support. |
| Lockdown | Technical Support can still read allocations, lines and bookings, but no longer write them directly | Direct writes would skip the window, usable-unit and availability rules. |
| Release | Unchanged US13 triggers cancel a line's reserved allocations when a Coordinator changes or removes it | US14 links each requirement to its booking line (`booking_line_id`), which is the hook 0020 already uses. |
| Notifications | One per requirement outcome: an in-app row on US13's notification table, plus an email through the US4 outbox | Channels are configured in `equipment_notification_settings` (#37), with both on by default. |

## Team assumptions to confirm with the customer

A1 to A10 are listed in the test-case file. The ones most worth confirming:
- **A1:** the return date defaults to the last day and cannot be earlier; extending re-checks
  availability.
- **A2:** only approved venue bookings count for the transfer day, and any approved venue will do.
- **A3:** partial reservations are allowed only when fewer units are available than requested.
- **A4:** an alternative must be a different type, and only for a shortfall.

## Out of scope

- Topping up a partial reservation (#114).
- Coordinator accept/decline of alternatives (#90); 0019's parts are left untouched.
- Moving units between venues.
- A screen to change the return date: the database function and service exist, but no UI
  calls them yet.

## Next free test IDs

AC-014.1.9, .2.7, .3.10, .4.12, .5.10, .6.6, .7.10, .8.12, .9.11, .10.6, .11.6, .12.6, .13.12.
