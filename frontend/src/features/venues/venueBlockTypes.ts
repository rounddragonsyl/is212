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

/** One booking cell a block would overlap: the event itself, or its setup/turnaround. */
export interface PreviewCell {
  date: string
  slot: SlotCode
  kind: 'event' | 'buffer'
}

/** One booking a block would overlap, with only its cells inside the block (AC-012.7). */
export interface AffectedBooking {
  bookingId: string
  status: string
  eventReference: string | null
  eventName: string | null
  cells: PreviewCell[]
}

/** One cell of an existing block that a new block would overlap. */
export interface ExistingBlockOverlap {
  date: string
  slot: SlotCode
  reason: string
}

/** AC-012.7: what saving a block would touch. */
export interface VenueBlockPreview {
  affectedBookings: AffectedBooking[]
  existingBlocks: ExistingBlockOverlap[]
}
