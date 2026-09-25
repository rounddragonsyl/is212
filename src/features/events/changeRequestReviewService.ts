import { supabase } from '../../lib/supabase'
import { validateChangeRequestReview } from './changeRequestReviewValidation'
import type { EventChangeRequest, PreparedChangeRequestReview } from './types'

export const CHANGE_REVIEW_SERVICE_MESSAGES = {
  notSignedIn: 'Sign in before reviewing a change request.',
  unavailable: 'This request is unavailable or you are no longer its assigned coordinator. Reload the event.',
  reload: 'The event or request has changed. Reload it before reviewing again.',
  invalidEvent: 'These decisions cannot be saved. Check the proposed values and decisions, including the resulting dates and attendance.',
  failed: 'The review could not be confirmed. Reload the request to check its status before trying again.',
} as const

export type SaveChangeRequestReviewResult =
  | { ok: true; status: PreparedChangeRequestReview['status'] }
  | { ok: false; reason: string }

function describeReviewError(error: { code?: string; message?: string }): string {
  if (error.code === '42501') return CHANGE_REVIEW_SERVICE_MESSAGES.unavailable
  if (error.code === '22000' && [
    'Event details changed; reload before reviewing',
    'This request is no longer pending review',
    'This event can no longer be changed',
  ].includes(error.message ?? '')) return CHANGE_REVIEW_SERVICE_MESSAGES.reload
  if (['22000', '22003', '22007', '22008', '22P02', '23514'].includes(error.code ?? '')) {
    return CHANGE_REVIEW_SERVICE_MESSAGES.invalidEvent
  }
  return CHANGE_REVIEW_SERVICE_MESSAGES.failed
}

/**
 * Pass the version shown beside the proposal, not a newly fetched timestamp: refreshing
 * it here would approve against details the reviewer has not seen. The RPC rechecks
 * assignment/state and reads proposed values from the stored request in one transaction.
 */
export async function saveChangeRequestReview(
  request: Pick<EventChangeRequest, 'id' | 'proposedChanges'>,
  eventUpdatedAt: string,
  input: unknown,
): Promise<SaveChangeRequestReviewResult> {
  if (!request.id.trim() || !eventUpdatedAt.trim() || !Number.isFinite(Date.parse(eventUpdatedAt))) {
    return { ok: false, reason: CHANGE_REVIEW_SERVICE_MESSAGES.reload }
  }
  const validation = validateChangeRequestReview(request.proposedChanges, input)
  if (!validation.ok) return validation
  const { review } = validation

  try {
    const { data: session, error: authError } = await supabase.auth.getUser()
    if (authError || !session?.user) {
      return { ok: false, reason: CHANGE_REVIEW_SERVICE_MESSAGES.notSignedIn }
    }

    // Never send approvedChanges or reviewer identity: both are resolved by the database.
    const payload = 'decisions' in review
      ? { action: 'decide', decisions: review.decisions }
      : { action: 'clarify', note: review.note }
    const { data, error } = await supabase.rpc('review_event_change_request', {
      p_request_id: request.id,
      p_event_updated_at: eventUpdatedAt,
      p_review: payload,
    })
    if (error) return { ok: false, reason: describeReviewError(error) }
    if (data !== review.status) return { ok: false, reason: CHANGE_REVIEW_SERVICE_MESSAGES.failed }
    return { ok: true, status: review.status }
  } catch {
    // A lost response can follow a committed transaction; do not automatically retry.
    return { ok: false, reason: CHANGE_REVIEW_SERVICE_MESSAGES.failed }
  }
}
