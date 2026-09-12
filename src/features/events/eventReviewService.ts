import { supabase } from '../../lib/supabase'
import { canActorTransition } from './statusRules'
import type { UserRole } from '../auth/types'
import type { EventRequestDetail, EventRequestSummary, EventStatus } from './types'

/**
 * Reading and reviewing event requests. Separate from eventService so the organiser's
 * submission path and the coordinator's review path do not grow into one file that knows
 * about everything.
 *
 * No role checks are needed on the reads: RLS decides what comes back. An organiser
 * running listEventRequests gets their own events; a coordinator gets all of them. The
 * query is the same, which is the point of enforcing authorisation in the database.
 */

// Written as single string literals rather than concatenated: supabase-js infers the row
// type by parsing this string at the type level, and a computed string collapses that to
// an error type. Long lines are the price of typed results.
const SUMMARY_COLUMNS =
  'id, reference, organiser_id, name, purpose, event_type, proposed_start, proposed_end, expected_attendance, status, submitted_at'

const DETAIL_COLUMNS =
  'id, reference, organiser_id, name, purpose, event_type, proposed_start, proposed_end, expected_attendance, status, submitted_at, description, programme, layout_preference, accessibility_requirements, equipment_requirements, registration_required, special_arrangements, review_note, reviewed_at, created_at'

export const REVIEW_MESSAGES = {
  loadFailed: 'The event requests could not be loaded.',
  notFound: 'That event request could not be found, or you are not permitted to see it.',
  illegalTransition: 'That is not a valid next step for this request.',
  notPermitted: 'You are not permitted to make that change.',
  noteRequired: 'Give a reason when returning or rejecting a request.',
} as const

interface EventRow {
  id: string
  reference: string | null
  organiser_id: string
  name: string | null
  purpose: string | null
  event_type: string | null
  proposed_start: string | null
  proposed_end: string | null
  expected_attendance: number | null
  status: string
  submitted_at: string | null
}

function toSummary(row: EventRow): EventRequestSummary {
  return {
    id: row.id,
    reference: row.reference,
    organiserId: row.organiser_id,
    name: row.name,
    purpose: row.purpose,
    eventType: row.event_type,
    proposedStart: row.proposed_start,
    proposedEnd: row.proposed_end,
    expectedAttendance: row.expected_attendance,
    status: row.status as EventStatus,
    submittedAt: row.submitted_at,
  }
}

/**
 * A database error is for us, not for the organiser. "column events.review_note does not
 * exist" tells a user nothing they can act on and leaks our schema; it belongs in the
 * console where a developer will find it.
 *
 * Errors we have explicitly mapped to advice — a permission refusal, a missing row — keep
 * their own wording. Anything unrecognised falls back to the plain message.
 */
function reportUnexpected(context: string, error: { message?: string; code?: string }): string {
  console.error(`[events] ${context}`, error)
  return REVIEW_MESSAGES.loadFailed
}

export type ListResult =
  | { ok: true; requests: EventRequestSummary[] }
  | { ok: false; reason: string }

/** Drafts are excluded: an unsubmitted draft is the organiser's private working copy. */
export async function listEventRequests(): Promise<ListResult> {
  const { data, error } = await supabase
    .from('events')
    .select(SUMMARY_COLUMNS)
    .neq('status', 'draft')
    .order('submitted_at', { ascending: false, nullsFirst: false })

  if (error) return { ok: false, reason: reportUnexpected('listEventRequests', error) }

  const rows: EventRow[] = data ?? []
  return { ok: true, requests: rows.map(toSummary) }
}

export type DetailResult =
  | { ok: true; request: EventRequestDetail }
  | { ok: false; reason: string }

export async function getEventRequest(id: string): Promise<DetailResult> {
  const { data, error } = await supabase
    .from('events')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) return { ok: false, reason: reportUnexpected('getEventRequest', error) }
  // RLS makes a forbidden row indistinguishable from a missing one, which is deliberate:
  // "you may not see this" would itself leak that the request exists.
  if (!data) return { ok: false, reason: REVIEW_MESSAGES.notFound }

  return {
    ok: true,
    request: {
      ...toSummary(data),
      description: data.description,
      programme: data.programme,
      layoutPreference: data.layout_preference,
      accessibilityRequirements: data.accessibility_requirements,
      equipmentRequirements: data.equipment_requirements,
      registrationRequired: data.registration_required ?? false,
      specialArrangements: data.special_arrangements,
      reviewNote: data.review_note,
      reviewedAt: data.reviewed_at,
      createdAt: data.created_at,
    },
  }
}

export type TransitionResult = { ok: true; status: EventStatus } | { ok: false; reason: string }

/**
 * The only place a status is changed. CLAUDE.md: never set status by direct assignment
 * outside this service — so that the legality of a move is decided in one place the tests
 * can reach, and the database trigger stays the backstop rather than the error message.
 */
export async function transitionEventStatus(options: {
  id: string
  from: EventStatus
  to: EventStatus
  actor: { role: UserRole; isOwner: boolean }
  note?: string
}): Promise<TransitionResult> {
  const { id, from, to, actor, note } = options

  if (!canActorTransition(actor, from, to)) {
    return { ok: false, reason: REVIEW_MESSAGES.notPermitted }
  }

  // A rejection or a return without a reason leaves the organiser nothing to act on.
  const needsNote = to === 'rejected' || (to === 'submitted' && from === 'under_review')
  if (needsNote && !note?.trim()) {
    return { ok: false, reason: REVIEW_MESSAGES.noteRequired }
  }

  const { data, error } = await supabase
    .from('events')
    .update({ status: to, review_note: note?.trim() || null })
    .eq('id', id)
    // Optimistic concurrency: if another coordinator has already moved this request, the
    // filter matches nothing and we report it rather than overwriting their decision.
    .eq('status', from)
    .select('id, status')
    .maybeSingle()

  if (error) {
    // A refusal from the trigger or a policy is meaningful: the workflow said no.
    const refused = error.code === '42501' || error.code === '22000'
    return {
      ok: false,
      reason: refused
        ? REVIEW_MESSAGES.notPermitted
        : reportUnexpected('transitionEventStatus', error),
    }
  }
  if (!data) return { ok: false, reason: REVIEW_MESSAGES.illegalTransition }

  return { ok: true, status: data.status as EventStatus }
}
