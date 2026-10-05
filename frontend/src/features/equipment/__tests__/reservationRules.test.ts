import { describe, expect, test } from 'vitest'
import { reservationWindow } from '../reservationRules'

// 00:30 SGT on 10 March is still 9 March in UTC, which is exactly the case to get right (#36).
const start = '2035-03-09T16:30:00Z'
const end = '2035-03-11T09:00:00Z'

describe('AC-014.3: the window runs from the collection day through the return day', () => {
  test('AC-014.3.7: collection is the first Singapore day minus one and return defaults to the last day', () => {
    expect(reservationWindow(start, end)).toEqual({
      firstDay: '2035-03-10', lastDay: '2035-03-11', collectionDay: '2035-03-09',
      blockedFrom: '2035-03-09', returnDate: '2035-03-11',
    })
  })
  test('AC-014.3.8: a unit held elsewhere starts one transfer day earlier', () => {
    expect(reservationWindow(start, end, { transfer: true })).toMatchObject({
      collectionDay: '2035-03-09', blockedFrom: '2035-03-08',
    })
  })
})
