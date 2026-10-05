/**
 * PURE MODULE — US12 block rules for the form. No React, no Supabase, no I/O.
 *
 * Each rule is also enforced by venue_block_request_slots() and block_venue() in the
 * database. This copy puts a message beside the field; the database is the control.
 */
import type { SlotCode } from './slots'
import type { VenueBlockField, VenueBlockInput, VenueBlockValidation } from './venueBlockTypes'

/** Same limit as the database: one block covers at most 366 calendar days. */
export const MAX_BLOCK_DAYS = 366

/** The slots in time order, as the database stores them. */
export const BLOCK_SLOTS: readonly SlotCode[] = ['AM', 'PM', 'NIGHT']

export const BLOCK_VALIDATION_MESSAGES = {
  startRequired: 'Enter the first day of the block.',
  endRequired: 'Enter the last day of the block.',
  invalidDate: 'Enter a date that exists.',
  endBeforeStart: 'The block must end on or after the day it starts.',
  tooLong: `A single block can cover at most ${MAX_BLOCK_DAYS} days. Enter a longer closure as more than one block.`,
  slotsRequired: 'Choose at least one slot, or Full day.',
  reasonRequired: 'Give a reason, for example maintenance, renovation or a safety concern.',
} as const

type BlockErrors = Partial<Record<VenueBlockField, string>>

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

/**
 * Days since 1 Jan 1970 for a 'YYYY-MM-DD' calendar day, or null if that day doesn't exist.
 * Built in UTC from the parts, so the viewer's timezone can't shift it.
 */
function dayNumber(date: string): number | null {
  const match = DATE_PATTERN.exec(date)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const parsed = new Date(Date.UTC(year, month - 1, day))
  // Date rolls 30 February over into March; a real day survives the round trip.
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null
  }
  return parsed.getTime() / MS_PER_DAY
}

function dateErrors(startsOn: string, endsOn: string): BlockErrors {
  const errors: BlockErrors = {}
  const start = startsOn ? dayNumber(startsOn) : undefined
  const end = endsOn ? dayNumber(endsOn) : undefined

  if (start === undefined) errors.startsOn = BLOCK_VALIDATION_MESSAGES.startRequired
  else if (start === null) errors.startsOn = BLOCK_VALIDATION_MESSAGES.invalidDate
  if (end === undefined) errors.endsOn = BLOCK_VALIDATION_MESSAGES.endRequired
  else if (end === null) errors.endsOn = BLOCK_VALIDATION_MESSAGES.invalidDate

  if (typeof start === 'number' && typeof end === 'number') {
    if (end < start) errors.endsOn = BLOCK_VALIDATION_MESSAGES.endBeforeStart
    else if (end - start + 1 > MAX_BLOCK_DAYS) errors.endsOn = BLOCK_VALIDATION_MESSAGES.tooLong
  }
  return errors
}

/** Each slot once, in time order: NIGHT, AM, AM becomes AM, NIGHT. */
export function normaliseSlots(slots: readonly string[]): SlotCode[] {
  return BLOCK_SLOTS.filter((code) => slots.includes(code))
}

export function validateVenueBlock(input: VenueBlockInput): VenueBlockValidation {
  const startsOn = input.startsOn.trim()
  const endsOn = input.endsOn.trim()
  const slots = normaliseSlots(input.slots)
  const reason = input.reason.trim()
  const errors = dateErrors(startsOn, endsOn)

  if (slots.length === 0) errors.slots = BLOCK_VALIDATION_MESSAGES.slotsRequired
  if (!reason) errors.reason = BLOCK_VALIDATION_MESSAGES.reasonRequired

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { ...input, startsOn, endsOn, slots, reason } }
}
