import type { ReservationWindow } from './reservationTypes'

export const RESERVE_FORM_MESSAGES = {
  quantityWhole: 'Enter a whole number of units.',
  quantityRange: 'Reserve between 0 and the requested quantity.',
  returnBeforeLastDay: "The return date cannot be before the event's last day.",
  partialWhileAvailable: 'Enough units are available: reserve the full quantity.',
  alternativeSameType: 'Choose a different equipment type.',
} as const

// Step 3 stubs: signatures only. Implemented in Step 4.
export function reservationWindow(
  _eventStart: string,
  _eventEnd: string,
  _options: { transfer?: boolean; returnDate?: string } = {},
): ReservationWindow {
  throw new Error('Not implemented')
}
