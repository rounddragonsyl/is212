import { useEffect, useState } from 'react'
import { loadOutcomeNotices } from '../reservationService'
import type { OutcomeNotice } from '../reservationTypes'

function describe(notice: OutcomeNotice): string {
  const { quantity, quantityReserved, typeName } = notice
  if (notice.action === 'reserved') return `Reserved ${quantityReserved} of ${quantity}: ${typeName}`
  if (notice.action === 'partially_reserved') {
    return `Partially reserved ${quantityReserved} of ${quantity} (short ${quantity - quantityReserved}): ${typeName}`
  }
  return notice.alternativeTypeName
    ? `Unavailable, suggested ${notice.alternativeTypeName} instead of ${typeName}`
    : `Unavailable: ${typeName} (0 of ${quantity})`
}

/** AC-014.13: Technical Support's outcome for each requirement, shown to the coordinator.
 * Renders nothing until there is an outcome, so the US13 editor stays uncluttered. */
export function EquipmentOutcomeNotices({ eventId }: { eventId: string }) {
  const [notices, setNotices] = useState<OutcomeNotice[]>([])

  useEffect(() => {
    let current = true
    void loadOutcomeNotices(eventId).then((result) => {
      if (current && result.ok) setNotices(result.data)
    })
    return () => { current = false }
  }, [eventId])

  if (notices.length === 0) return null
  return <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold text-slate-900">Equipment updates from Technical Support</h2>
    <ul className="mt-2 space-y-2">
      {notices.map((notice) => <li key={notice.id} className="text-sm text-slate-700">
        <p>{describe(notice)}</p>
        {notice.alternativeNote && <p className="text-xs text-slate-500">{notice.alternativeNote}</p>}
      </li>)}
    </ul>
  </section>
}
