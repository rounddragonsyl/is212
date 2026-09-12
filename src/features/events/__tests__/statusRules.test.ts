import { describe, expect, test } from 'vitest'
import {
  STATUS_TRANSITIONS,
  canActorTransition,
  canTransition,
  reviewActionsFor,
} from '../statusRules'
import { EVENT_STATUSES } from '../types'

/**
 * Coordinator review story. Rename these to AC-0NN.x once the story number is confirmed in
 * the backlog — the traceability matrix expects the AC prefix, and these names are a
 * placeholder for it.
 *
 * These rules are duplicated in 0004_review.sql on purpose: the database is the control,
 * this is the error message. If you change one, change the other.
 */
describe('status workflow', () => {
  test('every status is covered by the transition table', () => {
    // Guards against adding a status to the enum and forgetting the workflow, which would
    // otherwise fail at runtime with an undefined lookup.
    for (const status of EVENT_STATUSES) {
      expect(STATUS_TRANSITIONS[status]).toBeDefined()
    }
  })

  test('a submitted request can be taken under review', () => {
    expect(canTransition('submitted', 'under_review')).toBe(true)
  })

  test('a submitted request cannot jump straight to approved', () => {
    // Approval without review would make the review step optional in practice.
    expect(canTransition('submitted', 'approved')).toBe(false)
  })

  test('a request under review can be returned to the organiser for more detail', () => {
    expect(canTransition('under_review', 'submitted')).toBe(true)
  })

  test.each(['completed', 'cancelled', 'rejected'] as const)(
    'a %s request is terminal and has no next step',
    (status) => {
      expect(STATUS_TRANSITIONS[status]).toHaveLength(0)
    },
  )
})

describe('who may perform a transition', () => {
  const coordinator = { role: 'coordinator', isOwner: false } as const
  const owner = { role: 'organiser', isOwner: true } as const
  const strangerOrganiser = { role: 'organiser', isOwner: false } as const

  test('a coordinator can approve a request that is under review', () => {
    expect(canActorTransition(coordinator, 'under_review', 'approved')).toBe(true)
  })

  test('an organiser cannot approve their own request', () => {
    // The entire reason a review step exists.
    expect(canActorTransition(owner, 'under_review', 'approved')).toBe(false)
  })

  test('an organiser can submit their own draft', () => {
    expect(canActorTransition(owner, 'draft', 'submitted')).toBe(true)
  })

  test('a coordinator cannot submit an organiser draft on their behalf', () => {
    expect(canActorTransition(coordinator, 'draft', 'submitted')).toBe(false)
  })

  test('an organiser cannot touch another organiser request', () => {
    expect(canActorTransition(strangerOrganiser, 'submitted', 'cancelled')).toBe(false)
  })

  test('an organiser can withdraw their own request', () => {
    expect(canActorTransition(owner, 'submitted', 'cancelled')).toBe(true)
  })
})

describe('actions offered to a coordinator', () => {
  test('a newly submitted request offers review, not approval', () => {
    // Cancelling is not a review decision: withdrawing a request belongs to the organiser
    // who raised it, so it is deliberately absent from the coordinator's actions.
    expect(reviewActionsFor('submitted').map((action) => action.to)).toEqual(['under_review'])
  })

  test('a request under review offers approve, return and reject', () => {
    const actions = reviewActionsFor('under_review').map((action) => action.to)
    expect(actions).toContain('approved')
    expect(actions).toContain('rejected')
    expect(actions).toContain('submitted')
  })

  test('a rejected request offers nothing', () => {
    expect(reviewActionsFor('rejected')).toEqual([])
  })
})
