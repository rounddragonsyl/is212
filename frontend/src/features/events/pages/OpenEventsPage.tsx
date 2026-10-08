import { useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { ErrorAlert } from '../../../components/ui/ErrorAlert'
import { useCurrentUser } from '../../auth/sessionContext'
import { EventWhenWhere } from '../../registrations/components/EventWhenWhere'
import { loadOpenEvents } from '../../registrations/registrationService'
import type { OpenEvent } from '../../registrations/types'
import { useRequestResource } from '../status/useRequestResource'

/**
 * Events open for registration (US15 AC-015.6). US29 made this the page a new Attendee lands
 * on; US15 replaced its placeholder with the real list. Refreshed periodically and on focus,
 * so an event that closes drops off without a manual reload.
 */
export function OpenEventsPage() {
  const { session, loading } = useCurrentUser()
  // Nothing to ask for until someone is signed in; the functions refuse anonymous callers anyway.
  const signedInAs = session?.userId ?? ''
  const read = useCallback(
    () => (signedInAs ? loadOpenEvents() : Promise.resolve({ ok: true as const, value: [] })),
    [signedInAs],
  )
  const { value: events, error, refresh } = useRequestResource(`open-events:${signedInAs}`, read)

  if (loading) {
    return (
      <PageContainer>
        <p className="text-sm text-slate-500">Loading…</p>
      </PageContainer>
    )
  }

  // `from` brings them back here after signing in rather than to the home page.
  if (!session) return <Navigate to="/signin" replace state={{ from: '/events/open' }} />

  return (
    <PageContainer>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Events open for registration
      </h1>
      <div className="mt-6">
        {error ? (
          <ErrorAlert onRetry={refresh}>{error}</ErrorAlert>
        ) : !events ? (
          <p className="text-sm text-slate-500">Loading events…</p>
        ) : events.length === 0 ? (
          <Card title="Nothing to register for yet">
            <p className="text-sm text-slate-600">No events are open for registration right now.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => <OpenEventItem key={event.id} event={event} />)}
          </ul>
        )}
      </div>
    </PageContainer>
  )
}

function OpenEventItem({ event }: { event: OpenEvent }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link to={`/events/open/${event.id}`} className="font-semibold text-indigo-700 hover:underline">
          {event.name}
        </Link>
        {event.registered && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            Registered
          </span>
        )}
      </div>
      <EventWhenWhere start={event.start} venue={event.venue} />
    </li>
  )
}
