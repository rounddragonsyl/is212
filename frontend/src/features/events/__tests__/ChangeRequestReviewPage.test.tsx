import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { ReviewRequestDetailPage } from '../pages/ReviewRequestDetailPage'
import { eventId } from './fixtures/changeRequestReview'

const mocks = vi.hoisted(() => ({ role: 'organiser', reviewPanel: vi.fn(), list: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }),
}))
vi.mock('../eventReviewService', () => ({
  getEventRequest: async () => ({ ok: true, request: { id: eventId, organiserId: 'viewer', status: 'approved', name: 'An event' } }),
  listReviewDecisions: async () => ({ ok: true, decisions: [] }),
}))
vi.mock('../eventChangeRequestService', () => ({ LOCKED_STATUSES: ['cancelled', 'rejected', 'confirmed'] }))
vi.mock('../components/ChangeRequestReviewPanel', () => ({
  ChangeRequestReviewPanel: (props: unknown) => { mocks.reviewPanel(props); return <p>Coordinator change review</p> },
}))
vi.mock('../components/ChangeRequestList', () => ({
  ChangeRequestList: (props: unknown) => { mocks.list(props); return <p>Read-only changes</p> },
}))
vi.mock('../components/RequestDetails', () => ({ RequestDetails: () => null }))
vi.mock('../components/ReviewActions', () => ({ ReviewActions: () => null }))
vi.mock('../components/DecisionHistory', () => ({ DecisionHistory: () => null }))
vi.mock('../status/RequestStatusPanel', () => ({ RequestStatusPanel: () => null }))
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'organiser' })
function setup() {
  render(<MemoryRouter initialEntries={[`/requests/${eventId}`]}>
    <Routes><Route path="/requests/:id" element={<ReviewRequestDetailPage />} /></Routes>
  </MemoryRouter>)
}
test('AC-007.2.30: the organiser detail page mounts the read-only list without coordinator controls', async () => {
  setup()
  expect(await screen.findByText('Read-only changes')).toBeInTheDocument()
  expect(mocks.reviewPanel).not.toHaveBeenCalled()
})
test('AC-007.2.31: the coordinator detail page connects the event ID and refresh callback to the review panel', async () => {
  mocks.role = 'coordinator'
  setup()
  expect(await screen.findByText('Coordinator change review')).toBeInTheDocument()
  expect(mocks.reviewPanel).toHaveBeenCalledWith({ eventId, onReviewed: expect.any(Function) })
  expect(mocks.list).not.toHaveBeenCalled()
})
