import type { VenueBookingStatus } from '../bookingTypes'
import { useId, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, TextArea } from '../../../components/ui/FormControls'
import { rejectVenueBooking } from '../venueBookingReviewService'
import { rejectionReasonError } from '../venueBookingReviewValidation'
import { useCurrentUser } from '../../auth/sessionContext'

export interface RejectionFormProps {
  bookingId: string
  status: VenueBookingStatus
  onRejected: () => void
}

export function VenueBookingRejectionForm({ bookingId, onRejected }: RejectionFormProps) {
  const id = useId()
  const { profile, loading } = useCurrentUser()
  const submitting = useRef(false)
  const [reason, setReason] = useState('')
  const [alternative, setAlternative] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading || profile?.role !== 'venue_staff') return null
  if (done) return <p role="status">Booking rejected.</p>

  return (
    <form className="space-y-4" noValidate onSubmit={async (event) => {
      event.preventDefault()
      if (submitting.current) return
      const invalid = rejectionReasonError(reason)
      setError(invalid)
      if (invalid) return
      submitting.current = true
      setBusy(true)
      const result = alternative.trim()
        ? await rejectVenueBooking(bookingId, reason, alternative)
        : await rejectVenueBooking(bookingId, reason)
      submitting.current = false
      setBusy(false)
      if (!result.ok) { setError(result.reason); return }
      setDone(true)
      onRejected()
    }}>
      <Field id={id} label="Rejection reason">
        <TextArea id={id} required value={reason} disabled={busy}
          onChange={(event) => setReason(event.target.value)} />
      </Field>
      <Field id={`${id}-alternative`} label="Suggested alternative (optional)">
        <TextArea id={`${id}-alternative`} value={alternative} disabled={busy}
          onChange={(event) => setAlternative(event.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Rejecting…' : 'Reject booking'}</Button>
    </form>
  )
}
