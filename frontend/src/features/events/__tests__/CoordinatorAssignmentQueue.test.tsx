import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { ReviewRequestsPage } from '../pages/ReviewRequestsPage'

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('../eventReviewService', () => ({ listEventRequests: mocks.list }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({
    loading: false,
    profile: { id: 'lead', fullName: 'Coordinator Lead', role: 'coordinator_lead' },
  }),
}))

test('AC-017.1.10: Lead queue shows basic details of submitted unassigned requests only', async () => {
  const request = {
    id: '17100000-0000-0000-0000-000000000010', reference: 'EVT-017-010',
    organiserId: 'organiser', coordinatorId: null,
    name: 'Community workshop', purpose: 'Teach first aid', eventType: 'Workshop',
    proposedStart: '2030-01-03T01:00:00Z', proposedEnd: '2030-01-03T03:00:00Z',
    expectedAttendance: 40, status: 'submitted', submittedAt: '2029-12-01T01:00:00Z',
    reviewNote: null,
  }
  mocks.list.mockResolvedValue({ ok: true, requests: [
    request,
    { ...request, id: 'assigned', name: 'Already assigned', coordinatorId: 'coordinator' },
    { ...request, id: 'draft', name: 'Private draft', status: 'draft' },
    { ...request, id: 'completed', name: 'Completed workshop', status: 'completed' },
    { ...request, id: 'cancelled', name: 'Cancelled workshop', status: 'cancelled' },
    { ...request, id: 'rejected', name: 'Rejected workshop', status: 'rejected' },
  ] })

  render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)

  // Wait for data, so a missing queue is a UI failure rather than a loading race.
  await screen.findByText('Community workshop')
  const queue = screen.getByRole('region', { name: /unassigned requests/i })
  expect(within(queue).getByText('EVT-017-010')).toBeInTheDocument()
  expect(within(queue).getByText('Teach first aid')).toBeInTheDocument()
  expect(within(queue).getByText('40')).toBeInTheDocument()
  expect(within(queue).getByText(/3 Jan 2030, 09:00/)).toBeInTheDocument()
  expect(within(queue).getAllByRole('listitem')).toHaveLength(1)
  for (const name of ['Already assigned', 'Private draft', 'Completed workshop', 'Cancelled workshop', 'Rejected workshop']) {
    expect(within(queue).queryByText(name)).not.toBeInTheDocument()
  }
})
