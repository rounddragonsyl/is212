import { beforeEach, describe, expect, test, vi } from 'vitest'
import { listMyFlaggedBookings, VENUE_ALERT_MESSAGES } from '../venueAlertService'
import { mockQuery } from './mockQuery'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: {}, rpc: mocks.rpc, from: mocks.from } }))

const flagRow = {
  id: 'flag-1',
  booking_id: 'booking-7',
  event_id: 'event-7',
  detail: 'Venue blocked: Ceiling repair',
  affected_cells: [{ date: '2040-03-10', slot: 'AM', kind: 'event' }],
  created_at: '2040-01-05T02:00:00+00:00',
  venues: { name: 'Second Hall' },
  events: { reference: 'EVT-7', name: 'Gala' },
}

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.from.mockReset()
})

describe('AC-012.8 — coordinators are told which bookings need review', () => {
  test('AC-012.8.17: a coordinator\u2019s open flags are listed newest first, with event, venue, slots and reason', async () => {
    const query = mockQuery({ data: [flagRow], error: null })
    mocks.from.mockReturnValue(query)

    expect(await listMyFlaggedBookings()).toStrictEqual({
      ok: true,
      value: [{
        id: 'flag-1',
        bookingId: 'booking-7',
        eventId: 'event-7',
        eventReference: 'EVT-7',
        eventName: 'Gala',
        venueName: 'Second Hall',
        detail: 'Venue blocked: Ceiling repair',
        cells: [{ date: '2040-03-10', slot: 'AM', kind: 'event' }],
        createdAt: '2040-01-05T02:00:00+00:00',
      }],
    })
    expect(mocks.from).toHaveBeenCalledWith('venue_booking_flags')
    expect(query.eq).toHaveBeenCalledWith('status', 'open')
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  test('AC-012.8.18: if the alerts cannot be loaded, the coordinator is told', async () => {
    mocks.from.mockReturnValue(mockQuery({ data: null, error: { message: 'timeout' } }))
    expect(await listMyFlaggedBookings()).toStrictEqual({ ok: false, reason: VENUE_ALERT_MESSAGES.loadFailed })
  })
})
