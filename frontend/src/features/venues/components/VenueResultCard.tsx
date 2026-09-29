import { Card } from '../../../components/ui/Card'
import type { Venue } from '../types'

export function VenueResultCard({ venue }: { venue: Venue }) {
  const facilityEntries = Object.entries(venue.facility).filter(([, value]) => Boolean(value))

  return (
    <li>
      <Card title={venue.name}>
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
    </li>
  )
}