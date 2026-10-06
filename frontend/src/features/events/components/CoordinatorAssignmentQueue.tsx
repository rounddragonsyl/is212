import { useState } from 'react'
import { formatDateTime, orDash } from '../formatters'
import type { EventRequestSummary } from '../types'
import { listAssignmentCoordinators } from '../coordinatorAssignmentService'
import { useRequestResource } from '../status/useRequestResource'
import { CoordinatorAssignmentForm } from './CoordinatorAssignmentForm'

/** Queue membership is presentation; Lead read/write permissions remain in the database. */
export function CoordinatorAssignmentQueue({ requests, onAssigned }: { requests: EventRequestSummary[]; onAssigned: () => void }) {
  const { value: coordinators, error, loading, refresh } = useRequestResource('assignment-coordinators', listAssignmentCoordinators)
  const [success, setSuccess] = useState<string | null>(null)
  function assigned() {
    setSuccess('Coordinator assigned successfully.')
    onAssigned()
    refresh()
  }
  const unassigned = requests.filter(request =>
    request.status === 'submitted' && request.coordinatorId === null,
  )

  return (
    <section aria-labelledby="unassigned-requests-heading">
      <h2 id="unassigned-requests-heading" className="mb-4 text-lg font-semibold text-slate-900">
        Unassigned requests
      </h2>
      {success && <p role="status" className="mb-4 text-sm text-green-700">{success}</p>}
      {loading ? <p className="mb-4 text-sm text-slate-600">Loading coordinators…</p> : error ? (
        <div role="alert" className="mb-4 text-sm text-red-700">
          {error} <button type="button" className="underline" onClick={refresh}>Retry coordinator list</button>
        </div>
      ) : coordinators?.length === 0 ? (
        <p className="mb-4 text-sm text-slate-600">No Event Coordinator accounts are available. Contact your administrator.</p>
      ) : null}
      {unassigned.length === 0 ? (
        <p className="text-sm text-slate-600">No submitted requests are waiting for assignment.</p>
      ) : (
        <ul className="space-y-4">
          {unassigned.map(request => (
            <li key={request.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="font-mono text-xs text-slate-500">{orDash(request.reference)}</p>
              <h3 className="mt-1 font-semibold text-slate-900">{orDash(request.name)}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{orDash(request.purpose)}</p>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-slate-500">Event type</dt><dd>{orDash(request.eventType)}</dd></div>
                <div><dt className="text-slate-500">Starts (Singapore time)</dt><dd>{formatDateTime(request.proposedStart)}</dd></div>
                <div><dt className="text-slate-500">Ends (Singapore time)</dt><dd>{formatDateTime(request.proposedEnd)}</dd></div>
                <div><dt className="text-slate-500">Expected attendance</dt><dd>{orDash(request.expectedAttendance)}</dd></div>
              </dl>
              <CoordinatorAssignmentForm eventId={request.id} eventName={orDash(request.name)}
                coordinators={coordinators ?? []} disabled={loading || error !== null} onAssigned={assigned} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
