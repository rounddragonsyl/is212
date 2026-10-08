import { beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SignedInHome } from '../SignedInHome'
import type { UserProfile, UserRole } from '../../features/auth/types'

// Home lists event requests for staff and organisers; stub it so no Supabase call is made.
const mocks = vi.hoisted(() => ({ listEventRequests: vi.fn() }))
vi.mock('../../features/events/eventReviewService', () => ({ listEventRequests: mocks.listEventRequests }))

function renderHomeFor(role: UserRole) {
  const profile: UserProfile = { id: `user-${role}`, fullName: 'Test User', role }
  render(
    <MemoryRouter>
      <SignedInHome profile={profile} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.listEventRequests.mockResolvedValue({ ok: true, requests: [] })
})

// Defect found 8 October 2026: US29 made Attendee accounts real, but Home still showed them a
// message written for staff ("Your coordinator will be in touch"). See US29_test_cases.md.
describe('AC-029.4: after signing up, the Attendee is signed in and sees open events', () => {
  test('AC-029.4.11: a signed-in Attendee\'s Home points them to events, not to a coordinator', () => {
    renderHomeFor('attendee')

    expect(screen.getByRole('link', { name: 'Browse events' })).toHaveAttribute('href', '/events/open')
    expect(screen.queryByText(/coordinator will be in touch/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/nothing for you to action/i)).not.toBeInTheDocument()
  })

  test('AC-029.4.12: other roles keep their Home (regression guard)', () => {
    renderHomeFor('organiser')
    expect(screen.getByRole('link', { name: /start a new request/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Browse events' })).not.toBeInTheDocument()
    cleanup()

    renderHomeFor('venue_staff')
    expect(screen.getByText(/nothing for you to action/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Browse events' })).not.toBeInTheDocument()
  })
})

describe('AC-015.7: the Attendee sees their registrations', () => {
  // Follow-up to the US29 Home defect: the registrations page exists once US15 is in.
  test('AC-015.7.11: an Attendee\'s Home also links to My registrations', () => {
    renderHomeFor('attendee')
    expect(screen.getByRole('link', { name: 'My registrations' })).toHaveAttribute('href', '/registrations')
  })
})
