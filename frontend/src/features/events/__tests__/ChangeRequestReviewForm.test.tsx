import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ChangeRequestReviewForm } from '../components/ChangeRequestReviewForm'
import { changeRequest, reviewContext } from './fixtures/changeRequestReview'
import type { EventChangeRequest } from '../types'

const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('../changeRequestReviewService', () => ({
  saveChangeRequestReview: mocks.save, CHANGE_REVIEW_SERVICE_MESSAGES: { failed: 'Reload before trying again.' },
}))
beforeEach(() => { vi.resetAllMocks(); mocks.save.mockResolvedValue({ ok: true, status: 'approved' }) })
function setup(request: EventChangeRequest = changeRequest) {
  const onSaved = vi.fn()
  render(<ChangeRequestReviewForm request={request} context={reviewContext} onSaved={onSaved} />)
  return { user: userEvent.setup(), onSaved }
}
async function decide(user: ReturnType<typeof userEvent.setup>, name: string, attendance: string) {
  await user.selectOptions(screen.getByLabelText('Decision for Event name'), name)
  await user.selectOptions(screen.getByLabelText('Decision for Expected attendance'), attendance)
}

describe('AC-007.3 — visible comparison', () => {
  test('AC-007.3.4: groups current and proposed values beneath their field names', () => {
    setup()
    const name = within(screen.getByRole('group', { name: 'Event name' }))
    expect(name.getByText('Original title')).toBeInTheDocument()
    expect(name.getByText('New title')).toBeInTheDocument()
    const attendance = within(screen.getByRole('group', { name: 'Expected attendance' }))
    expect(attendance.getByText('50')).toBeInTheDocument()
    expect(attendance.getByText('80')).toBeInTheDocument()
  })
  test('AC-007.3.5: formats Singapore dates, explicit false and blank proposed values', () => {
    setup({ ...changeRequest, proposedChanges: { proposedStart: '2030-01-01T09:30', registrationRequired: false, description: '' } })
    expect(screen.getByText('1 Jan 2030, 09:30 SGT')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.getAllByText('Not provided').length).toBeGreaterThan(0)
  })
})

describe('AC-007.5 — explicit finalisation', () => {
  test('AC-007.5.28: all approvals save once with the version displayed to the reviewer', async () => {
    const { user, onSaved } = setup()
    await decide(user, 'approved', 'approved')
    expect(mocks.save).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Finalise review' }))
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save).toHaveBeenCalledWith(changeRequest, reviewContext.eventUpdatedAt, {
      action: 'decide', decisions: [
        { field: 'name', decision: 'approved', note: '' },
        { field: 'expectedAttendance', decision: 'approved', note: '' },
      ],
    })
    expect(onSaved).toHaveBeenCalledWith('approved')
  })
  test('AC-007.5.29: mixed final decisions send the rejected field reason and report partial approval', async () => {
    mocks.save.mockResolvedValue({ ok: true, status: 'partially_approved' })
    const { user, onSaved } = setup()
    await decide(user, 'approved', 'rejected')
    await user.type(screen.getByLabelText(/Comment for Expected attendance/), 'Capacity is 50.')
    await user.click(screen.getByRole('button', { name: 'Finalise review' }))
    expect(mocks.save.mock.calls[0][2].decisions[1]).toEqual({ field: 'expectedAttendance', decision: 'rejected', note: 'Capacity is 50.' })
    expect(onSaved).toHaveBeenCalledWith('partially_approved')
  })
  test('AC-007.5.30: no field is pre-approved and incomplete decisions cannot be submitted', async () => {
    const { user } = setup()
    expect(screen.getByLabelText('Decision for Event name')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Finalise review' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose one decision for every proposed change')
    expect(mocks.save).not.toHaveBeenCalled()
  })
  test('AC-007.5.31: a failed save preserves decisions and requires reload before retry', async () => {
    mocks.save.mockResolvedValue({ ok: false, reason: 'The event has changed. Reload it.' })
    const { user, onSaved } = setup()
    await decide(user, 'approved', 'approved')
    await user.click(screen.getByRole('button', { name: 'Finalise review' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The event has changed')
    expect(screen.getByLabelText('Decision for Event name')).toHaveValue('approved')
    expect(screen.getByRole('button', { name: 'Finalise review' })).toBeDisabled()
    expect(onSaved).not.toHaveBeenCalled()
  })
  test('AC-007.5.32: controls stay disabled during saving and double clicks send only once', async () => {
    let resolve!: (value: { ok: true; status: 'approved' }) => void
    mocks.save.mockReturnValue(new Promise((done) => { resolve = done }))
    const { user } = setup()
    await decide(user, 'approved', 'approved')
    await user.dblClick(screen.getByRole('button', { name: 'Finalise review' }))
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Decision for Event name')).toBeDisabled()
    await act(async () => { resolve({ ok: true, status: 'approved' }) })
  })
})

describe('AC-007.6 — rejection reasons', () => {
  test('AC-007.6.6: rejecting a field without an explanation displays an error without saving', async () => {
    const { user } = setup()
    await decide(user, 'approved', 'rejected')
    await user.click(screen.getByRole('button', { name: 'Finalise review' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Give a reason')
    expect(mocks.save).not.toHaveBeenCalled()
  })
})

describe('AC-007.7 — field questions', () => {
  test('AC-007.7.31: every clarification field requires a question', async () => {
    const { user } = setup()
    await decide(user, 'approved', 'clarification_requested')
    await user.click(screen.getByRole('button', { name: 'Save clarification requests' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Explain what the organiser needs to clarify')
    expect(mocks.save).not.toHaveBeenCalled()
  })
  test('AC-007.7.32: provisional approval and a separate question save together without claiming final approval', async () => {
    mocks.save.mockResolvedValue({ ok: true, status: 'clarification_requested' })
    const { user, onSaved } = setup()
    await decide(user, 'approved', 'clarification_requested')
    await user.type(screen.getByLabelText(/Comment for Expected attendance/), 'Does this include staff?')
    expect(screen.getByText(/No event details will change/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save clarification requests' }))
    expect(mocks.save.mock.calls[0][2].decisions).toEqual([
      { field: 'name', decision: 'approved', note: '' },
      { field: 'expectedAttendance', decision: 'clarification_requested', note: 'Does this include staff?' },
    ])
    expect(onSaved).toHaveBeenCalledWith('clarification_requested')
  })
})

test('AC-007.10.3: rejecting every field sends both reasons and reports a rejected outcome', async () => {
  mocks.save.mockResolvedValue({ ok: true, status: 'rejected' })
  const { user, onSaved } = setup()
  await decide(user, 'rejected', 'rejected')
  await user.type(screen.getByLabelText(/Comment for Event name/), 'Keep the published title.')
  await user.type(screen.getByLabelText(/Comment for Expected attendance/), 'Capacity is 50.')
  await user.click(screen.getByRole('button', { name: 'Finalise review' }))
  expect(mocks.save.mock.calls[0][2].decisions).toEqual([
    { field: 'name', decision: 'rejected', note: 'Keep the published title.' },
    { field: 'expectedAttendance', decision: 'rejected', note: 'Capacity is 50.' },
  ])
  expect(onSaved).toHaveBeenCalledWith('rejected')
})
