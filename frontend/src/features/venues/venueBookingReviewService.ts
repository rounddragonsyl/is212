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

// Readback integration RED scaffold.
export async function getVenueBookingReview(bookingId: string): Promise<VenueBookingReviewResult> {
  void bookingId
  return { ok: false, reason: 'Booking review is not available yet.' }
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
