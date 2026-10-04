// US14 types. Kept apart from types.ts so US13's file is not touched.

/** The requirement statuses a reservation can end in (US13's status values). */
export type OutcomeAction = 'reserved' | 'partially_reserved' | 'unavailable'

/** A requirement pending Technical Support review, with units free for its window. */
export interface ReviewQueueItem {
  requirementId: string
  eventId: string
  eventReference: string | null
  eventName: string | null
  /** ISO timestamps; days are derived in Singapore time (#36). */
  eventStart: string
  eventEnd: string
  typeId: string
  typeName: string
  quantityRequested: number
  technicalNotes: string | null
  available: number
}

/** What Technical Support decides. Units, status and the reserving user are never sent. */
export interface ReservationInput {
  requirementId: string
  quantity: number
  returnDate: string
  alternativeTypeId: string | null
  alternativeNote: string | null
}

export interface ReservationOutcome {
  status: OutcomeAction
  reserved: number
  requested: number
}

export interface ReturnDateChange {
  requirementId: string
  returnDate: string
}

/** Dates as YYYY-MM-DD Singapore calendar days. */
export interface ReservationWindow {
  firstDay: string
  lastDay: string
  collectionDay: string
  /** Collection day, or one day earlier when the unit needs a transfer day. */
  blockedFrom: string
  returnDate: string
}

export interface ReserveFormValues {
  quantity: string
  returnDate: string
  alternativeTypeId: string
  alternativeNote: string
}

/** An outcome notice for the Event Coordinator (AC-014.13). */
export interface OutcomeNotice {
  id: string
  action: OutcomeAction
  typeName: string
  quantity: number
  quantityReserved: number
  alternativeTypeName: string | null
  alternativeNote: string | null
  createdAt: string
}
