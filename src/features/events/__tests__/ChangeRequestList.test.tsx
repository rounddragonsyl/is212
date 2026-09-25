import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ChangeRequestList } from '../components/ChangeRequestList'
import { changeRequest, eventId } from './fixtures/changeRequestReview'

const mocks = vi.hoisted(() => ({ load: vi.fn(), withdraw: vi.fn() }))
vi.mock('../eventChangeRequestService', () => ({ getMyChangeRequests: mocks.load, withdrawChangeRequest: mocks.withdraw }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue([changeRequest])
})
function setup() {
  render(<ChangeRequestList eventId={eventId} organiserId="owner" currentUserId="owner" />)
  return userEvent.setup()
}

test('AC-006.8.1: the existing owner withdrawal action still sends the selected request and reloads', async () => {
  mocks.withdraw.mockResolvedValue({ ok: true })
  const user = setup()
  await user.click(await screen.findByRole('button', { name: 'Withdraw request' }))
  expect(mocks.withdraw).toHaveBeenCalledWith(changeRequest.id)
  expect(mocks.load).toHaveBeenCalledTimes(2)
})
test('AC-006.8.2: a refused withdrawal displays its reason instead of silently failing', async () => {
  mocks.withdraw.mockResolvedValue({ ok: false, reason: 'This request has already been reviewed.' })
  const user = setup()
  await user.click(await screen.findByRole('button', { name: 'Withdraw request' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('already been reviewed')
})
test('AC-007.6.7: the organiser sees the reason attached to a rejected field', async () => {
  mocks.load.mockResolvedValue([{ ...changeRequest, status: 'partially_approved', fieldDecisions: [
    { field: 'expectedAttendance', decision: 'rejected', note: 'The room capacity is 50.' },
  ] }])
  setup()
  expect(await screen.findByText('The room capacity is 50.')).toBeInTheDocument()
  expect(screen.getByText('Partially approved')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument()
})
test('AC-007.7.34: the organiser sees separate questions and provisional decisions without review controls', async () => {
  mocks.load.mockResolvedValue([{ ...changeRequest, status: 'clarification_requested', fieldDecisions: [
    { field: 'name', decision: 'approved', note: null },
    { field: 'expectedAttendance', decision: 'clarification_requested', note: 'Does this include staff?' },
  ] }])
  setup()
  expect(await screen.findByText('Does this include staff?')).toBeInTheDocument()
  expect(screen.getByText('Approved provisionally')).toBeInTheDocument()
  expect(screen.getByText(/No proposed changes have been applied/)).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
})
test('AC-007.7.35: failed loading cannot hide questions behind an empty-list message and can be retried', async () => {
  mocks.load.mockRejectedValueOnce(new Error('Offline'))
  const user = setup()
  await screen.findByRole('alert')
  expect(screen.queryByText('No changes have been requested for this event.')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Retry loading change requests' }))
  expect(await screen.findByText('In review')).toBeInTheDocument()
})
