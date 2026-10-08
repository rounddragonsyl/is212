import type { VenueBookingActionResult, VenueBookingStatus } from './bookingTypes'
import { supabase } from '../../lib/supabase'
import { rejectionReasonError } from './venueBookingReviewValidation'

export interface VenueBookingReview {
  id: string
  venueName: string
  status: VenueBookingStatus
  reviewNote: string | null
  reviewAlternative: string | null
  reviewedBy: string | null
  reviewedAt: string | null
}
export type VenueBookingReviewResult = { ok: true; booking: VenueBookingReview } | { ok: false; reason: string }

export async function getVenueBookingReview(bookingId: string): Promise<VenueBookingReviewResult> {
  const unavailable = { ok: false as const, reason: 'This booking could not be loaded. Check your access and reload.' }
  try {
    const { data, error } = await supabase.from('venue_bookings')
      .select('id, status, review_note, review_alternative, reviewed_by, reviewed_at, venues(name)')
      .eq('id', bookingId).maybeSingle()
    if (error || !data) return unavailable
    const row = data as unknown as {
      id: string; status: VenueBookingStatus; review_note: string | null
      review_alternative: string | null; reviewed_by: string | null; reviewed_at: string | null
      venues: { name: string } | null
    }
    return { ok: true, booking: {
      id: row.id, status: row.status, venueName: row.venues?.name ?? 'Venue booking',
      reviewNote: row.review_note, reviewAlternative: row.review_alternative,
      reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at,
    } }
  } catch { return unavailable }
}

// Actor, time and slot release are owned by the database in the same transaction.
export async function rejectVenueBooking(bookingId: string, reason: string, alternative?: string): Promise<VenueBookingActionResult> {
  const invalid = rejectionReasonError(reason)
  if (invalid) return { ok: false, reason: invalid }
  try {
    const { data, error } = await supabase.from('venue_bookings')
      .update({ status: 'rejected', review_note: reason.trim(), review_alternative: alternative?.trim() || null })
      .eq('id', bookingId).eq('status', 'pending_approval').select('id').maybeSingle()
    if (error || !data) return { ok: false, reason: 'The booking could not be rejected. Reload to check its current status and your access.' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'The result could not be confirmed. Reload before trying again.' }
  }
}
