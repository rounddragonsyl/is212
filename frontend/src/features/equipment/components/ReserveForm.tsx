import type { EquipmentType } from '../types'
import type { ReservationOutcome, ReviewQueueItem } from '../reservationTypes'

interface ReserveFormProps {
  item: ReviewQueueItem
  catalogue: EquipmentType[]
  onReserved: (outcome: ReservationOutcome) => void
  onCancel: () => void
}

// Step 3 stub: renders nothing. Implemented in Step 4.
export function ReserveForm(_props: ReserveFormProps) {
  return null
}
