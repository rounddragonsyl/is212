import { describe, expect, test } from 'vitest'
import { CHANGE_REVIEW_MESSAGES, validateChangeRequestReview } from '../changeRequestReviewValidation'

const proposed = { name: 'New name', expectedAttendance: '120' }
const approveName = { field: 'name', decision: 'approved' }
const approveAttendance = { field: 'expectedAttendance', decision: 'approved' }

describe('AC-007.5: approve or reject requested changes, including partial approval (#104)', () => {
  test('AC-007.5.1: approves all proposed changes', () => {
    expect(validateChangeRequestReview(proposed, {
      action: 'decide', decisions: [approveName, approveAttendance],
    })).toMatchObject({ ok: true, review: { status: 'approved', approvedChanges: proposed } })
  })

  test('AC-007.5.2: rejects all proposed changes with reasons', () => {
    expect(validateChangeRequestReview(proposed, { action: 'decide', decisions: [
      { field: 'name', decision: 'rejected', note: 'Keep the published name.' },
      { field: 'expectedAttendance', decision: 'rejected', note: 'Venue capacity is 100.' },
    ] })).toMatchObject({ ok: true, review: { status: 'rejected', approvedChanges: {} } })
  })

  test('AC-007.5.3: supports different decisions in one request', () => {
    expect(validateChangeRequestReview(proposed, { action: 'decide', decisions: [
      approveName,
      { field: 'expectedAttendance', decision: 'rejected', note: 'Venue capacity is 100.' },
    ] })).toMatchObject({ ok: true, review: { status: 'partially_approved',
      approvedChanges: { name: 'New name' } } })
  })

  test.each([
    ['AC-007.5.4', []],
    ['AC-007.5.5', [approveName]],
    ['AC-007.5.6', [approveName, approveName]],
    ['AC-007.5.7', [approveName, { field: 'purpose', decision: 'approved' }]],
  ])('%s: refuses incomplete, duplicate or unrequested decisions', (_id, decisions) => {
    expect(validateChangeRequestReview(proposed, { action: 'decide', decisions }))
      .toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.incompleteDecisions })
  })

  test('AC-007.5.8: refuses unsupported decisions', () => {
    expect(validateChangeRequestReview({ name: 'New name' }, {
      action: 'decide', decisions: [{ field: 'name', decision: 'maybe' }],
    })).toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.invalidReview })
  })

  test.each([
    ['AC-007.5.9', {}],
    ['AC-007.5.10', { status: 'confirmed' }],
    ['AC-007.5.11', { expectedAttendance: 120 }],
    ['AC-007.5.12', { name: undefined }],
  ])('%s: refuses empty or malformed stored proposals', (_id, changes) => {
    expect(validateChangeRequestReview(changes, { action: 'decide', decisions: [] }))
      .toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.invalidChanges })
  })
})

describe('AC-007.6: rejection reasons', () => {
  test('AC-007.6.1: requires a nonblank explanation for every rejected field', () => {
    expect(validateChangeRequestReview(proposed, { action: 'decide', decisions: [
      { field: 'name', decision: 'rejected', note: 'Keep current name.' },
      { field: 'expectedAttendance', decision: 'rejected', note: '  ' },
    ] })).toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.rejectionNoteRequired })
  })

  test('AC-007.6.2: preserves the explanation alongside its rejected field', () => {
    const result = validateChangeRequestReview({ name: 'New name' }, {
      action: 'decide', decisions: [{ field: 'name', decision: 'rejected', note: '  Explain the new title.  ' }],
    })
    expect(result).toMatchObject({ ok: true, review: { decisions: [
      { field: 'name', decision: 'rejected', note: 'Explain the new title.' },
    ] } })
  })
})

describe('AC-007.7: request clarification', () => {
  test('AC-007.7.1: keeps all event values unchanged while retaining the follow-up', () => {
    expect(validateChangeRequestReview(proposed, { action: 'clarify', note: '  Why more attendees?  ' }))
      .toEqual({ ok: true, review: { status: 'clarification_requested',
        note: 'Why more attendees?', approvedChanges: {} } })
  })

  test('AC-007.7.2: requires a nonblank clarification message', () => {
    expect(validateChangeRequestReview(proposed, { action: 'clarify', note: '  ' }))
      .toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.clarificationRequired })
  })

  test('AC-007.7.3: cannot combine clarification with approval decisions', () => {
    expect(validateChangeRequestReview(proposed, {
      action: 'clarify', note: 'Please explain.', decisions: [approveName, approveAttendance],
    })).toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.invalidReview })
  })
})

describe('AC-007.9: prepare only accepted event values', () => {
  test('AC-007.9.1: preserves false and empty text as explicit proposed values', () => {
    expect(validateChangeRequestReview({ registrationRequired: false, description: '' }, {
      action: 'decide', decisions: [
        { field: 'registrationRequired', decision: 'approved' },
        { field: 'description', decision: 'approved' },
      ],
    })).toMatchObject({ ok: true, review: { approvedChanges: { registrationRequired: false, description: '' } } })
  })

  test('AC-007.9.2: does not modify the proposal or the coordinator input', () => {
    const changes = Object.freeze({ ...proposed })
    const input = Object.freeze({ action: 'decide', decisions: Object.freeze([
      Object.freeze(approveName), Object.freeze(approveAttendance),
    ]) })
    expect(validateChangeRequestReview(changes, input).ok).toBe(true)
    expect(changes).toEqual(proposed)
  })
})
