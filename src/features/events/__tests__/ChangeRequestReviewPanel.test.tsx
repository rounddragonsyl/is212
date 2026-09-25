import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ChangeRequestReviewPanel } from '../components/ChangeRequestReviewPanel'
import { changeRequest, eventId, reviewContext } from './fixtures/changeRequestReview'

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('../changeRequestReviewQueryService', () => ({
  getChangeRequestReviewContext: mocks.load, CHANGE_REVIEW_LOAD_MESSAGES: { failed: 'Unable to load review.' },
}))
vi.mock('../changeRequestReviewService', () => ({
  saveChangeRequestReview: mocks.save, CHANGE_REVIEW_SERVICE_MESSAGES: { failed: 'Reload review.' },
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue({ ok: true, context: reviewContext })
})
function setup() {
  const onReviewed = vi.fn()
  return { ...render(<ChangeRequestReviewPanel eventId={eventId} onReviewed={onReviewed} />), onReviewed, user: userEvent.setup() }
}

test('AC-007.2.29: permission denial shows no comparison or review controls', async () => {
  mocks.load.mockResolvedValue({ ok: false, reason: 'Only the assigned coordinator can review.' })
  setup()
  expect(await screen.findByRole('alert')).toHaveTextContent('Only the assigned coordinator')
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
  expect(screen.queryByText('New title')).not.toBeInTheDocument()
})
test('AC-007.3.6: failed loading offers a manual reload rather than claiming there are no requests', async () => {
  mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Unable to load review.' })
  const { user } = setup()
  await screen.findByRole('alert')
  expect(screen.queryByText('No changes have been requested for this event.')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reload review' }))
  expect(await screen.findByRole('form')).toBeInTheDocument()
})
test('AC-007.3.7: focus and parent rerenders preserve the comparison and unsaved choices', async () => {
  const { user, rerender, onReviewed } = setup()
  await screen.findByRole('form')
  await user.selectOptions(screen.getByLabelText('Decision for Event name'), 'approved')
  fireEvent.focus(window)
  rerender(<ChangeRequestReviewPanel eventId={eventId} onReviewed={onReviewed} />)
  expect(mocks.load).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Decision for Event name')).toHaveValue('approved')
  expect(screen.getByText('Original title')).toBeInTheDocument()
})
test('AC-007.4.1: the organiser reason is visible alongside the review', async () => {
  setup()
  expect(await screen.findByText(/We expect more guests/)).toBeInTheDocument()
})
test.each([
  ['AC-007.5.33', 'approved', 'Approved'],
  ['AC-007.5.34', 'rejected', 'Rejected'],
  ['AC-007.5.35', 'partially_approved', 'Partially approved'],
  ['AC-007.5.36', 'withdrawn', 'Withdrawn'],
])('%s: a %s request is read-only', async (_id, status, label) => {
  mocks.load.mockResolvedValue({ ok: true, context: { ...reviewContext, requests: [{ ...changeRequest, status }] } })
  setup()
  expect(await screen.findByText(label)).toBeInTheDocument()
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
test('AC-007.5.37: a cancelled event has no review form even when its request is pending', async () => {
  mocks.load.mockResolvedValue({ ok: true, context: { ...reviewContext, eventStatus: 'cancelled' } })
  setup()
  expect(await screen.findByText('This event is not open for change-request review.')).toBeInTheDocument()
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
test('AC-007.7.33: outstanding clarification remains read-only and does not offer finalisation', async () => {
  mocks.load.mockResolvedValue({ ok: true, context: { ...reviewContext, requests: [{
    ...changeRequest, status: 'clarification_requested',
    fieldDecisions: [{ field: 'name', decision: 'clarification_requested', note: 'Which title?' }],
  }] } })
  setup()
  expect(await screen.findByText('Which title?')).toBeInTheDocument()
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
test('AC-007.9.16: successful finalisation reloads the outcome and refreshes the parent event', async () => {
  mocks.save.mockResolvedValue({ ok: true, status: 'approved' })
  const { user, onReviewed } = setup()
  await screen.findByRole('form')
  await user.selectOptions(screen.getByLabelText('Decision for Event name'), 'approved')
  await user.selectOptions(screen.getByLabelText('Decision for Expected attendance'), 'approved')
  mocks.load.mockResolvedValue({ ok: true, context: { ...reviewContext,
    currentValues: { ...reviewContext.currentValues, name: 'New title' },
    requests: [{ ...changeRequest, status: 'approved' }],
  } })
  await user.click(screen.getByRole('button', { name: 'Finalise review' }))
  expect(await screen.findByText('Review saved: Approved.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument())
  expect(mocks.load).toHaveBeenCalledTimes(2)
  expect(onReviewed).toHaveBeenCalledTimes(1)
})
