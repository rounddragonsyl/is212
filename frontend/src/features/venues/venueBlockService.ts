/**
 * US12 block screens' only route to Supabase. Components call these functions, never
 * Supabase directly (CLAUDE.md). The database enforces every rule; the form's own checks
 * run first only so the user sees a message beside the field.
 */
import { supabase } from '../../lib/supabase'
import { validateVenueBlock } from './venueBlockValidation'
import type { VenueBlockField, VenueBlockInput } from './venueBlockTypes'

export const VENUE_BLOCK_MESSAGES = {
  unexpected: 'Something went wrong and nothing was changed. Please try again.',
} as const

export type VenueBlockResult<T> = { ok: true; value: T } | { ok: false; reason: string }

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

  const { data, error } = await supabase.rpc('block_venue', { ...requestArgs(block), p_reason: block.reason })
  if (error || typeof data !== 'string') return { ok: false, reason: VENUE_BLOCK_MESSAGES.unexpected }

  const flags = await supabase
    .from('venue_booking_flags')
    .select('id', { count: 'exact', head: true })
    .eq('closure_id', data)
  // The block is saved either way; null means the count could not be confirmed.
  return { ok: true, value: { blockId: data, flaggedBookings: flags.error ? null : (flags.count ?? 0) } }
}
