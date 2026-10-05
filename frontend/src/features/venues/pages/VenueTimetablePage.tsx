import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/FormControls'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { SlotClaimPreview } from '../components/SlotClaimPreview'
import { VenueTimetableGrid } from '../components/VenueTimetableGrid'
import { claimsForEvent, datesFrom } from '../slots'
import type { ClaimCell, TimeSlot } from '../slots'
import { canBookForEventStatus } from '../holdRules'
import { getVenue, getVenueTimetable } from '../venueTimetableService'
import { VENUE_BOOKING_MESSAGES, holdVenue, loadTimeSlots } from '../venueBookingService'
import { listMyAssignedEvents } from '../venueSearchService'
import type { AssignedEventOption, Venue } from '../types'
import type { VenueTimetable } from '../bookingTypes'

const DAYS_SHOWN = 7

const selectClassName =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 ' +
  'focus:ring-indigo-500/30 disabled:bg-slate-100'

function todayInSingapore(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
}

/**
 * A venue's calendar, and the place a tentative hold is placed. Choosing one of the
 * coordinator's events highlights the slots that booking would take — its own, plus the
 * setup slot before and turnaround slot after — rather than asking them to pick slots by
 * hand, because the event's times already decide them.
 */
export function VenueTimetablePage() {
  const { id: venueId = '' } = useParams()
  const [params] = useSearchParams()
  const { profile, loading: userLoading } = useCurrentUser()

  const [venue, setVenue] = useState<Venue | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [events, setEvents] = useState<AssignedEventOption[]>([])
  const [eventId, setEventId] = useState(params.get('eventId') ?? '')
  const [fromDate, setFromDate] = useState(todayInSingapore())
  const [timetable, setTimetable] = useState<VenueTimetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [holdError, setHoldError] = useState<string | null>(null)
  const [heldBookingId, setHeldBookingId] = useState<string | null>(null)
  const [holding, setHolding] = useState(false)

  const isCoordinator = profile?.role === 'coordinator'
  const selectedEvent = events.find((event) => event.id === eventId) ?? null

  const refreshTimetable = useCallback(async (slotDefs: TimeSlot[], start: string) => {
    const result = await getVenueTimetable(venueId, slotDefs, start, DAYS_SHOWN)
    if (result.ok) {
      setTimetable(result.timetable)
      setError(null)
    } else {
      setTimetable(null)
      setError(result.reason)
    }
  }, [venueId])

  useEffect(() => {
    if (userLoading || !isCoordinator) return
    let cancelled = false
    async function init() {
      setLoading(true)
      const [venueResult, slotDefs, assigned] = await Promise.all([
        getVenue(venueId), loadTimeSlots(), listMyAssignedEvents(),
      ])
      if (cancelled) return
      if (venueResult.ok) setVenue(venueResult.venue)
      else setError(venueResult.reason)
      setSlots(slotDefs)
      setEvents(assigned)
      await refreshTimetable(slotDefs, fromDate)
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
    // fromDate is handled by its own effect below; re-running init on it would refetch the venue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, isCoordinator, venueId, refreshTimetable])

  /** The cells this event's booking would occupy, recomputed whenever the choice changes. */
  const plannedCells: ClaimCell[] = useMemo(() => {
    if (!selectedEvent?.proposedStart || !selectedEvent?.proposedEnd || slots.length === 0) return []
    return claimsForEvent(new Date(selectedEvent.proposedStart), new Date(selectedEvent.proposedEnd), slots)
  }, [selectedEvent, slots])

  const selectedKeys = useMemo(
    () => new Set(plannedCells.map((cell) => `${cell.date}|${cell.slot}`)),
    [plannedCells],
  )

  const handleDateChange = async (next: string) => {
    setFromDate(next)
    await refreshTimetable(slots, next)
  }

  /** Jumps the calendar to the week the chosen event falls in, so its slots are on screen. */
  const handleEventChange = async (nextEventId: string) => {
    setEventId(nextEventId)
    setHoldError(null)
    setHeldBookingId(null)
    const event = events.find((candidate) => candidate.id === nextEventId)
    if (event?.proposedStart) {
      const eventDate = new Date(event.proposedStart.valueOf())
      const start = datesFrom(new Date(eventDate.getTime() + 8 * 3_600_000).toISOString().slice(0, 10), 1)[0]
      await handleDateChange(start)
    }
  }

  const handleHold = async () => {
    setHolding(true)
    setHoldError(null)
    const result = await holdVenue(eventId, venueId)
    if (result.ok) {
      setHeldBookingId(result.bookingId)
      await refreshTimetable(slots, fromDate)
    } else {
      setHoldError(result.reason)
    }
    setHolding(false)
  }

  const eventIsBookable = canBookForEventStatus(selectedEvent ? 'approved' : null)
  const canHold = Boolean(eventId) && plannedCells.length > 0 && !heldBookingId && eventIsBookable

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500">
        <Link to="/venues/search" className="hover:text-slate-900 hover:underline">Venues</Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <Link to={`/venues/${venueId}`} className="hover:text-slate-900 hover:underline">
          {venue?.name ?? 'Venue'}
        </Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span className="text-slate-700">Timetable</span>
      </nav>

      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {venue ? `${venue.name} availability` : 'Venue availability'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Choose one of your events to see the slots its booking would take, including the
          setup slot before and the turnaround slot after.
        </p>
      </div>

      {userLoading ? (
        <p className="text-sm text-slate-500">Checking your session…</p>
      ) : !isCoordinator ? (
        <Card title="Not available for your role">
          <p className="text-sm text-slate-600">Venue booking is available to event coordinators.</p>
        </Card>
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading availability…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="timetable-event" label="Book for one of your events">
              <select
                id="timetable-event"
                className={selectClassName}
                value={eventId}
                disabled={holding}
                onChange={(e) => handleEventChange(e.target.value)}
              >
                <option value="">— No event selected —</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.reference ?? event.name ?? event.id}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="timetable-from" label="Week beginning">
              <input
                id="timetable-from"
                type="date"
                className={selectClassName}
                value={fromDate}
                disabled={holding}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </Field>
          </div>

          {error ? (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              {error}
            </div>
          ) : timetable ? (
            <Card title="Availability">
              <VenueTimetableGrid timetable={timetable} selectedKeys={selectedKeys} />
            </Card>
          ) : null}

          {selectedEvent && (
            <Card
              title="Slots this booking would take"
              description="Taken from the event's own date and time, not entered here."
            >
              <SlotClaimPreview cells={plannedCells} />

              {holdError && (
                <div role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                  {holdError}
                </div>
              )}

              {heldBookingId ? (
                <div role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                  Tentative hold placed. It expires in 3 days if it is not submitted.{' '}
                  <Link to="/venues/bookings" className="font-medium underline">
                    View your venue bookings
                  </Link>
                </div>
              ) : (
                <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                  <Button type="button" onClick={handleHold} disabled={!canHold || holding}>
                    {holding ? 'Placing hold…' : 'Place tentative hold'}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {!selectedEvent && (
            <p className="text-sm text-slate-500">
              {VENUE_BOOKING_MESSAGES.noEventTimes.replace('The event needs', 'Pick an event. Each event needs')}
            </p>
          )}
        </div>
      )}
    </PageContainer>
  )
}
