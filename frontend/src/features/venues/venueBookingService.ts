// src/features/venues/venueBookingService.ts
import { supabase } from '../../lib/supabase'
import { claimsForEvent } from './slots'
import type { TimeSlot, SlotCode } from './slots'

const POSTGRES_UNIQUE_VIOLATION = '23505'
const POSTGRES_RLS_VIOLATION = '42501'
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503'

export const VENUE_BOOKING_MESSAGES = {
  notSignedIn: 'You must be signed in to book a venue.',
  eventNotFound: 'That event could not be found.',
  noEventTimes: 'The event needs a start and end time before a venue can be booked.',
  outsideSlots: 'The event times do not fall within any bookable slot.',
  unavailable: 'That venue is not available for the requested slots, including its setup and turnaround slots.',
  rlsDenied: 'You are not permitted to book venues for this event.',
  unknownVenue: 'That venue could not be found.',
  unexpected: 'Something went wrong booking the venue. Please try again.',
} as const

export type VenueBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: string }

interface TimeSlotRow { code: SlotCode; starts_at: string; ends_at: string; sort_order: number }

export async function loadTimeSlots(): Promise<TimeSlot[]> {
  const { data, error } = await supabase
    .from('time_slots')
    .select('code, starts_at, ends_at, sort_order')
    .order('sort_order')
  if (error) {
    console.error('[venues] loadTimeSlots', error)
    return []
  }
  return ((data ?? []) as TimeSlotRow[]).map((row) => ({
    code: row.code, startsAt: row.starts_at, endsAt: row.ends_at, sortOrder: row.sort_order,
  }))
}

/** Holds that ran out still occupy cells until they are released, so free them first. */
async function releaseExpiredHolds(venueId: string): Promise<void> {
  const { data } = await supabase
    .from('venue_bookings')
    .select('id')
    .eq('venue_id', venueId)
    .eq('status', 'held')
    .lt('hold_expires_at', new Date().toISOString())
  const ids = (data ?? []).map((row: { id: string }) => row.id)
  if (ids.length === 0) return
  await supabase.from('venue_slot_claims').delete().in('booking_id', ids)
  await supabase.from('venue_bookings').update({ status: 'expired' }).in('id', ids)
}

function describeError(error: { code?: string; message?: string } | null): string {
  switch (error?.code) {
    case POSTGRES_UNIQUE_VIOLATION: return VENUE_BOOKING_MESSAGES.unavailable
    case POSTGRES_RLS_VIOLATION: return VENUE_BOOKING_MESSAGES.rlsDenied
    case POSTGRES_FOREIGN_KEY_VIOLATION: return VENUE_BOOKING_MESSAGES.unknownVenue
    default:
      console.error('[venues] booking', error)
      return VENUE_BOOKING_MESSAGES.unexpected
  }
}

/**
 * Places a tentative hold on a venue for an event. The event's own start and end decide the
 * slots; the caller never states them. The primary key on venue_slot_claims is what refuses a
 * double-booking or a missing buffer, so two coordinators racing cannot both succeed.
 */
export async function holdVenue(
  eventId: string,
  venueId: string,
  holdHours = 48,
): Promise<VenueBookingResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  const userId = sessionData?.user?.id
  if (sessionError || !userId) return { ok: false, reason: VENUE_BOOKING_MESSAGES.notSignedIn }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('proposed_start, proposed_end')
    .eq('id', eventId)
    .maybeSingle()
  if (eventError || !event) return { ok: false, reason: VENUE_BOOKING_MESSAGES.eventNotFound }
  if (!event.proposed_start || !event.proposed_end) {
    return { ok: false, reason: VENUE_BOOKING_MESSAGES.noEventTimes }
  }

  const slots = await loadTimeSlots()
  const claims = claimsForEvent(new Date(event.proposed_start), new Date(event.proposed_end), slots)
  if (claims.length === 0) return { ok: false, reason: VENUE_BOOKING_MESSAGES.outsideSlots }

  await releaseExpiredHolds(venueId)

  const { data: booking, error: bookingError } = await supabase
    .from('venue_bookings')
    .insert({
      event_id: eventId,
      venue_id: venueId,
      requested_by: userId,
      status: 'held',
      hold_expires_at: new Date(Date.now() + holdHours * 3_600_000).toISOString(),
    })
    .select('id')
    .single()
  if (bookingError || !booking) return { ok: false, reason: describeError(bookingError) }

  // One statement, so every cell is claimed or none is.
  const { error: claimError } = await supabase.from('venue_slot_claims').insert(
    claims.map((cell) => ({
      venue_id: venueId, slot_date: cell.date, slot: cell.slot, kind: cell.kind, booking_id: booking.id,
    })),
  )
  if (claimError) {
    // The two inserts are not one transaction, so undo the booking row by hand.
    await supabase.from('venue_bookings').delete().eq('id', booking.id)
    return { ok: false, reason: describeError(claimError) }
  }

  return { ok: true, bookingId: booking.id }
}

/** Rejection and cancellation both free the cells the same way. */
export async function releaseVenueBooking(
  bookingId: string,
  status: 'rejected' | 'cancelled',
  reviewNote: string | null = null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { error: claimError } = await supabase.from('venue_slot_claims').delete().eq('booking_id', bookingId)
  if (claimError) return { ok: false, reason: describeError(claimError) }
  const { error } = await supabase
    .from('venue_bookings')
    .update({ status, review_note: reviewNote })
    .eq('id', bookingId)
  return error ? { ok: false, reason: describeError(error) } : { ok: true }
}