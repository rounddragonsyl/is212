import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ChangeRequestReplyForm } from '../components/ChangeRequestReplyForm'
import { changeRequest } from './fixtures/changeRequestReview'
import type { EventChangeRequest } from '../types'

const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('../changeRequestReplyService', () => ({
  saveChangeRequestReply: mocks.save, CHANGE_REPLY_SERVICE_MESSAGES: { failed: 'Reload to check the reply.' },
}))
const request: EventChangeRequest = { ...changeRequest, reviewVersion: 3, status: 'clarification_requested', fieldDecisions: [
  { field: 'name', decision: 'approved', note: '' },
  { field: 'expectedAttendance', decision: 'clarification_requested', note: 'Includes staff?' },
] }
beforeEach(() => { vi.resetAllMocks(); mocks.save.mockResolvedValue({ ok: true, status: 'submitted' }) })
function setup(value = request) {
  const onSaved = vi.fn()
  return { ...render(<ChangeRequestReplyForm request={value} onSaved={onSaved} />), onSaved, user: userEvent.setup() }
}
test('AC-007.7.67: shows answer inputs only for outstanding questions', () => {
  setup()
  expect(screen.getByLabelText('Reply for Expected attendance')).toBeInTheDocument()
  expect(screen.queryByLabelText('Reply for Event name')).not.toBeInTheDocument()
})
test('AC-007.7.68: blank answers prevent saving and can be corrected', async () => {
  const { user, onSaved } = setup()
  await user.click(screen.getByRole('button', { name: 'Send replies for review' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter an answer')
  expect(mocks.save).not.toHaveBeenCalled()
  await user.type(screen.getByRole('textbox'), 'Yes, staff included.')
  await user.click(screen.getByRole('button', { name: 'Send replies for review' }))
  expect(mocks.save).toHaveBeenCalledWith(request, { replies: [{ field: 'expectedAttendance', message: 'Yes, staff included.' }] })
  expect(onSaved).toHaveBeenCalledTimes(1)
})
test('AC-007.7.69: every field question needs its own answer', async () => {
  const { user } = setup({ ...request, fieldDecisions: request.fieldDecisions.map((choice) => ({ ...choice, decision: 'clarification_requested', note: 'Please explain.' })) })
  await user.type(screen.getByLabelText('Reply for Event name'), 'New public title.')
  await user.click(screen.getByRole('button', { name: 'Send replies for review' }))
  expect(mocks.save).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toBeInTheDocument()
})
test('AC-007.7.70: an older whole-request clarification accepts a single note', async () => {
  const { user } = setup({ ...request, fieldDecisions: [], reviewNote: 'Why these changes?' })
  await user.type(screen.getByLabelText('Reply to coordinator'), 'More guests.')
  await user.click(screen.getByRole('button', { name: 'Send replies for review' }))
  expect(mocks.save.mock.calls[0][1]).toEqual({ note: 'More guests.' })
})
test('AC-007.7.71: repeated submission while saving or after success sends only one reply', async () => {
  let finish!: (value: { ok: true; status: 'submitted' }) => void
  mocks.save.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const { user, onSaved } = setup()
  await user.type(screen.getByRole('textbox'), 'Yes.')
  fireEvent.submit(screen.getByRole('form'))
  fireEvent.submit(screen.getByRole('form'))
  expect(mocks.save).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('textbox')).toBeDisabled()
  finish({ ok: true, status: 'submitted' })
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  fireEvent.submit(screen.getByRole('form'))
  expect(mocks.save).toHaveBeenCalledTimes(1)
})
test('AC-007.7.72: a refused save preserves answers and requires reload before retry', async () => {
  mocks.save.mockResolvedValue({ ok: false, reason: 'The request changed. Reload it.' })
  const { user, onSaved } = setup()
  await user.type(screen.getByRole('textbox'), 'Yes.')
  await user.click(screen.getByRole('button', { name: 'Send replies for review' }))
  expect(screen.getByRole('alert')).toHaveTextContent('request changed')
  expect(screen.getByRole('textbox')).toHaveValue('Yes.')
  expect(screen.getByRole('textbox')).toBeDisabled()
  expect(onSaved).not.toHaveBeenCalled()
})
test('AC-007.7.73: an unexpected connection failure retains the answer without retrying', async () => {
  mocks.save.mockRejectedValue(new Error('Offline'))
  const { user } = setup()
  await user.type(screen.getByRole('textbox'), 'Yes.')
  await user.click(screen.getByRole('button', { name: 'Send replies for review' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Reload to check')
  expect(screen.getByRole('textbox')).toHaveValue('Yes.')
  expect(mocks.save).toHaveBeenCalledTimes(1)
})
test('AC-007.7.74: a request no longer awaiting clarification has no reply form', () => {
  setup({ ...request, status: 'submitted' })
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
