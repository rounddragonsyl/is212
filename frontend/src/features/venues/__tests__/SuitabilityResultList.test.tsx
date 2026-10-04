import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SuitabilityResultList } from '../components/SuitabilityResultList'
import type { VenueAssessment, VenueProfile } from '../suitabilityTypes'

const LABELS: Record<string, string> = { theatre: 'Theatre', boardroom: 'Boardroom' }
const layoutLabel = (code: string) => LABELS[code] ?? code

function venue(id: string, name: string): VenueProfile {
  return { id, name, location: 'Level 1', status: 'active', layouts: [], accessibility: [], facility: {} }
}

function assessment(overrides: Partial<VenueAssessment> & { venue: VenueProfile }): VenueAssessment {
  return { verdict: 'suitable', reasons: [], fittingLayouts: [], ...overrides }
}

describe('AC-018.1 — coordinators can identify suitable venues', () => {
  test('AC-018.1.23: suitable venues are grouped together, with the layouts that would fit', () => {
    render(<SuitabilityResultList layoutLabel={layoutLabel} assessments={[
      assessment({
        venue: venue('v1', 'Main Hall'),
        fittingLayouts: [{ layout: 'boardroom', capacity: 70 }, { layout: 'theatre', capacity: 100 }],
      }),
    ]} />)
    const suitable = screen.getByRole('region', { name: /Suitable/ })
    expect(within(suitable).getByText('Main Hall')).toBeInTheDocument()
    expect(within(suitable).getByText('Fits in: Boardroom (70), Theatre (100)')).toBeInTheDocument()
  })

  test('AC-018.1.24: with no venues to assess, the list says so', () => {
    render(<SuitabilityResultList layoutLabel={layoutLabel} assessments={[]} />)
    expect(screen.getByText('No venues to show.')).toBeInTheDocument()
  })
})

describe('AC-018.3 — venues that do not meet requirements are marked unsuitable', () => {
  test('AC-018.3.33: unsuitable venues are grouped separately, showing every reason', () => {
    render(<SuitabilityResultList layoutLabel={layoutLabel} assessments={[
      assessment({
        venue: venue('v2', 'Small Room'),
        verdict: 'unsuitable',
        reasons: [
          { code: 'capacity', message: 'Holds at most 20 in any layout; 60 attendees are expected.' },
          { code: 'facility', message: 'Missing facilities: Projector.' },
        ],
      }),
    ]} />)
    const unsuitable = screen.getByRole('region', { name: /Unsuitable/ })
    expect(within(unsuitable).getByText('Small Room')).toBeInTheDocument()
    expect(within(unsuitable).getByText('Holds at most 20 in any layout; 60 attendees are expected.')).toBeInTheDocument()
    expect(within(unsuitable).getByText('Missing facilities: Projector.')).toBeInTheDocument()
  })
})

describe('AC-018.4 — venues taken by bookings or maintenance are blacked out', () => {
  test('AC-018.4.12: unavailable venues are shown greyed out in their own group, with the reason', () => {
    render(<SuitabilityResultList layoutLabel={layoutLabel} assessments={[
      assessment({
        venue: venue('v3', 'Blocked Hall'),
        verdict: 'unavailable',
        reasons: [{ code: 'blocked', message: 'Blocked by Venue Staff on 10 Mar 2041 (AM).' }],
      }),
    ]} />)
    const unavailable = screen.getByRole('region', { name: /Unavailable/ })
    expect(within(unavailable).getByText('Blocked by Venue Staff on 10 Mar 2041 (AM).')).toBeInTheDocument()
    expect(within(unavailable).getByRole('listitem', { name: /Blocked Hall/ })).toHaveAttribute('aria-disabled', 'true')
  })
})