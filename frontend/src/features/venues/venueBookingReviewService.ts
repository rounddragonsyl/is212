import type { VenueBookingActionResult } from './bookingTypes'

// Compilable RED scaffold; no decision is written until the contract is implemented.
export async function rejectVenueBooking(bookingId: string, reason: string): Promise<VenueBookingActionResult> {
  void bookingId
  void reason
  return { ok: false, reason: 'Rejection is not available yet.' }
}
