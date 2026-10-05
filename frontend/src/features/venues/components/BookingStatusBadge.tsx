import type { VenueBookingStatus } from '../bookingTypes'

const LABELS: Record<VenueBookingStatus, string> = {
  held: 'Tentatively held',
  pending_approval: 'Awaiting Venue Staff',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  cancelled: 'Released',
  expired: 'Expired',
}

const STYLES: Record<VenueBookingStatus, string> = {
  held: 'bg-amber-50 text-amber-800',
  pending_approval: 'bg-indigo-50 text-indigo-800',
  confirmed: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
  cancelled: 'bg-slate-100 text-slate-600',
  expired: 'bg-slate-100 text-slate-600',
}

export function BookingStatusBadge({ status }: { status: VenueBookingStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  )
}

export const BOOKING_STATUS_LABELS = LABELS
