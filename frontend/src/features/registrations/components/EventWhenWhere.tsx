import { formatDateTime } from '../../events/formatters'

/**
 * The start (Singapore time, through the shared formatter) and venue lines an Attendee sees on
 * every event summary, so the list and My registrations cannot word them differently.
 */
export function EventWhenWhere({ start, venue }: { start: string; venue: string | null }) {
  return (
    <>
      <p className="mt-1 text-sm text-slate-600">{formatDateTime(start)}</p>
      <p className="text-sm text-slate-600">{venue ?? 'Venue to be confirmed'}</p>
    </>
  )
}
