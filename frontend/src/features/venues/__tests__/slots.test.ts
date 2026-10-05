import { describe, expect, test } from 'vitest'
import { claimsForEvent, datesFrom, nextCell, prevCell, slotWindow, slotsForRange } from '../slots'
import { SLOTS, sgt } from './fixtures/venueBooking'

/**
 * PURE. No Supabase, no mocks. These rules decide which slots a booking consumes, so a
 * mistake here silently mis-books every venue; they deserve direct tests.
 */

const cells = (start: string, end: string) =>
  slotsForRange(new Date(start), new Date(end), SLOTS).map((cell) => `${cell.date} ${cell.slot}`)
const claims = (start: string, end: string, kind: 'event' | 'buffer') =>
  claimsForEvent(new Date(start), new Date(end), SLOTS)
    .filter((cell) => cell.kind === kind)
    .map((cell) => `${cell.date} ${cell.slot}`)

describe('slotsForRange — a slot is consumed in full if the event touches it at all', () => {
  test.each([
    ['AC-009.2.1', 'a morning event', '09:00', '11:00', ['2026-10-12 AM']],
    ['AC-009.2.2', 'an afternoon event', '14:00', '17:00', ['2026-10-12 PM']],
    ['AC-009.2.3', 'an evening event', '20:00', '23:00', ['2026-10-12 NIGHT']],
    ['AC-009.2.4', 'consecutive AM+PM', '09:00', '15:00', ['2026-10-12 AM', '2026-10-12 PM']],
    ['AC-009.2.5', 'consecutive PM+Night', '14:00', '22:00', ['2026-10-12 PM', '2026-10-12 NIGHT']],
    ['AC-009.2.6', 'a full day', '08:00', '21:00', ['2026-10-12 AM', '2026-10-12 PM', '2026-10-12 NIGHT']],
    ['AC-009.2.7', 'part of AM and part of PM', '11:00', '14:00', ['2026-10-12 AM', '2026-10-12 PM']],
    ['AC-009.2.8', 'an event ending exactly at noon', '07:00', '12:00', ['2026-10-12 AM']],
    ['AC-009.2.9', 'an event starting exactly at 1pm', '13:00', '15:00', ['2026-10-12 PM']],
  ])('%s: %s consumes %j', (_id, _label, from, to, expected) => {
    expect(cells(sgt('2026-10-12', from), sgt('2026-10-12', to))).toEqual(expected)
  })

  test('AC-009.2.10: an event running across days consumes every slot it touches', () => {
    expect(cells(sgt('2026-10-12', '20:00'), sgt('2026-10-14', '11:00'))).toEqual([
      '2026-10-12 NIGHT', '2026-10-13 AM', '2026-10-13 PM', '2026-10-13 NIGHT', '2026-10-14 AM',
    ])
  })

  test('AC-009.2.11: an event falling between slots consumes nothing', () => {
    expect(cells(sgt('2026-10-12', '12:15'), sgt('2026-10-12', '12:45'))).toEqual([])
  })

  test('AC-009.2.12: slots are returned in time order even when defined out of order', () => {
    const shuffled = [SLOTS[2], SLOTS[0], SLOTS[1]]
    const result = slotsForRange(
      new Date(sgt('2026-10-12', '08:00')), new Date(sgt('2026-10-12', '21:00')), shuffled,
    )
    expect(result.map((cell) => cell.slot)).toEqual(['AM', 'PM', 'NIGHT'])
  })
})

describe('nextCell and prevCell — adjacency, including across days', () => {
  test('AC-009.5.1: after NIGHT comes the next day’s AM', () => {
    expect(nextCell({ date: '2026-10-12', slot: 'NIGHT' }, SLOTS)).toEqual({ date: '2026-10-13', slot: 'AM' })
  })
  test('AC-009.5.2: before AM comes the previous day’s NIGHT', () => {
    expect(prevCell({ date: '2026-10-12', slot: 'AM' }, SLOTS)).toEqual({ date: '2026-10-11', slot: 'NIGHT' })
  })
  test('AC-009.5.3: adjacency crosses a month boundary', () => {
    expect(prevCell({ date: '2026-11-01', slot: 'AM' }, SLOTS)).toEqual({ date: '2026-10-31', slot: 'NIGHT' })
  })
  test('AC-009.5.4: adjacency crosses a year boundary', () => {
    expect(nextCell({ date: '2026-12-31', slot: 'NIGHT' }, SLOTS)).toEqual({ date: '2027-01-01', slot: 'AM' })
  })
  test('AC-009.5.5: within a day, adjacency is simply the neighbouring slot', () => {
    expect(nextCell({ date: '2026-10-12', slot: 'AM' }, SLOTS)).toEqual({ date: '2026-10-12', slot: 'PM' })
    expect(prevCell({ date: '2026-10-12', slot: 'NIGHT' }, SLOTS)).toEqual({ date: '2026-10-12', slot: 'PM' })
  })
})

describe('claimsForEvent — setup before, turnaround after', () => {
  test.each([
    ['AC-009.5.6', 'AM', '09:00', '11:00', ['2026-10-11 NIGHT', '2026-10-12 PM']],
    ['AC-009.5.7', 'PM', '14:00', '17:00', ['2026-10-12 AM', '2026-10-12 NIGHT']],
    ['AC-009.5.8', 'Night', '20:00', '23:00', ['2026-10-12 PM', '2026-10-13 AM']],
    ['AC-009.5.9', 'AM+PM', '09:00', '15:00', ['2026-10-11 NIGHT', '2026-10-12 NIGHT']],
    ['AC-009.5.10', 'a full day', '08:00', '21:00', ['2026-10-11 NIGHT', '2026-10-13 AM']],
  ])('%s: a %s booking also holds %j', (_id, _label, from, to, buffers) => {
    expect(claims(sgt('2026-10-12', from), sgt('2026-10-12', to), 'buffer')).toEqual(buffers)
  })

  test('AC-009.5.11: a multi-slot booking gets no buffer between its own slots', () => {
    const all = claimsForEvent(
      new Date(sgt('2026-10-12', '09:00')), new Date(sgt('2026-10-12', '15:00')), SLOTS,
    )
    expect(all.map((cell) => `${cell.date} ${cell.slot} ${cell.kind}`)).toEqual([
      '2026-10-11 NIGHT buffer', '2026-10-12 AM event', '2026-10-12 PM event', '2026-10-12 NIGHT buffer',
    ])
  })

  test('AC-009.5.12: a multi-day booking is buffered only at its outer ends', () => {
    expect(claims(sgt('2026-10-12', '20:00'), sgt('2026-10-14', '11:00'), 'buffer'))
      .toEqual(['2026-10-12 PM', '2026-10-14 PM'])
  })

  test('AC-009.5.13: an event outside every slot claims nothing at all, not even buffers', () => {
    expect(claimsForEvent(
      new Date(sgt('2026-10-12', '12:15')), new Date(sgt('2026-10-12', '12:45')), SLOTS,
    )).toEqual([])
  })
})

describe('slotWindow and datesFrom', () => {
  test('AC-009.2.13: a date and slot code become that slot’s real start and end instants', () => {
    const { start, end } = slotWindow('2026-10-12', 'AM', SLOTS)
    expect(start.toISOString()).toBe('2026-10-11T23:00:00.000Z') // 07:00 Singapore
    expect(end.toISOString()).toBe('2026-10-12T04:00:00.000Z')   // 12:00 Singapore
  })
  test('AC-009.2.14: an unknown slot code is rejected rather than silently skipped', () => {
    expect(() => slotWindow('2026-10-12', 'AM', [])).toThrow(/Unknown slot code/)
  })
  test('AC-009.2.15: datesFrom walks consecutive days across a month boundary', () => {
    expect(datesFrom('2026-10-30', 4)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
})
