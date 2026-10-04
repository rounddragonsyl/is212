import { z } from 'zod'
import type { ReservationWindow, ReviewQueueItem } from './reservationTypes'

// Pure rules only. The database re-checks every one of them inside reserve_equipment.

export const RESERVE_FORM_MESSAGES = {
  quantityWhole: 'Enter a whole number of units.',
  quantityRange: 'Reserve between 0 and the requested quantity.',
  returnBeforeLastDay: "The return date cannot be before the event's last day.",
  partialWhileAvailable: 'Enough units are available: reserve the full quantity.',
  alternativeSameType: 'Choose a different equipment type.',
} as const

// en-CA formats as YYYY-MM-DD, which also sorts and compares correctly as a string.
const singaporeDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit',
})
const displayDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** The Singapore calendar day of an instant (#36). */
export function singaporeDate(instant: string): string {
  return singaporeDay.format(new Date(instant))
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** "9 Mar 2035" for a YYYY-MM-DD day. */
export function formatDay(day: string): string {
  return displayDay.format(new Date(`${day}T00:00:00Z`))
}

/** Mirrors equipment_free_units in 0021: collection the day before the first day (#5),
 * one more transfer day for units held elsewhere (#13), through the return day. */
export function reservationWindow(
  eventStart: string,
  eventEnd: string,
  options: { transfer?: boolean; returnDate?: string } = {},
): ReservationWindow {
  const firstDay = singaporeDate(eventStart)
  const lastDay = singaporeDate(eventEnd)
  const collectionDay = addDays(firstDay, -1)
  return {
    firstDay,
    lastDay,
    collectionDay,
    blockedFrom: options.transfer ? addDays(collectionDay, -1) : collectionDay,
    returnDate: options.returnDate ?? lastDay,
  }
}

/** Validation for the reserve form. Values stay as strings; the form converts on submit. */
export function reserveFormSchema(item: ReviewQueueItem) {
  const { lastDay } = reservationWindow(item.eventStart, item.eventEnd)
  return z.object({
    quantity: z.string().superRefine((raw, context) => {
      const message = quantityProblem(raw, item)
      if (message) context.addIssue({ code: z.ZodIssueCode.custom, message })
    }),
    returnDate: z.string().refine((day) => day >= lastDay, RESERVE_FORM_MESSAGES.returnBeforeLastDay),
    alternativeTypeId: z.string().refine((typeId) => typeId !== item.typeId, RESERVE_FORM_MESSAGES.alternativeSameType),
    alternativeNote: z.string(),
  })
}

// One message at a time, so the field never shows contradictory errors.
function quantityProblem(raw: string, item: ReviewQueueItem): string | null {
  const text = raw.trim()
  if (!/^-?\d+$/.test(text)) return RESERVE_FORM_MESSAGES.quantityWhole
  const quantity = Number(text)
  if (quantity < 0 || quantity > item.quantityRequested) return RESERVE_FORM_MESSAGES.quantityRange
  // Partial only when fewer are available than requested (A3).
  if (quantity < item.quantityRequested && item.available >= item.quantityRequested) {
    return RESERVE_FORM_MESSAGES.partialWhileAvailable
  }
  return null
}

/** The units a shortfall leaves uncovered, or 0 for a full reservation or invalid input. */
export function shortfallFor(quantity: string, item: ReviewQueueItem): number {
  const value = Number(quantity.trim())
  return Number.isInteger(value) && value >= 0 && value < item.quantityRequested ? item.quantityRequested - value : 0
}
