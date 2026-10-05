import { SLOT_SHORT_LABELS, formatPlainDate } from '../slotFormat'
import type { SlotCode } from '../slots'
import type { VenueBlock } from '../venueBlockTypes'
import { BLOCK_SLOTS } from '../venueBlockValidation'

interface VenueBlockListProps {
  blocks: VenueBlock[]
}

// Venues are in Singapore, so a block's time is shown there whatever the viewer's timezone.
const CREATED_AT = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDates(block: VenueBlock): string {
  return block.startsOn === block.endsOn
    ? formatPlainDate(block.startsOn)
    : `${formatPlainDate(block.startsOn)} – ${formatPlainDate(block.endsOn)}`
}

/** All three slots read as "Full day", which is how staff describe it. */
function formatSlots(slots: readonly SlotCode[]): string {
  if (BLOCK_SLOTS.every((code) => slots.includes(code))) return 'Full day'
  return BLOCK_SLOTS.filter((code) => slots.includes(code)).map((code) => SLOT_SHORT_LABELS[code]).join(', ')
}

function formatCreated(block: VenueBlock): string {
  const who = block.createdByName ?? 'Venue Staff'
  return `Blocked by ${who} on ${CREATED_AT.format(new Date(block.createdAt))}`
}

/** AC-012.9, 10: a venue's current blocks, with why and by whom. */
export function VenueBlockList({ blocks }: VenueBlockListProps) {
  if (blocks.length === 0) {
    return <p className="text-sm text-slate-500">No current blocks on this venue.</p>
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {blocks.map((block) => (
        <li key={block.id} className="space-y-1 px-4 py-3">
          <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="font-medium text-slate-900">{formatDates(block)}</span>
            <span className="text-slate-600">{formatSlots(block.slots)}</span>
          </p>
          <p className="text-sm text-slate-700">{block.reason}</p>
          <p className="text-xs text-slate-500">{formatCreated(block)}</p>
        </li>
      ))}
    </ul>
  )
}
