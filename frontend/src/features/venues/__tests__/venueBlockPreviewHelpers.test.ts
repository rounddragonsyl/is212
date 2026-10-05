import { describe, expect, test } from 'vitest'
import { groupAffectedBookings, sameBlock } from '../venueBlockValidation'
import type { VenueBlockInput } from '../venueBlockTypes'

const base: VenueBlockInput = {
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-12',
  slots: ['AM', 'NIGHT'],
  reason: 'Repairs',
}

describe('AC-012.7 — overlaps are previewed before saving', () => {
  test('AC-012.7.6: a preview still applies when only the reason or the slot order changes', () => {
    expect(sameBlock(base, { ...base, reason: 'Something else', slots: ['NIGHT', 'AM'] })).toBe(true)
  })

  test('AC-012.7.7: changing the venue, dates or slots makes the preview out of date', () => {
    expect(sameBlock(base, { ...base, venueId: 'v2' })).toBe(false)
    expect(sameBlock(base, { ...base, startsOn: '2040-03-09' })).toBe(false)
    expect(sameBlock(base, { ...base, endsOn: '2040-03-13' })).toBe(false)
    expect(sameBlock(base, { ...base, slots: ['AM'] })).toBe(false)
  })

  test('AC-012.7.8: preview rows are grouped by booking, keeping each booking\u2019s cells in order', () => {
    const rows = [
      { bookingId: 'b1', status: 'confirmed', eventReference: 'EVT-1', eventName: 'Gala',
        cell: { date: '2040-03-10', slot: 'AM' as const, kind: 'event' as const } },
      { bookingId: 'b2', status: 'held', eventReference: null, eventName: null,
        cell: { date: '2040-03-10', slot: 'NIGHT' as const, kind: 'event' as const } },
      { bookingId: 'b1', status: 'confirmed', eventReference: 'EVT-1', eventName: 'Gala',
        cell: { date: '2040-03-10', slot: 'PM' as const, kind: 'buffer' as const } },
    ]

    expect(groupAffectedBookings(rows)).toStrictEqual([
      {
        bookingId: 'b1', status: 'confirmed', eventReference: 'EVT-1', eventName: 'Gala',
        cells: [
          { date: '2040-03-10', slot: 'AM', kind: 'event' },
          { date: '2040-03-10', slot: 'PM', kind: 'buffer' },
        ],
      },
      {
        bookingId: 'b2', status: 'held', eventReference: null, eventName: null,
        cells: [{ date: '2040-03-10', slot: 'NIGHT', kind: 'event' }],
      },
    ])
  })
})
