import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import type { VenueAssessment } from '../suitabilityTypes'
import type { Venue } from '../types'
import { SuitabilityBadge } from './SuitabilityBadge'

interface VenueResultCardProps {
  venue: Venue
  /** US18: present only when the search is for one of the coordinator's events. */
  assessment?: VenueAssessment
  /** Carried into the details page link, so "View timetable" there can pre-fill the same event. */
  eventId?: string
}

export function VenueResultCard({ venue, assessment, eventId }: VenueResultCardProps) {
  const facilityEntries = Object.entries(venue.facility).filter(([, value]) => Boolean(value))
  const detailsHref = eventId
    ? `/venues/${venue.id}?eventId=${encodeURIComponent(eventId)}`
    : `/venues/${venue.id}`

  return (
    <li>
      <Link
        to={detailsHref}
        className="block rounded-xl transition hover:-translate-y-0.5 hover:shadow-md
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Card title={venue.name}>
          {assessment && <SuitabilityBadge assessment={assessment} />}
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Location</dt>
              <dd className="text-slate-800">{venue.location || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Capacity</dt>
              <dd className="text-slate-800">{venue.capacity}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Layout</dt>
              <dd className="text-slate-800">{venue.layout}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Accessibility</dt>
              <dd className="text-slate-800">
                {venue.accessibility.length > 0 ? venue.accessibility.join(', ') : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Facilities</dt>
              <dd className="text-slate-800">
                {facilityEntries.length > 0
                  ? facilityEntries
                      .map(([key, value]) => (typeof value === 'number' ? `${key} (${value})` : key))
                      .join(', ')
                  : '—'}
              </dd>
            </div>
          </dl>
        </Card>
      </Link>
    </li>
  )
}