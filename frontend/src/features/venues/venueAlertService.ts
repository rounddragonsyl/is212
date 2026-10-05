/**
 * US12, coordinators' side: the bookings a venue block has flagged for review. RLS (0031)
 * limits the rows to flags on the coordinator's own events and flags sent to them.
 */
import { supabase } from '../../lib/supabase'
import type { VenueBlockResult } from './venueBlockService'
import type { FlaggedBooking, PreviewCell } from './venueBlockTypes'

export const VENUE_ALERT_MESSAGES = {
  loadFailed: 'Your venue alerts could not be loaded. Please try again.',
} as const

interface FlagRow {
  id: string
  booking_id: string
  event_id: string
  detail: string
  affected_cells: PreviewCell[] | null
  created_at: string
  venues: { name: string } | null
  events: { reference: string | null; name: string | null } | null
}

/** AC-012.8: open flags only, newest first. A resolved flag needs nothing more from anyone. */
export async function listMyFlaggedBookings(): Promise<VenueBlockResult<FlaggedBooking[]>> {
  const { data, error } = await supabase
    .from('venue_booking_flags')
    .select('id, booking_id, event_id, detail, affected_cells, created_at, venues(name), events(reference, name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) return { ok: false, reason: VENUE_ALERT_MESSAGES.loadFailed }

  return {
    ok: true,
    value: ((data ?? []) as unknown as FlagRow[]).map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      eventId: row.event_id,
      eventReference: row.events?.reference ?? null,
      eventName: row.events?.name ?? null,
      venueName: row.venues?.name ?? 'Unknown venue',
      detail: row.detail,
      cells: row.affected_cells ?? [],
      createdAt: row.created_at,
    })),
  }
}
