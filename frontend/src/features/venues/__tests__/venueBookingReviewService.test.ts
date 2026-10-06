import { beforeEach, expect, test, vi } from 'vitest'
import { rejectVenueBooking } from '../venueBookingReviewService'
import { BOOKING_ID, createSupabaseFake } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from } }))
const fake = createSupabaseFake()
beforeEach(() => {
  vi.clearAllMocks()
  fake.reset()
  mocks.from.mockImplementation(fake.route)
})

test('AC-010.8.13: blank rejection reason is refused before a database call', async () => {
  expect(await rejectVenueBooking(BOOKING_ID, ' \n\t ')).toEqual({ ok: false, reason: 'Enter a rejection reason.' })
  expect(mocks.from).not.toHaveBeenCalled()
})

test('AC-010.8.14: rejection saves a trimmed reason using a pending-status guard', async () => {
  fake.plan('venue_bookings', { data: { id: BOOKING_ID }, error: null })
  expect(await rejectVenueBooking(BOOKING_ID, '  Venue unsuitable  ')).toEqual({ ok: true })
  expect(fake.callsTo('venue_bookings', 'update')).toEqual([[expect.objectContaining({ status: 'rejected', review_note: 'Venue unsuitable' })]])
  expect(fake.callsTo('venue_bookings', 'eq')).toEqual([['id', BOOKING_ID], ['status', 'pending_approval']])
  expect(fake.tablesTouched()).toEqual(['venue_bookings'])
})

test('AC-010.9.3: saves a trimmed optional alternative in the same decision update', async () => {
  fake.plan('venue_bookings', { data: { id: BOOKING_ID } })
  expect(await rejectVenueBooking(BOOKING_ID, 'Unavailable', ' Try Friday ')).toEqual({ ok: true })
  expect(fake.callsTo('venue_bookings', 'update')).toEqual([[{
    status: 'rejected', review_note: 'Unavailable', review_alternative: 'Try Friday',
  }]])
})

test('AC-010.9.7: an omitted alternative is stored as null', async () => {
  fake.plan('venue_bookings', { data: { id: BOOKING_ID } })
  await rejectVenueBooking(BOOKING_ID, 'Unavailable')
  expect(fake.callsTo('venue_bookings', 'update')[0][0]).toHaveProperty('review_alternative', null)
})
