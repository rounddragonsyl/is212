import { describe, expect, test } from 'vitest'
import { buildTimetable, timetableCellLabel } from '../venueTimetable'
import type { TimetableClaimRow } from '../venueTimetable'
import { SLOTS } from './fixtures/venueBooking'

/** PURE. Turns claim rows into the grid a calendar draws. */

const claim = (overrides: Partial<TimetableClaimRow> = {}): TimetableClaimRow => ({
  slot_date: '2026-10-12', slot: 'AM', kind: 'event', booking_id: 'b-1',
  booking_status: 'confirmed', event_reference: 'EVT-1', closure_reason: null, ...overrides,
})

const grid = (claims: TimetableClaimRow[], days = 2) =>
  buildTimetable(SLOTS, claims, '2026-10-12', days)

describe('AC-010.5 — the calendar shows every kind of occupancy', () => {
  test('AC-010.5.1: a date with no claims is three free cells', () => {
    const { days } = grid([], 1)
    expect(days).toHaveLength(1)
    expect(days[0].map((cell) => `${cell.slot} ${cell.state}`)).toEqual(['AM free', 'PM free', 'NIGHT free'])
  })
  test('AC-010.5.2: the grid always spans the requested days, in order', () => {
    const { days } = grid([], 7)
    expect(days).toHaveLength(7)
    expect(days.map((day) => day[0].date)).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ])
  })
  test('AC-010.5.3: a tentative hold reads as "Tentatively held"', () => {
    const { days } = grid([claim({ booking_status: 'held' })])
    expect(days[0][0].state).toBe('held')
    expect(timetableCellLabel(days[0][0])).toBe('Tentatively held')
  })
  test('AC-010.5.4: a submitted request is distinguishable from a confirmed booking', () => {
    const { days } = grid([
      claim({ booking_status: 'pending_approval' }),
      claim({ slot: 'PM', booking_status: 'confirmed' }),
    ])
    expect(timetableCellLabel(days[0][0])).toBe('Awaiting Venue Staff')
    expect(timetableCellLabel(days[0][1])).toBe('Confirmed booking')
  })
  test('AC-010.5.5: a setup or turnaround cell is labelled as such, not as the event itself', () => {
    const { days } = grid([claim({ kind: 'buffer', booking_status: 'held' })])
    expect(days[0][0].role).toBe('buffer')
    expect(timetableCellLabel(days[0][0])).toBe('Tentatively held (setup/turnaround)')
  })
  test('AC-010.5.6: a Venue Staff block shows as blocked and carries its reason', () => {
    const { days } = grid([claim({
      kind: 'maintenance', booking_id: null, booking_status: null,
      event_reference: null, closure_reason: 'Floor resurfacing',
    })])
    expect(days[0][0].state).toBe('maintenance')
    expect(days[0][0].closureReason).toBe('Floor resurfacing')
    expect(days[0][0].role).toBeNull()
  })
  test('AC-010.5.7: an occupied cell carries the event reference, so staff see whose booking it is', () => {
    const { days } = grid([claim()])
    expect(days[0][0].eventReference).toBe('EVT-1')
    expect(days[0][0].bookingId).toBe('b-1')
  })
  test('AC-010.5.8: claims outside the window are ignored', () => {
    const { days } = grid([claim({ slot_date: '2026-11-20' })], 2)
    expect(days.flat().every((cell) => cell.state === 'free')).toBe(true)
  })
  test('AC-010.5.9: slots defined out of order still render AM, PM, Night top to bottom', () => {
    const { days } = buildTimetable([SLOTS[2], SLOTS[0], SLOTS[1]], [], '2026-10-12', 1)
    expect(days[0].map((cell) => cell.slot)).toEqual(['AM', 'PM', 'NIGHT'])
  })
})

describe('AC-010.8 — released slots return to available', () => {
  test.each(['rejected', 'cancelled', 'expired'] as const)(
    'AC-010.8.1: a claim left behind by a %s booking is not drawn as occupied', (status) => {
      const { days } = grid([claim({ booking_status: status })])
      expect(days[0][0].state).toBe('free')
    },
  )
  test('AC-010.8.2: a claim with no booking attached is not drawn as occupied', () => {
    const { days } = grid([claim({ booking_status: null })])
    expect(days[0][0].state).toBe('free')
  })
  test('AC-010.8.3: a maintenance block has no booking, and is still drawn', () => {
    const { days } = grid([claim({ kind: 'maintenance', booking_id: null, booking_status: null, closure_reason: 'Repair' })])
    expect(days[0][0].state).toBe('maintenance')
  })
})
