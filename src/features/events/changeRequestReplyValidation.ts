import { z } from 'zod'
import { validateChangeRequestReview } from './changeRequestReviewValidation'
import type { EventChangeRequest } from './types'
import type { ChangeRequestReplyValidationResult, ChangeRequestFieldReply } from './changeRequestReplyTypes'

const fieldRepliesSchema = z.object({
  replies: z.array(z.object({ field: z.string(), message: z.string().trim() }).strict()),
}).strict()
const wholeRequestReplySchema = z.object({ note: z.string().trim() }).strict()

export const CHANGE_REPLY_MESSAGES = {
  unavailable: 'This request is not awaiting clarification. Reload it before replying.',
  invalidQuestions: 'The clarification questions could not be read. Reload the request.',
  invalidReply: 'Provide text answers only; event values and review decisions cannot be changed here.',
  incomplete: 'Answer every clarification question once, without adding other fields.',
  empty: 'Enter an answer for every clarification question.',
} as const

/** Pure preparation only. The future save operation must check ownership, status and
 * the request version again, and retain the questions/answers before another review. */
export function validateChangeRequestReply(
  request: Pick<EventChangeRequest, 'status' | 'proposedChanges' | 'fieldDecisions' | 'reviewNote'>,
  input: unknown,
): ChangeRequestReplyValidationResult {
  if (request.status !== 'clarification_requested') {
    return { ok: false, reason: CHANGE_REPLY_MESSAGES.unavailable }
  }
  // Older reviews asked one overall question rather than storing field decisions.
  if (request.fieldDecisions.length === 0) {
    if (!request.reviewNote?.trim()) return { ok: false, reason: CHANGE_REPLY_MESSAGES.invalidQuestions }
    const parsed = wholeRequestReplySchema.safeParse(input)
    if (!parsed.success) return { ok: false, reason: CHANGE_REPLY_MESSAGES.invalidReply }
    if (!parsed.data.note) return { ok: false, reason: CHANGE_REPLY_MESSAGES.empty }
    return { ok: true, reply: parsed.data }
  }

  const review = validateChangeRequestReview(request.proposedChanges, {
    action: 'decide', decisions: request.fieldDecisions,
  })
  if (!review.ok || review.review.status !== 'clarification_requested') {
    return { ok: false, reason: CHANGE_REPLY_MESSAGES.invalidQuestions }
  }
  const questions = request.fieldDecisions.filter(({ decision }) => decision === 'clarification_requested')
  const parsed = fieldRepliesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: CHANGE_REPLY_MESSAGES.invalidReply }
  const { replies } = parsed.data
  if (replies.length !== questions.length || new Set(replies.map(({ field }) => field)).size !== questions.length
    || replies.some(({ field }) => !questions.some((question) => question.field === field))) {
    return { ok: false, reason: CHANGE_REPLY_MESSAGES.incomplete }
  }
  if (replies.some(({ message }) => !message)) return { ok: false, reason: CHANGE_REPLY_MESSAGES.empty }
  // Return the validated field names in question order, independent of input order.
  const ordered: ChangeRequestFieldReply[] = questions.map(({ field }) => ({
    field, message: replies.find((reply) => reply.field === field)!.message,
  }))
  return { ok: true, reply: { replies: ordered } }
}
