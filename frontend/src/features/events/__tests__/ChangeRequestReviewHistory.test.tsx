import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { ChangeRequestReviewHistory } from '../components/ChangeRequestReviewHistory'
import type { ChangeRequestReviewHistoryEntry } from '../types'

afterEach(cleanup)
const entry: ChangeRequestReviewHistoryEntry = {
  id: 'history-1', requestVersion: 1, outcome: 'clarification_requested',
  proposedChanges: { name: 'Proposed title' },
  fieldDecisions: [{ field: 'name', decision: 'clarification_requested', note: 'Which title?' }],
  reviewerName: 'Coordinator Jane', reviewedAt: '2026-09-27T01:00:00Z', reviewNote: null,
}
test('AC-007.13.27: history shows saved reviewer time proposal and field question', () => {
  render(<ChangeRequestReviewHistory entries={[entry]} />)
  expect(screen.getByText(/Coordinator Jane/)).toHaveTextContent(/27 Sept? 2026, 09:00/)
  expect(screen.getByText(/Proposed title/)).toBeInTheDocument()
  expect(screen.getByText(/Which title/)).toBeInTheDocument()
  expect(screen.getByText(/provisional/)).toBeInTheDocument()
})
test('AC-007.13.28: final and earlier clarification decisions remain visible together', () => {
  render(<ChangeRequestReviewHistory entries={[
    { ...entry, id: 'history-2', requestVersion: 3, outcome: 'approved', fieldDecisions: [{ field: 'name', decision: 'approved', note: '' }] }, entry,
  ]} />)
  expect(screen.getByText('Review decision history (2)')).toBeInTheDocument()
  expect(screen.getAllByText('Approved')).toHaveLength(2)
  expect(screen.getByText(/Which title/)).toBeInTheDocument()
})
test('AC-007.13.29: empty history explains the tracking boundary', () => {
  render(<ChangeRequestReviewHistory entries={[]} />)
  expect(screen.getByText(/since history tracking was enabled/)).toBeInTheDocument()
})
test('AC-007.13.30: legacy whole-request clarification note is retained', () => {
  render(<ChangeRequestReviewHistory entries={[{ ...entry, fieldDecisions: [], reviewNote: 'Please explain the schedule' }]} />)
  expect(screen.getByText('Please explain the schedule')).toBeInTheDocument()
})
