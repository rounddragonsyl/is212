import type { SlotCode } from './slots'

/** What Venue Staff enter in the block form (AC-012.2, AC-012.3). */
export interface VenueBlockInput {
  venueId: string
  /** 'YYYY-MM-DD', a Singapore calendar day. */
  startsOn: string
  endsOn: string
  slots: SlotCode[]
  reason: string
}

export type VenueBlockField = 'startsOn' | 'endsOn' | 'slots' | 'reason'

export type VenueBlockValidation =
  | { ok: true; value: VenueBlockInput }
  | { ok: false; errors: Partial<Record<VenueBlockField, string>> }
