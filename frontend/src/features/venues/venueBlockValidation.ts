/**
 * PURE MODULE — US12 block rules for the form. No React, no Supabase, no I/O.
 *
 * Each rule is also enforced by venue_block_request_slots() and block_venue() in the
 * database. This copy puts a message beside the field; the database is the control.
 */
import type { VenueBlockField, VenueBlockInput, VenueBlockValidation } from './venueBlockTypes'

export const BLOCK_VALIDATION_MESSAGES = {
  reasonRequired: 'Give a reason, for example maintenance, renovation or a safety concern.',
} as const

export function validateVenueBlock(input: VenueBlockInput): VenueBlockValidation {
  const reason = input.reason.trim()
  const errors: Partial<Record<VenueBlockField, string>> = {}

  if (!reason) errors.reason = BLOCK_VALIDATION_MESSAGES.reasonRequired

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { ...input, reason } }
}
