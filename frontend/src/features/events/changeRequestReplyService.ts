import { supabase } from '../../lib/supabase'
import { validateChangeRequestReply } from './changeRequestReplyValidation'
import type { EventChangeRequest } from './types'

export const CHANGE_REPLY_SERVICE_MESSAGES = {
  unavailable: 'Sign in as the organiser who owns this request to reply.',
  reload: 'The request or event has changed. Reload it before replying.',
  pending: 'Another change request is already in review. Reload the event to check it.',
  failed: 'The reply could not be confirmed. Reload to check its status before trying again.',
} as const

type ReplyResult = { ok: true; status: 'submitted' } | { ok: false; reason: string }

/** Use the version displayed with the questions. Never silently refresh it or retry
 * an uncertain write; the RPC checks the real owner and stores the entire reply atomically. */
export async function saveChangeRequestReply(request: EventChangeRequest, input: unknown): Promise<ReplyResult> {
  if (!request.id.trim() || !Number.isSafeInteger(request.reviewVersion) || request.reviewVersion! < 0) {
    return { ok: false, reason: CHANGE_REPLY_SERVICE_MESSAGES.reload }
  }
  const validation = validateChangeRequestReply(request, input)
  if (!validation.ok) return validation
  try {
    const { data: session, error: authError } = await supabase.auth.getUser()
    if (authError || !session?.user) return { ok: false, reason: CHANGE_REPLY_SERVICE_MESSAGES.unavailable }
    const { data, error } = await supabase.rpc('reply_to_change_request', {
      p_request_id: request.id, p_request_version: request.reviewVersion, p_reply: validation.reply,
    })
    if (error) {
      const reason = error.code === '42501' ? CHANGE_REPLY_SERVICE_MESSAGES.unavailable
        : error.code === '22000' ? CHANGE_REPLY_SERVICE_MESSAGES.reload
          : error.code === '23505' ? CHANGE_REPLY_SERVICE_MESSAGES.pending : CHANGE_REPLY_SERVICE_MESSAGES.failed
      return { ok: false, reason }
    }
    if (data !== 'submitted') return { ok: false, reason: CHANGE_REPLY_SERVICE_MESSAGES.failed }
    return { ok: true, status: 'submitted' }
  } catch {
    return { ok: false, reason: CHANGE_REPLY_SERVICE_MESSAGES.failed }
  }
}
