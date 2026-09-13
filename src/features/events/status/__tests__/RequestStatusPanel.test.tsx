import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { RequestStatusPanel } from '../RequestStatusPanel'
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from '../../types'
import type { EventRequestDetail } from '../../types'

const request: EventRequestDetail = {
  id: 'event-1', organiserId: 'owner-1', reference: null, name: null,
  purpose: null, eventType: null, proposedStart: null, proposedEnd: null,
  expectedAttendance: null, status: 'draft', submittedAt: null,
  description: null, programme: null, layoutPreference: null,
  accessibilityRequirements: null, equipmentRequirements: null,
  registrationRequired: false, specialArrangements: null,
  reviewNote: null, reviewedAt: null, createdAt: null,
}

describe('SCRUM-24 status display', () => {
  test.each(EVENT_STATUSES)('AC-24.3: clearly labels %s, including incomplete drafts', (status) => {
    render(<RequestStatusPanel request={{ ...request, status }} />)
    expect(screen.getByText(EVENT_STATUS_LABELS[status])).toBeInTheDocument()
  })
  test('AC-24.4: shows the rejection reason', () => {
    render(<RequestStatusPanel request={{ ...request, status: 'rejected', reviewNote: 'Venue unavailable' }} />)
    expect(screen.getByText('Reason for rejection')).toBeInTheDocument()
    expect(screen.getByText('Venue unavailable')).toBeInTheDocument()
  })
  test('AC-24.5: identifies an outstanding return and clears it after review progresses', () => {
    const { rerender } = render(<RequestStatusPanel request={{ ...request, status: 'submitted', reviewNote: 'Please amend the programme' }} />)
    expect(screen.getByText('Outstanding clarification or amendment request')).toBeInTheDocument()
    expect(screen.getByText('Please amend the programme')).toBeInTheDocument()
    rerender(<RequestStatusPanel request={{ ...request, status: 'approved' }} />)
    expect(screen.queryByText('Outstanding clarification or amendment request')).not.toBeInTheDocument()
  })
  test('AC-24.4: missing legacy rejection reason has an explicit fallback', () => {
    render(<RequestStatusPanel request={{ ...request, status: 'rejected' }} />)
    expect(screen.getByText(/No reason was recorded/)).toBeInTheDocument()
  })
})
