import type { TimetableCell, VenueTimetable } from '../bookingTypes'
import { timetableCellLabel } from '../venueTimetable'
import { SLOT_SHORT_LABELS, formatPlainDate } from '../slotFormat'
import type { SlotCode } from '../slots'

const CELL_STYLES: Record<TimetableCell['state'], string> = {
  free: 'bg-white text-slate-400',
  held: 'bg-amber-100 text-amber-900',
  pending_approval: 'bg-indigo-100 text-indigo-900',
  confirmed: 'bg-emerald-100 text-emerald-900',
  maintenance: 'bg-slate-300 text-slate-700',
}

const ROW_ORDER: SlotCode[] = ['AM', 'PM', 'NIGHT']

/**
 * A venue's availability as days across and slots down. Cells the current selection would
 * occupy are ringed, so a coordinator sees setup and turnaround land on neighbouring slots
 * before committing.
 */
export function VenueTimetableGrid({
  timetable,
  selectedKeys = new Set<string>(),
}: {
  timetable: VenueTimetable
  selectedKeys?: Set<string>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Venue availability by date and slot</caption>
        <thead>
          <tr>
            <th scope="col" className="w-20 text-left text-xs font-medium text-slate-500">Slot</th>
            {timetable.days.map((day) => (
              <th key={day[0].date} scope="col" className="text-xs font-medium text-slate-500">
                {formatPlainDate(day[0].date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_ORDER.map((slot, rowIndex) => (
            <tr key={slot}>
              <th scope="row" className="text-left text-xs font-medium text-slate-500">
                {SLOT_SHORT_LABELS[slot]}
              </th>
              {timetable.days.map((day) => {
                const cell = day[rowIndex]
                const key = `${cell.date}|${cell.slot}`
                const selected = selectedKeys.has(key)
                return (
                  <td
                    key={key}
                    data-testid={`cell-${key}`}
                    aria-label={`${formatPlainDate(cell.date)} ${SLOT_SHORT_LABELS[cell.slot]}: ${timetableCellLabel(cell)}`}
                    className={`rounded-md px-2 py-3 text-center text-xs ${CELL_STYLES[cell.state]} ${
                      selected ? 'ring-2 ring-indigo-600 ring-offset-1' : ''
                    }`}
                  >
                    {timetableCellLabel(cell)}
                    {cell.eventReference && <span className="block text-[10px]">{cell.eventReference}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
