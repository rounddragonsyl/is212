/** PURE MODULE — display wording for slots and plain calendar dates. */
import type { SlotCode } from './slots'

export const SLOT_SHORT_LABELS: Record<SlotCode, string> = { AM: 'AM', PM: 'PM', NIGHT: 'Night' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * '2041-03-10' -> '10 Mar 2041'. Slot dates are Singapore calendar days, not instants, so they
 * are formatted from their parts: going through Date would shift them by the viewer's timezone.
 */
export function formatPlainDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${Number(match[3])} ${month} ${match[1]}` : date
}
