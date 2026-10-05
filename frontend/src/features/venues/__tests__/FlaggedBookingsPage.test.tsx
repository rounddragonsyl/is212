import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { FlaggedBookingsPage } from '../pages/FlaggedBookingsPage'

const mocks = vi.hoisted(() => ({ role: 'coordinator', list: vi.fn() }))

vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'coordinator-1', role: mocks.role } }),
}))
vi.mock('../venueAlertService', () => ({ listMyFlaggedBookings: mocks.list }))

const FLAG = {
  id: 'flag-1',
  bookingId: 'booking-7',
  eventId: 'event-7',
  eventReference: 'EVT-7',
  eventName: 'Gala',
  venueName: 'Second Hall',
  detail: 'Venue blocked: Ceiling repair',
  cells: [
    { date: '2040-03-10', slot: 'AM', kind: 'event' },
    { date: '2040-03-10', slot: 'PM', kind: 'buffer' },
  ],
  createdAt: '2040-01-05T02:00:00+00:00',
}

function renderPage() {
  render(
    <MemoryRouter>
      <FlaggedBookingsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'coordinator'
  mocks.list.mockResolvedValue({ ok: true, value: [FLAG] })
})

describe('AC-012.8 — coordinators see the bookings that need review', () => {
  test('AC-012.8.19: only Event Coordinators can see venue alerts', () => {
    mocks.role = 'venue_staff'
    renderPage()

    expect(screen.getByText('Venue alerts are available to Event Coordinators.')).toBeInTheDocument()
    expect(mocks.list).not.toHaveBeenCalled()
  })

  test('AC-012.8.20: each flagged booking shows its event, venue, affected slots and reason, with a link to the request', async () => {
    renderPage()

    expect(await screen.findByText('EVT-7')).toBeInTheDocument()
    expect(screen.getByText('Second Hall')).toBeInTheDocument()
    expect(screen.getByText('Venue blocked: Ceiling repair')).toBeInTheDocument()
    expect(screen.getByText(/10 Mar 2040 AM \(event\), 10 Mar 2040 PM \(setup or turnaround\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open request' })).toHaveAttribute('href', '/requests/event-7')
  })

  test('AC-012.8.21: a coordinator with no flagged bookings is told there is nothing to review', async () => {
    mocks.list.mockResolvedValue({ ok: true, value: [] })
    renderPage()

    expect(await screen.findByText(/None of your bookings overlap a venue block/)).toBeInTheDocument()
  })

  test('AC-012.8.22: if the alerts cannot be loaded, the coordinator is told, not shown an empty list', async () => {
    mocks.list.mockResolvedValue({ ok: false, reason: 'Your venue alerts could not be loaded. Please try again.' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.queryByText(/None of your bookings overlap a venue block/)).toBeNull()
  })
})
