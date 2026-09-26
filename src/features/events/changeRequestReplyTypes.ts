import type { ProposedEventChanges } from './types'

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
