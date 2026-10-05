import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { UserProfile } from '../../../features/auth/types'
import { TopNav } from '../TopNav'

const flags = vi.hoisted(() => ({ venueBlocks: true, venueSuitability: false }))
vi.mock('../../../lib/features', () => ({ FEATURES: flags }))
vi.mock('../../../features/auth/components/SessionBadge', () => ({ SessionBadge: () => null }))

function renderNavFor(role: string) {
  const profile = { id: 'user-1', role } as unknown as UserProfile
  render(
    <MemoryRouter>
      <TopNav session={null} profile={profile} loading={false} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  flags.venueBlocks = true
})

describe('AC-012.1 — only Venue Staff can block', () => {
  test('AC-012.1.10: Venue Staff are offered the venue blocks page', () => {
    renderNavFor('venue_staff')
    expect(screen.getAllByRole('link', { name: 'Venue blocks' }).length).toBeGreaterThan(0)
  })

  test('AC-012.1.11: coordinators are not offered it', () => {
    renderNavFor('coordinator')
    expect(screen.queryAllByRole('link', { name: 'Venue blocks' })).toHaveLength(0)
  })

  test('AC-012.1.12: while the feature flag is off, Venue Staff are not offered it', () => {
    flags.venueBlocks = false
    renderNavFor('venue_staff')
    expect(screen.queryAllByRole('link', { name: 'Venue blocks' })).toHaveLength(0)
  })
})
