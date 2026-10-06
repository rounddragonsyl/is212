import type { VenueBookingActionResult } from './bookingTypes'
import { supabase } from '../../lib/supabase'
import { rejectionReasonError } from './venueBookingReviewValidation'

// Actor, time and slot release are owned by the database in the same transaction.
export async function rejectVenueBooking(bookingId: string, reason: string, alternative?: string): Promise<VenueBookingActionResult> {
  void alternative // AC9 RED: signature scaffold; storage contract is tested first.
  const invalid = rejectionReasonError(reason)
  if (invalid) return { ok: false, reason: invalid }
  try {
    const { data, error } = await supabase.from('venue_bookings')
      .update({ status: 'rejected', review_note: reason.trim() })
      .eq('id', bookingId).eq('status', 'pending_approval').select('id').maybeSingle()
    if (error || !data) return { ok: false, reason: 'The booking could not be rejected. Reload to check its current status and your access.' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'The result could not be confirmed. Reload before trying again.' }
  }
}
