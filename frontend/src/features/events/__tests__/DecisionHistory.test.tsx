import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { DecisionHistory } from '../components/DecisionHistory'
import type { ReviewDecision } from '../types'

const returned: ReviewDecision = {
  id: 'decision-1',
  fromStatus: 'under_review',
  decision: 'returned',
  reason: 'Please add a programme.',
  decidedByName: 'Casey Coordinator',
  decidedAt: '2026-09-20T09:00:00Z',
}

const approved: ReviewDecision = {
  id: 'decision-2',
  fromStatus: 'under_review',
  decision: 'approved',
  reason: null,
  decidedByName: 'Robin Reviewer',
  decidedAt: '2026-09-21T09:00:00Z',
}

describe('AC-004.5 — decision history', () => {
  test('AC-004.5.4: shows each decision with its outcome, reason, reviewer and time', () => {
    render(<DecisionHistory decisions={[approved, returned]} />)

    const items = within(screen.getByRole('list', { name: 'Decision history' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    // Order is the service's (newest first); the component must not reorder it.
    expect(items[0]).toHaveTextContent('Approved')
    expect(items[0]).toHaveTextContent('by Robin Reviewer')
    expect(items[1]).toHaveTextContent('Returned for more detail')
    expect(items[1]).toHaveTextContent('Please add a programme.')
    expect(items[1]).toHaveTextContent('by Casey Coordinator')
    expect(items[1].querySelector('time')).toHaveAttribute('dateTime', '2026-09-20T09:00:00Z')
  })

  test('AC-004.5.5: an approval without a reason says so explicitly rather than showing a blank', () => {
    render(<DecisionHistory decisions={[approved]} />)

    expect(screen.getByText('No reason was given.')).toBeInTheDocument()
  })

  test('AC-004.5.6: a request with no decisions yet shows an empty-state message', () => {
    render(<DecisionHistory decisions={[]} />)

    expect(screen.getByText(/No decisions have been recorded/)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
