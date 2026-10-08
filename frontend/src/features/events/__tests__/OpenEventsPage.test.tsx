import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { OpenEventsPage } from '../pages/OpenEventsPage'
import { SessionContext } from '../../auth/sessionContext'
import type { CurrentUser } from '../../auth/sessionContext'
import type { UserProfile } from '../../auth/types'
import { formatDateTime } from '../formatters'
import type { OpenEvent } from '../../registrations/types'

// US15 turned this US29 placeholder into the real list, so the service is stubbed here too.
const mocks = vi.hoisted(() => ({ loadOpenEvents: vi.fn() }))
vi.mock('../../registrations/registrationService', () => ({ loadOpenEvents: mocks.loadOpenEvents }))

const attendee: UserProfile = { id: 'user-1', fullName: 'Ada Tan', role: 'attendee' }
const signedIn = { session: { userId: 'user-1', email: 'ada@example.test' }, profile: attendee }

const openEvents: OpenEvent[] = [
  {
    id: 'event-2', name: 'Early Talk', eventType: 'Talk',
    start: '2035-02-01T02:00:00Z', end: '2035-02-01T04:00:00Z', venue: null, registered: false,
  },
  {
    id: 'event-1', name: 'Data Workshop', eventType: 'Workshop',
    start: '2035-03-10T01:00:00Z', end: '2035-03-10T09:00:00Z', venue: 'Main Hall (Level 1)',
    registered: true,
  },
]

/** Shows where the sign-in page was asked to send the user back to. */
function SignInProbe() {
  const state = useLocation().state as { from?: string } | null
  return <p>Sign-in page, back to {state?.from ?? 'nowhere'}</p>
}

function renderOpenEvents(value: Partial<CurrentUser>) {
  const user: CurrentUser = { session: null, profile: null, loading: false, refresh: vi.fn(), ...value }
  render(
    <SessionContext.Provider value={user}>
      <MemoryRouter initialEntries={['/events/open']}>
        <Routes>
          <Route path="/events/open" element={<OpenEventsPage />} />
          <Route path="/events/open/:id" element={<p>Details page</p>} />
          <Route path="/signin" element={<SignInProbe />} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.loadOpenEvents.mockResolvedValue({ ok: true, value: openEvents })
})

describe('AC-029.4: after signing up, the Attendee is signed in and sees open events', () => {
  // Changed for US15 (approved 7 October): the placeholder text became the list's empty state.
  test('AC-029.4.6: a signed-in Attendee sees the events-open-for-registration page', async () => {
    mocks.loadOpenEvents.mockResolvedValue({ ok: true, value: [] })
    renderOpenEvents(signedIn)

    expect(screen.getByRole('heading', { name: 'Events open for registration' })).toBeInTheDocument()
    expect(await screen.findByText('No events are open for registration right now.')).toBeInTheDocument()
  })

  test('AC-029.4.7: a visitor who is not signed in is sent to sign in, then back here (boundary)', () => {
    renderOpenEvents({})
    expect(screen.getByText('Sign-in page, back to /events/open')).toBeInTheDocument()
  })

  test('AC-029.4.8: while the session is loading, nothing redirects (boundary)', () => {
    renderOpenEvents({ loading: true })

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    expect(screen.queryByText(/sign-in page/i)).not.toBeInTheDocument()
  })
})

describe('AC-015.6: the Attendee sees events open for registration', () => {
  test('AC-015.6.8: lists each open event with its date and venue, linking to its details', async () => {
    renderOpenEvents(signedIn)

    const talk = (await screen.findByRole('link', { name: /Early Talk/ })).closest('li')
    const workshop = screen.getByRole('link', { name: /Data Workshop/ }).closest('li')
    if (!talk || !workshop) throw new Error('each event should be a list item')

    expect(within(talk).getByRole('link', { name: /Early Talk/ })).toHaveAttribute('href', '/events/open/event-2')
    expect(within(talk).getByText(new RegExp(formatDateTime(openEvents[0].start)))).toBeInTheDocument()
    expect(within(talk).getByText('Venue to be confirmed')).toBeInTheDocument()
    expect(within(talk).queryByText('Registered')).not.toBeInTheDocument()

    expect(within(workshop).getByText('Main Hall (Level 1)')).toBeInTheDocument()
    expect(within(workshop).getByText('Registered')).toBeInTheDocument()
  })

  test('AC-015.6.9: says so when nothing is open (boundary)', async () => {
    mocks.loadOpenEvents.mockResolvedValue({ ok: true, value: [] })
    renderOpenEvents(signedIn)

    expect(await screen.findByText('No events are open for registration right now.')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  test('AC-015.6.10: a load error is shown', async () => {
    mocks.loadOpenEvents.mockResolvedValue({ ok: false, reason: 'Events could not be loaded. Please try again.' })
    renderOpenEvents(signedIn)

    expect(await screen.findByRole('alert')).toHaveTextContent('Events could not be loaded. Please try again.')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  test('AC-015.6.11: opening an event goes to its details page', async () => {
    renderOpenEvents(signedIn)

    fireEvent.click(await screen.findByRole('link', { name: /Data Workshop/ }))

    expect(await screen.findByText('Details page')).toBeInTheDocument()
  })

  test('AC-015.6.12: after a load error, Try again loads the list', async () => {
    mocks.loadOpenEvents
      .mockResolvedValueOnce({ ok: false, reason: 'Events could not be loaded. Please try again.' })
      .mockResolvedValue({ ok: true, value: openEvents })
    renderOpenEvents(signedIn)

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('link', { name: /Data Workshop/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
