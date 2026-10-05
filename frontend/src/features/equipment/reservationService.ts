import { supabase } from '../../lib/supabase'
import type { ServiceResult } from './types'
import type {
  OutcomeAction, OutcomeNotice, ReservationInput, ReservationOutcome, ReturnDateChange, ReviewQueueItem,
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

const OUTCOME_ACTIONS: OutcomeAction[] = ['reserved', 'partially_reserved', 'unavailable']

interface QueueRow {
  requirement_id: string
  event_id: string
  event_reference: string | null
  event_name: string | null
  proposed_start: string
  proposed_end: string
  type_id: string
  type_name: string
  quantity_requested: number
  technical_notes: string | null
  available: number
}
interface NoticeRow {
  id: string
  action: OutcomeAction
  type_name: string
  quantity: number
  quantity_reserved: number | null
  alternative_type_name: string | null
  alternative_note: string | null
  created_at: string
}
interface DatabaseError { code?: string }

/** Database detail stays private; each refusal maps to what the user can do next. */
function refusal(error: DatabaseError, clash: string): string {
  switch (error.code) {
    case '42501': return RESERVATION_MESSAGES.forbidden
    case '23P01': return clash
    case '22023': return RESERVATION_MESSAGES.invalid
    case '22000': return RESERVATION_MESSAGES.changed
    default: return RESERVATION_MESSAGES.saveFailed
  }
}

function isOutcome(value: unknown): value is ReservationOutcome {
  if (typeof value !== 'object' || value === null) return false
  const outcome = value as Record<string, unknown>
  return OUTCOME_ACTIONS.includes(outcome.status as OutcomeAction)
    && typeof outcome.reserved === 'number' && typeof outcome.requested === 'number'
}

export async function loadReviewQueue(): Promise<ServiceResult<ReviewQueueItem[]>> {
  try {
    const { data, error } = await supabase.rpc('equipment_review_queue')
    if (error || !Array.isArray(data)) return { ok: false, reason: RESERVATION_MESSAGES.loadFailed }
    return {
      ok: true,
      data: (data as QueueRow[]).map((row) => ({
        requirementId: row.requirement_id,
        eventId: row.event_id,
        eventReference: row.event_reference,
        eventName: row.event_name,
        eventStart: row.proposed_start,
        eventEnd: row.proposed_end,
        typeId: row.type_id,
        typeName: row.type_name,
        quantityRequested: row.quantity_requested,
        technicalNotes: row.technical_notes,
        available: row.available,
      })),
    }
  } catch {
    return { ok: false, reason: RESERVATION_MESSAGES.loadFailed }
  }
}

/** Sends only the decision. The database picks the units and records who reserved and when;
 * an uncertain result is never retried, because a retry could reserve twice. */
export async function reserveRequirement(input: ReservationInput): Promise<ServiceResult<ReservationOutcome>> {
  try {
    const { data, error } = await supabase.rpc('reserve_equipment', {
      p_requirement_id: input.requirementId,
      p_quantity: input.quantity,
      p_return_date: input.returnDate,
      p_alternative_type_id: input.alternativeTypeId,
      p_alternative_note: input.alternativeNote,
    })
    if (error) return { ok: false, reason: refusal(error, RESERVATION_MESSAGES.insufficient) }
    if (!isOutcome(data)) return { ok: false, reason: RESERVATION_MESSAGES.saveFailed }
    return { ok: true, data: { status: data.status, reserved: data.reserved, requested: data.requested } }
  } catch {
    return { ok: false, reason: RESERVATION_MESSAGES.saveFailed }
  }
}

export async function changeReturnDate(change: ReturnDateChange): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('change_equipment_return_date', {
      p_requirement_id: change.requirementId,
      p_return_date: change.returnDate,
    })
    if (error) return { ok: false, reason: refusal(error, RESERVATION_MESSAGES.returnConflict) }
    return { ok: true, data: null }
  } catch {
    return { ok: false, reason: RESERVATION_MESSAGES.saveFailed }
  }
}

/** RLS returns only the signed-in coordinator's own in-app notices. */
export async function loadOutcomeNotices(eventId: string): Promise<ServiceResult<OutcomeNotice[]>> {
  try {
    const { data, error } = await supabase
      .from('equipment_requirement_notifications')
      .select('id, action, type_name, quantity, quantity_reserved, alternative_type_name, alternative_note, created_at')
      .eq('event_id', eventId)
      .in('action', OUTCOME_ACTIONS)
    if (error || !data) return { ok: false, reason: RESERVATION_MESSAGES.noticesFailed }
    const notices = (data as NoticeRow[]).map((row) => ({
      id: row.id,
      action: row.action,
      typeName: row.type_name,
      quantity: row.quantity,
      quantityReserved: row.quantity_reserved ?? 0,
      alternativeTypeName: row.alternative_type_name,
      alternativeNote: row.alternative_note,
      createdAt: row.created_at,
    }))
    return { ok: true, data: notices.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
  } catch {
    return { ok: false, reason: RESERVATION_MESSAGES.noticesFailed }
  }
}
