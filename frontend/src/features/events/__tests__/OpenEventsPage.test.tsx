import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { OpenEventsPage } from '../pages/OpenEventsPage'
import { SessionContext } from '../../auth/sessionContext'
import type { CurrentUser } from '../../auth/sessionContext'
import type { UserProfile } from '../../auth/types'

const attendee: UserProfile = { id: 'user-1', fullName: 'Ada Tan', role: 'attendee' }

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
          <Route path="/signin" element={<SignInProbe />} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

describe('AC-029.4: after signing up, the Attendee is signed in and sees open events', () => {
  test('AC-029.4.6: a signed-in Attendee sees the events-open-for-registration page', () => {
    renderOpenEvents({ session: { userId: 'user-1', email: 'ada@example.test' }, profile: attendee })

    expect(screen.getByRole('heading', { name: 'Events open for registration' })).toBeInTheDocument()
    expect(screen.getByText(/will appear here/i)).toBeInTheDocument()
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
