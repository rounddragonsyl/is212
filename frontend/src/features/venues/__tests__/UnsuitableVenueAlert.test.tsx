import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { UnsuitableVenueAlert } from '../components/UnsuitableVenueAlert'
import type { VenueAssessment } from '../suitabilityTypes'

function assessment(overrides: Partial<VenueAssessment>): VenueAssessment {
  return {
    venue: { id: 'v1', name: 'Small Room', location: 'Level 1', status: 'active', layouts: [], accessibility: [], facility: {} },
    verdict: 'unsuitable',
    reasons: [
      { code: 'capacity', message: 'Holds at most 20 in any layout; 60 attendees are expected.' },
      { code: 'facility', message: 'Missing facilities: Projector.' },
    ],
    fittingLayouts: [],
    ...overrides,
  }
}

describe('AC-018.2 — coordinators are alerted when booking an unsuitable venue', () => {
  test('AC-018.2.3: booking an unsuitable venue raises an alert naming it and every reason', () => {
    render(<UnsuitableVenueAlert assessment={assessment({})} onProceed={vi.fn()} onCancel={vi.fn()} />)
    const alert = screen.getByRole('alertdialog', { name: 'Small Room is not suitable for this event' })
    expect(within(alert).getByText('Holds at most 20 in any layout; 60 attendees are expected.')).toBeInTheDocument()
    expect(within(alert).getByText('Missing facilities: Projector.')).toBeInTheDocument()
  })

  test('AC-018.2.4: the coordinator can choose another venue or book anyway', () => {
    const onProceed = vi.fn()
    const onCancel = vi.fn()
    render(<UnsuitableVenueAlert assessment={assessment({})} onProceed={onProceed} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose another venue' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Book anyway' }))
    expect(onProceed).toHaveBeenCalledTimes(1)
  })

  test('AC-018.2.5: an unavailable venue cannot be booked anyway; only choosing another is offered', () => {
    render(<UnsuitableVenueAlert
      assessment={assessment({
        verdict: 'unavailable',
        reasons: [{ code: 'blocked', message: 'Blocked by Venue Staff on 10 Mar 2041 (AM).' }],
      })}
      onProceed={vi.fn()}
      onCancel={vi.fn()}
    />)
    expect(screen.getByRole('alertdialog', { name: 'Small Room is not available for this event' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose another venue' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Book anyway' })).not.toBeInTheDocument()
  })

  test('AC-018.2.6: a suitable venue raises no alert', () => {
    render(<UnsuitableVenueAlert assessment={assessment({ verdict: 'suitable', reasons: [] })} onProceed={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})