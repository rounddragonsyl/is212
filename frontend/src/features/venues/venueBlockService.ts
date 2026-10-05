/**
 * US12 block screens' only route to Supabase. Components call these functions, never
 * Supabase directly (CLAUDE.md). The database enforces every rule; the form's own checks
 * run first only so the user sees a message beside the field.
 */
import { supabase } from '../../lib/supabase'
import type { SlotCode } from './slots'
import { groupAffectedBookings, validateVenueBlock } from './venueBlockValidation'
import type { PreviewCell, VenueBlockField, VenueBlockInput, VenueBlockPreview } from './venueBlockTypes'

export const VENUE_BLOCK_MESSAGES = {
  notPermitted: 'Only Venue Staff can block or unblock a venue.',
  overlapsBlock: 'Part of this period is already blocked. Remove or change that block first.',
  notFound: 'That block or venue no longer exists. Reload the page to see the current blocks.',
  unexpected: 'Something went wrong and nothing was changed. Please try again.',
  // The block call may have committed even though its reply was lost.
  uncertain: 'We could not confirm whether the block was saved. Reload the page before trying again.',
} as const

export type VenueBlockResult<T> = { ok: true; value: T } | { ok: false; reason: string }

interface RpcError {
  code?: string
  message?: string
}

/** Database error codes from 0027-0034. 22023 carries the database's own sentence. */
function describeError(error: RpcError | null): string {
  switch (error?.code) {
    case '42501': return VENUE_BLOCK_MESSAGES.notPermitted
    case '23505': return VENUE_BLOCK_MESSAGES.overlapsBlock
    case 'P0002': return VENUE_BLOCK_MESSAGES.notFound
    case '22023': return error?.message || VENUE_BLOCK_MESSAGES.unexpected
    default: return VENUE_BLOCK_MESSAGES.unexpected
  }
}

function firstError(errors: Partial<Record<VenueBlockField, string>>): string {
  return Object.values(errors).find(Boolean) ?? VENUE_BLOCK_MESSAGES.unexpected
}

function requestArgs(block: VenueBlockInput) {
  return {
    p_venue_id: block.venueId,
    p_starts_on: block.startsOn,
    p_ends_on: block.endsOn,
    p_slots: block.slots,
  }
}

/**
 * AC-012.1-3, 8. One database call saves the block, flags overlapping bookings and queues
 * their coordinators' emails. The flag count is read back afterwards rather than taken from
 * the preview, because a booking may have been made since the preview ran.
 */
export async function createVenueBlock(
  input: VenueBlockInput,
): Promise<VenueBlockResult<{ blockId: string; flaggedBookings: number | null }>> {
  const checked = validateVenueBlock(input)
  if (!checked.ok) return { ok: false, reason: firstError(checked.errors) }
  const block = checked.value

  let response: { data: unknown; error: RpcError | null }
  try {
    response = await supabase.rpc('block_venue', { ...requestArgs(block), p_reason: block.reason })
  } catch {
    return { ok: false, reason: VENUE_BLOCK_MESSAGES.uncertain }
  }
  if (response.error || typeof response.data !== 'string') {
    return { ok: false, reason: describeError(response.error) }
  }
  const blockId = response.data

  const flags = await supabase
    .from('venue_booking_flags')
    .select('id', { count: 'exact', head: true })
    .eq('closure_id', blockId)
  // The block is saved either way; null means the count could not be confirmed.
  return { ok: true, value: { blockId, flaggedBookings: flags.error ? null : (flags.count ?? 0) } }
}

interface PreviewRow {
  overlap_type: 'booking' | 'existing_block'
  booking_id: string | null
  booking_status: string | null
  event_reference: string | null
  event_name: string | null
  slot_date: string
  slot: SlotCode
  claim_kind: string
  block_reason: string | null
}

/** AC-012.7: asks the database what this block would overlap. Writes nothing. */
export async function previewVenueBlock(input: VenueBlockInput): Promise<VenueBlockResult<VenueBlockPreview>> {
  const checked = validateVenueBlock(input)
  if (!checked.ok) return { ok: false, reason: firstError(checked.errors) }

  const { data, error } = await supabase.rpc('preview_venue_block', requestArgs(checked.value))
  if (error) return { ok: false, reason: describeError(error) }

  const rows = (data ?? []) as PreviewRow[]
  return {
    ok: true,
    value: {
      affectedBookings: groupAffectedBookings(
        rows
          .filter((row) => row.overlap_type === 'booking' && row.booking_id !== null)
          .map((row) => ({
            bookingId: row.booking_id as string,
            status: row.booking_status ?? '',
            eventReference: row.event_reference,
            eventName: row.event_name,
            cell: { date: row.slot_date, slot: row.slot, kind: row.claim_kind as PreviewCell['kind'] },
          })),
      ),
      existingBlocks: rows
        .filter((row) => row.overlap_type === 'existing_block')
        .map((row) => ({ date: row.slot_date, slot: row.slot, reason: row.block_reason ?? '' })),
    },
  }
}
