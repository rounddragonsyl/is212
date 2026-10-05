/**
 * PURE MODULE — the rules a tentative hold obeys. No React, no Supabase, no I/O.
 *
 * The database is what actually refuses a clashing hold (the primary key on
 * venue_slot_claims). This module decides what the coordinator is allowed to attempt and
 * explains, in their words, why an attempt was refused.
 */
import type { EventStatus } from '../events/types'
import type { BookingConflict, VenueBookingStatus } from './bookingTypes'
import { SLOT_SHORT_LABELS, formatPlainDate } from './slotFormat'

/** Q&A: a venue is arranged once the event is approved and while it is being planned.
 *  A confirmed event already has its venue; a draft or rejected one has nothing to arrange. */
export const BOOKABLE_EVENT_STATUSES: readonly EventStatus[] = ['approved', 'planning']

/** AC: a tentative hold expires automatically after N days if not converted. */
export const HOLD_DURATION_DAYS = 3

/** Statuses that still occupy their slots, so they block another hold and stay on the calendar. */
export const LIVE_BOOKING_STATUSES: readonly VenueBookingStatus[] = ['held', 'pending_approval', 'confirmed']

/**
 * AC: an event can have at most one active tentative hold at a time. This is narrower than
 * LIVE_BOOKING_STATUSES on purpose: a confirmed booking does not count, because an event may
 * legitimately end up with several confirmed venues (a multi-venue event booking a main hall
 * and an overflow room both reach 'confirmed'). What may not coexist is two holds, or a hold
 * and a submitted request, in flight for the same event at once.
 */
export const ACTIVE_HOLD_STATUSES: readonly VenueBookingStatus[] = ['held', 'pending_approval']

export function canBookForEventStatus(status: string | null | undefined): boolean {
  return BOOKABLE_EVENT_STATUSES.includes(status as EventStatus)
}

export function holdExpiryFrom(now: Date, days = HOLD_DURATION_DAYS): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString()
}

/** Whole days left on a hold, rounded up, so "expires in 0 days" never shows on a live hold. */
export function daysUntilExpiry(holdExpiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(holdExpiresAt).getTime() - now.getTime()) / 86_400_000))
}

export function isHoldLive(holdExpiresAt: string | null, now: Date): boolean {
  return holdExpiresAt !== null && new Date(holdExpiresAt).getTime() > now.getTime()
}

const CONFLICT_REASONS: Record<BookingConflict['kind'], string> = {
  event: 'already booked',
  buffer: 'the setup or turnaround slot of another booking',
  maintenance: 'blocked by Venue Staff',
}

export function describeConflict(conflict: BookingConflict): string {
  return `${formatPlainDate(conflict.date)} (${SLOT_SHORT_LABELS[conflict.slot]}) — ${CONFLICT_REASONS[conflict.kind]}`
}

/** AC: the coordinator is told which slot conflicts and why, not merely that it failed. */
export function describeConflicts(conflicts: BookingConflict[]): string {
  if (conflicts.length === 0) return ''
  return conflicts.map(describeConflict).join('; ')
}
