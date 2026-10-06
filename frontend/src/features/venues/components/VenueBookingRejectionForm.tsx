import type { VenueBookingStatus } from '../bookingTypes'

export interface RejectionFormProps {
  bookingId: string
  status: VenueBookingStatus
  onRejected: () => void
}

// RED scaffold keeps tests executable without missing-module failures.
export function VenueBookingRejectionForm(props: RejectionFormProps) {
  void props
  return <p>Rejection is not available yet.</p>
}
