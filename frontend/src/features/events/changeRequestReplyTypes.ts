import type { ProposedEventChanges, ChangeRequestFieldDecision } from './types'

/** Answers explain the existing proposal; they do not edit it or approve it. */
export interface ChangeRequestFieldReply {
  field: keyof ProposedEventChanges
  message: string
}

export type PreparedChangeRequestReply =
  | { replies: ChangeRequestFieldReply[] }
  | { note: string }

export type ChangeRequestReplyValidationResult =
  | { ok: true; reply: PreparedChangeRequestReply }
  | { ok: false; reason: string }

/** Snapshot saved by the reply RPC; actor IDs remain internal to the display. */
export interface ChangeRequestReplyRound {
  requestVersion: number
  fieldDecisions: ChangeRequestFieldDecision[] | null
  reviewNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reply: PreparedChangeRequestReply
  repliedBy: string
  repliedAt: string
}
