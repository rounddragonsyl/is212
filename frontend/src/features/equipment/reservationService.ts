import type { ServiceResult } from './types'
import type {
  OutcomeNotice, ReservationInput, ReservationOutcome, ReturnDateChange, ReviewQueueItem,
} from './reservationTypes'

export const RESERVATION_MESSAGES = {
  forbidden: 'Only Technical Support Staff can reserve equipment.',
  insufficient: 'Not enough units are available for this window. Reload to see current availability.',
  invalid: 'Check the quantity, return date and alternative.',
  changed: 'This requirement is no longer pending review, or its event is no longer approved. Reload the list.',
  returnConflict: 'Some of these units are already reserved for those days.',
  loadFailed: 'Equipment requirements pending review could not be loaded. Reload to try again.',
  noticesFailed: 'Equipment updates could not be loaded. Reload to try again.',
  saveFailed: 'The reservation could not be confirmed. Reload to check it before trying again.',
} as const

// Step 3 stubs: signatures only. Implemented in Step 4.
export async function loadReviewQueue(): Promise<ServiceResult<ReviewQueueItem[]>> {
  throw new Error('Not implemented')
}

export async function reserveRequirement(_input: ReservationInput): Promise<ServiceResult<ReservationOutcome>> {
  throw new Error('Not implemented')
}

export async function changeReturnDate(_change: ReturnDateChange): Promise<ServiceResult<null>> {
  throw new Error('Not implemented')
}

export async function loadOutcomeNotices(_eventId: string): Promise<ServiceResult<OutcomeNotice[]>> {
  throw new Error('Not implemented')
}
