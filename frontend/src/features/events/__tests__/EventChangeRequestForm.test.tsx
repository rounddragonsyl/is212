import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { EventChangeRequestForm } from '../components/EventChangeRequestForm'
import { eventId } from './fixtures/changeRequestReview'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../eventChangeRequestService', () => ({
  requestEventChange: mocks.request,
  CHANGE_REQUEST_MESSAGES: {
    reasonRequired: 'Please explain why you are requesting this change.',
    noChangesProposed: 'Please propose at least one change.',
    unexpected: 'Something went wrong submitting your change request. Please try again.',
  },
}))

beforeEach(() => { vi.resetAllMocks() })

function setup() {
  render(<EventChangeRequestForm eventId={eventId} />)
  return userEvent.setup()
}

test('AC-006.3.1: submitting with no fields filled in and no reason is blocked', async () => {
  const user = setup()
  await user.click(screen.getByRole('button', { name: 'Submit change request' }))
  expect(screen.getByText('Please explain why you are requesting this change.')).toBeInTheDocument()
  expect(mocks.request).not.toHaveBeenCalled()
})

test('AC-006.3.2: a reason with no proposed field changes is refused before calling the service', async () => {
  const user = setup()
  await user.type(screen.getByLabelText(/Reason for this change/), 'Testing only.')
  await user.click(screen.getByRole('button', { name: 'Submit change request' }))
  expect(await screen.findByText('Please propose at least one change.')).toBeInTheDocument()
  expect(mocks.request).not.toHaveBeenCalled()
})

test('AC-006.3.3: only the fields the organiser actually filled in are sent, alongside the reason', async () => {
  mocks.request.mockResolvedValue({ ok: true, requestId: 'change-1' })
  const user = setup()
  await user.type(screen.getByLabelText('Event name'), 'New name')
  await user.type(screen.getByLabelText(/Reason for this change/), 'Sponsor renamed the event.')
  await user.click(screen.getByRole('button', { name: 'Submit change request' }))
  expect(mocks.request).toHaveBeenCalledWith(eventId, { name: 'New name' }, 'Sponsor renamed the event.')
})

test('AC-006.3.4: a successful submission confirms and clears the form for another request', async () => {
  mocks.request.mockResolvedValue({ ok: true, requestId: 'change-1' })
  const user = setup()
  await user.type(screen.getByLabelText('Event name'), 'New name')
  await user.type(screen.getByLabelText(/Reason for this change/), 'Sponsor renamed the event.')
  await user.click(screen.getByRole('button', { name: 'Submit change request' }))
  expect(await screen.findByText('Your change request has been submitted for review.')).toBeInTheDocument()
  expect(screen.getByLabelText('Event name')).toHaveValue('')
})

test('AC-006.3.5: a refused submission shows the service reason and keeps what was typed', async () => {
  mocks.request.mockResolvedValue({ ok: false, reason: 'A change request for this event is already pending review.' })
  const user = setup()
  await user.type(screen.getByLabelText('Event name'), 'New name')
  await user.type(screen.getByLabelText(/Reason for this change/), 'Sponsor renamed the event.')
  await user.click(screen.getByRole('button', { name: 'Submit change request' }))
  expect(await screen.findByText('A change request for this event is already pending review.')).toBeInTheDocument()
  expect(screen.getByLabelText('Event name')).toHaveValue('New name')
})

test('AC-006.3.6: a proposed field with no reason is blocked by the reason requirement, not treated as valid', async () => {
  const user = setup()
  await user.type(screen.getByLabelText('Event name'), 'New name')
  await user.click(screen.getByRole('button', { name: 'Submit change request' }))
  expect(screen.getByText('Please explain why you are requesting this change.')).toBeInTheDocument()
  expect(mocks.request).not.toHaveBeenCalled()
})