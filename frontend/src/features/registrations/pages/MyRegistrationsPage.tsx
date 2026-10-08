import { useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { useCurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../../events/formatters'
import { useRequestResource } from '../../events/status/useRequestResource'
import { loadMyRegistrations } from '../registrationService'
import type { MyRegistration } from '../types'

/**
 * US15 AC-015.7: the signed-in Attendee's registrations. Refreshed periodically and on focus,
 * so an event that is cancelled or completed shows its new status without a manual reload.
 */
export function MyRegistrationsPage() {
  const { session, loading } = useCurrentUser()
  const read = useCallback(() => loadMyRegistrations(), [])
  const { value: registrations, error } = useRequestResource(`my-registrations:${session?.userId ?? ''}`, read)

  if (loading) return <PageContainer><p className="text-sm text-slate-500">Loading…</p></PageContainer>
  if (!session) return <Navigate to="/signin" replace state={{ from: '/registrations' }} />

  return (
    <PageContainer>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">My registrations</h1>
      <div className="mt-6">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        ) : !registrations ? (
          <p className="text-sm text-slate-500">Loading registrations…</p>
        ) : registrations.length === 0 ? (
          <Card title="No registrations yet">
            <p className="text-sm text-slate-600">
              You have not registered for any events yet.{' '}
              <Link to="/events/open" className="font-medium text-indigo-700 underline">
                Events open for registration
              </Link>
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {registrations.map((registration) => (
              <RegistrationItem key={registration.registrationId} registration={registration} />
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  )
}

function RegistrationItem({ registration }: { registration: MyRegistration }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="font-semibold text-slate-900">{registration.eventName}</p>
      <p className="mt-1 text-sm text-slate-600">{formatDateTime(registration.start)}</p>
      <p className="text-sm text-slate-600">{registration.venue ?? 'Venue to be confirmed'}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          Event: {registration.eventStatusLabel}
        </span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
          Registration: {registration.registrationStatusLabel}
        </span>
      </div>
    </li>
  )
}
