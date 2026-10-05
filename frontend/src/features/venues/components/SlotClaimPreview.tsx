import type { ClaimCell } from '../slots'
import { SLOT_SHORT_LABELS, formatPlainDate } from '../slotFormat'

/**
 * What a booking occupies: its own slots, plus the setup slot before and the turnaround
 * slot after. Shown before a hold is placed, and again on the request afterwards, so the
 * coordinator never has to infer which extra slots were taken.
 */
export function SlotClaimPreview({ cells }: { cells: ClaimCell[] }) {
  if (cells.length === 0) {
    return <p className="text-sm text-slate-500">These event times fall outside every bookable slot.</p>
  }
  return (
    <ul className="space-y-1 text-sm">
      {cells.map((cell) => (
        <li key={`${cell.date}|${cell.slot}`} className="flex flex-wrap items-center gap-2">
          <span className="text-slate-800">
            {formatPlainDate(cell.date)} ({SLOT_SHORT_LABELS[cell.slot]})
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              cell.kind === 'event' ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {cell.kind === 'event' ? 'Event' : 'Setup / turnaround'}
          </span>
        </li>
      ))}
    </ul>
  )
}
