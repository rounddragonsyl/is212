import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MyRegistrationsPage } from '../pages/MyRegistrationsPage'
import { SessionContext } from '../../auth/sessionContext'
import type { CurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../../events/formatters'
import type { MyRegistration } from '../types'

const mocks = vi.hoisted(() => ({ loadMyRegistrations: vi.fn() }))
vi.mock('../registrationService', () => ({ loadMyRegistrations: mocks.loadMyRegistrations }))

const attendee: CurrentUser = {
  session: { userId: 'user-1', email: 'ann@example.test' },
  profile: { id: 'user-1', fullName: 'Ann One', role: 'attendee' },
  loading: false,
  refresh: vi.fn(),
}

const registrations: MyRegistration[] = [
  {
    registrationId: 'r-1', eventId: 'e-1', eventName: 'Data Workshop',
    start: '2035-03-10T01:00:00Z', end: '2035-03-10T09:00:00Z', venue: 'Main Hall (Level 1)',
    eventStatus: 'confirmed', eventStatusLabel: 'Confirmed',
    registrationStatus: 'registered', registrationStatusLabel: 'Registered',
  },
  {
    registrationId: 'r-2', eventId: 'e-2', eventName: 'Spring Gala',
    start: '2035-04-01T10:00:00Z', end: null, venue: null,
    eventStatus: 'cancelled', eventStatusLabel: 'Cancelled',
    registrationStatus: 'registered', registrationStatusLabel: 'Registered',
  },
]

function renderPage() {
  render(
    <SessionContext.Provider value={attendee}>
      <MemoryRouter>
        <MyRegistrationsPage />
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.loadMyRegistrations.mockResolvedValue({ ok: true, value: registrations })
})

describe('AC-015.7: the Attendee sees their registrations', () => {
  test('AC-015.7.6: each registration shows its event name, date, venue, event status and registration status', async () => {
    renderPage()

    const workshop = (await screen.findByText('Data Workshop')).closest('li')
    const gala = screen.getByText('Spring Gala').closest('li')
    if (!workshop || !gala) throw new Error('each registration should be a list item')

    expect(within(workshop).getByText(new RegExp(formatDateTime(registrations[0].start)))).toBeInTheDocument()
    expect(within(workshop).getByText('Main Hall (Level 1)')).toBeInTheDocument()
    expect(within(workshop).getByText(/Confirmed/)).toBeInTheDocument()
    expect(within(workshop).getByText(/Registered/)).toBeInTheDocument()

    expect(within(gala).getByText(new RegExp(formatDateTime(registrations[1].start)))).toBeInTheDocument()
    expect(within(gala).getByText('Venue to be confirmed')).toBeInTheDocument()
    expect(within(gala).getByText(/Cancelled/)).toBeInTheDocument()
    expect(within(gala).getByText(/Registered/)).toBeInTheDocument()
  })

  test('AC-015.7.7: says so when there are no registrations yet (boundary)', async () => {
    mocks.loadMyRegistrations.mockResolvedValue({ ok: true, value: [] })
    renderPage()

    expect(await screen.findByText('You have not registered for any events yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /events open for registration/i })).toHaveAttribute('href', '/events/open')
  })

  test('AC-015.7.8: a load error is shown', async () => {
    mocks.loadMyRegistrations.mockResolvedValue({ ok: false, reason: 'Events could not be loaded. Please try again.' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Events could not be loaded. Please try again.')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  test('AC-015.7.10: after a load error, Try again loads the registrations', async () => {
    mocks.loadMyRegistrations
      .mockResolvedValueOnce({ ok: false, reason: 'Events could not be loaded. Please try again.' })
      .mockResolvedValue({ ok: true, value: registrations })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Data Workshop')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
