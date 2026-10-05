import { SLOT_SHORT_LABELS, formatPlainDate } from '../slotFormat'
import type { PreviewCell, VenueBlockPreview as PreviewData } from '../venueBlockTypes'

const KIND_LABELS: Record<PreviewCell['kind'], string> = {
  event: 'event',
  buffer: 'setup or turnaround',
}

function describeCell(cell: PreviewCell): string {
  return `${formatPlainDate(cell.date)} ${SLOT_SHORT_LABELS[cell.slot]} (${KIND_LABELS[cell.kind]})`
}

function summary(count: number): string {
  if (count === 0) return 'No bookings are affected.'
  const flagged = count === 1 ? '1 booking will be flagged for review.' : `${count} bookings will be flagged for review.`
  return `${flagged} Bookings are not cancelled; their coordinators are emailed.`
}

/** AC-012.7: what saving this block would touch. Week 7 change 2: flagged, not cancelled. */
export function VenueBlockPreview({ preview }: { preview: PreviewData }) {
  return (
    <section aria-label="Preview" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {preview.existingBlocks.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Part of this period is already blocked. Remove or change that block first.</p>
          <ul className="mt-1 list-disc pl-5">
            {preview.existingBlocks.map((block, index) => (
              <li key={`${block.date}-${block.slot}-${index}`}>
                {formatPlainDate(block.date)} {SLOT_SHORT_LABELS[block.slot]}: {block.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-slate-700">{summary(preview.affectedBookings.length)}</p>

      {preview.affectedBookings.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {preview.affectedBookings.map((booking) => (
            <li key={booking.bookingId} className="px-3 py-2 text-sm">
              <p className="text-slate-900">
                <span className="font-medium">{booking.eventReference ?? 'No reference'}</span>
                {' · '}
                {booking.eventName ?? 'Untitled event'}
                {' · '}
                <span className="text-slate-500">{booking.status.replace('_', ' ')}</span>
              </p>
              <p className="text-xs text-slate-500">{booking.cells.map(describeCell).join(', ')}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
