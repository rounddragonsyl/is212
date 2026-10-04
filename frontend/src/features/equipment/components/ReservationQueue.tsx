import { useEffect, useState } from 'react'
import { loadCatalogue } from '../equipmentRequirementService'
import { loadReviewQueue } from '../reservationService'
import { ReserveForm } from './ReserveForm'
import type { EquipmentType, Viewer } from '../types'
import type { ReservationOutcome, ReviewQueueItem } from '../reservationTypes'

const OUTCOME_TEXT: Record<ReservationOutcome['status'], string> = {
  reserved: 'Reserved', partially_reserved: 'Partially reserved', unavailable: 'Marked unavailable',
}

/** AC-014.1: requirements pending review, with units free for each window. Hiding this from
 * other roles is a courtesy; the database functions refuse them anyway (AC-014.7). */
export function ReservationQueue({ viewer }: { viewer: Viewer }) {
  const allowed = viewer.role === 'tech_support'
  const [items, setItems] = useState<ReviewQueueItem[] | null>(null)
  const [catalogue, setCatalogue] = useState<EquipmentType[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [lastOutcome, setLastOutcome] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) return
    let current = true
    void loadReviewQueue().then((result) => {
      if (!current) return
      if (result.ok) setItems(result.data)
      else setError(result.reason)
    })
    void loadCatalogue().then((result) => {
      if (current && result.ok) setCatalogue(result.data)
    })
    return () => { current = false }
  }, [allowed])

  if (!allowed) return <p className="text-sm text-slate-600">This page is for Technical Support staff.</p>
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>
  if (!items) return <p className="text-sm text-slate-500">Loading requirements…</p>

  function reserved(item: ReviewQueueItem, outcome: ReservationOutcome) {
    setItems((previous) => previous?.filter((line) => line.requirementId !== item.requirementId) ?? null)
    setSelected(null)
    setLastOutcome(`${OUTCOME_TEXT[outcome.status]} ${outcome.reserved} of ${outcome.requested} ${item.typeName}`
      + ` for ${item.eventReference ?? 'the event'}.`)
  }

  return <section className="space-y-3">
    {lastOutcome && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{lastOutcome}</p>}
    {items.length === 0
      ? <p className="text-sm text-slate-500">No equipment requirements pending review.</p>
      : <ul aria-label="Requirements pending review" className="divide-y divide-slate-100">
        {items.map((item) => {
          const short = item.quantityRequested - item.available
          return <li key={item.requirementId} className="py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{item.eventReference ?? 'No reference'}</span>
              <span className="font-medium text-slate-900">{item.typeName}</span>
              <span className="text-slate-600">{item.available} available · {item.quantityRequested} requested</span>
              {short > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Short by {short}</span>}
              <button type="button" className="ml-auto font-medium text-indigo-700"
                aria-label={`Review ${item.typeName} for ${item.eventReference ?? 'event'}`}
                onClick={() => setSelected(item.requirementId)}>Review</button>
            </div>
            {item.technicalNotes && <p className="mt-1 text-slate-600">{item.technicalNotes}</p>}
            {selected === item.requirementId && <ReserveForm item={item} catalogue={catalogue}
              onReserved={(outcome) => reserved(item, outcome)} onCancel={() => setSelected(null)} />}
          </li>
        })}
      </ul>}
  </section>
}
