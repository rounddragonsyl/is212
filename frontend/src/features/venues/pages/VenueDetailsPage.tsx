import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { getVenue } from '../venueTimetableService'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS, featureLabel } from '../venueFeatureCatalogue'
import type { Venue } from '../types'

/** One venue's characteristics, and the way through to its calendar. Reached from a search
 *  result; the eventId the coordinator was searching for is carried along in the link. */
export function VenueDetailsPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const eventId = params.get('eventId') ?? ''
  const { profile, loading: userLoading } = useCurrentUser()
  const [venue, setVenue] = useState<Venue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isCoordinator = profile?.role === 'coordinator'

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getVenue(id)
    if (result.ok) {
      setVenue(result.venue)
      setError(null)
    } else {
      setVenue(null)
      setError(result.reason)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (userLoading || !isCoordinator) return
    load()
  }, [userLoading, isCoordinator, load])

  const timetableHref = eventId
    ? `/venues/${id}/timetable?eventId=${encodeURIComponent(eventId)}`
    : `/venues/${id}/timetable`

  const facilities = Object.entries(venue?.facility ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([code, value]) =>
      typeof value === 'number' ? `${featureLabel(FACILITY_OPTIONS, code)} (${value})` : featureLabel(FACILITY_OPTIONS, code))

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500">
        <Link to="/venues/search" className="hover:text-slate-900 hover:underline">Venues</Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span className="text-slate-700">{venue?.name ?? 'Venue'}</span>
      </nav>

      {userLoading ? (
        <p className="text-sm text-slate-500">Checking your session…</p>
      ) : !isCoordinator ? (
        <Card title="Not available for your role">
          <p className="text-sm text-slate-600">Venue details are available to event coordinators.</p>
        </Card>
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading venue…</p>
      ) : error || !venue ? (
        <Card title="Venue unavailable">
          <p className="text-sm text-slate-600">{error}</p>
          <Link to="/venues/search" className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline">
            Back to venue search
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{venue.name}</h1>
              <p className="mt-1 text-sm text-slate-600">{venue.location || 'Location not recorded'}</p>
            </div>
            <Link
              to={timetableHref}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2
                text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              View timetable &amp; book
            </Link>
          </header>

          {venue.status !== 'active' && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              This venue is {venue.status === 'retired' ? 'retired' : 'under maintenance'} and may not be bookable.
            </div>
          )}

          <Card title="Venue details">
            <dl className="divide-y divide-slate-100">
              <div className="grid grid-cols-3 gap-4 py-2 text-sm">
                <dt className="text-slate-500">Capacity</dt>
                <dd className="col-span-2 text-slate-800">{venue.capacity}</dd>
              </div>
              <div className="grid grid-cols-3 gap-4 py-2 text-sm">
                <dt className="text-slate-500">Primary layout</dt>
                <dd className="col-span-2 text-slate-800">{venue.layout || '—'}</dd>
              </div>
              <div className="grid grid-cols-3 gap-4 py-2 text-sm">
                <dt className="text-slate-500">Accessibility</dt>
                <dd className="col-span-2 text-slate-800">
                  {venue.accessibility.length > 0
                    ? venue.accessibility.map((code) => featureLabel(ACCESSIBILITY_OPTIONS, code)).join(', ')
                    : '—'}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-4 py-2 text-sm">
                <dt className="text-slate-500">Facilities</dt>
                <dd className="col-span-2 text-slate-800">{facilities.length > 0 ? facilities.join(', ') : '—'}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}
    </PageContainer>
  )
}
