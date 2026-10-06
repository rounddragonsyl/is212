import { useState } from 'react'
import type { EventRequestSummary } from '../types'
import { listAssignmentCoordinators } from '../coordinatorAssignmentService'
import { useRequestResource } from '../status/useRequestResource'
import { CoordinatorAssignmentCard } from './CoordinatorAssignmentCard'

/** Queue membership is presentation; Lead read/write permissions remain in the database. */
export function CoordinatorAssignmentQueue({ requests, onAssigned }: { requests: EventRequestSummary[]; onAssigned: () => void }) {
  const { value: coordinators, error, loading, refresh } = useRequestResource('assignment-coordinators', listAssignmentCoordinators)
  const [success, setSuccess] = useState<string | null>(null)
  function assigned(reassignment: boolean) {
    setSuccess(reassignment ? 'Coordinator reassigned successfully.' : 'Coordinator assigned successfully.')
    onAssigned()
    refresh()
  }
  const unassigned = requests.filter(request =>
    request.status === 'submitted' && request.coordinatorId === null,
  )
  const assignedEvents = requests.filter(request =>
    Boolean(request.coordinatorId) && ['submitted', 'under_review', 'approved', 'planning', 'confirmed'].includes(request.status),
  )
  function cards(events: EventRequestSummary[]) {
    return <ul className="space-y-4">{events.map(request => (
      <CoordinatorAssignmentCard key={request.id} request={request} coordinators={coordinators ?? []}
        disabled={loading || error !== null} onAssigned={() => assigned(Boolean(request.coordinatorId))} />
    ))}</ul>
  }

  return (
    <div className="space-y-6">
      {success && <p role="status" className="mb-4 text-sm text-green-700">{success}</p>}
      {loading ? <p className="mb-4 text-sm text-slate-600">Loading coordinators…</p> : error ? (
        <div role="alert" className="mb-4 text-sm text-red-700">
          {error} <button type="button" className="underline" onClick={refresh}>Retry coordinator list</button>
        </div>
      ) : coordinators?.length === 0 ? (
        <p className="mb-4 text-sm text-slate-600">No Event Coordinator accounts are available. Contact your administrator.</p>
      ) : null}
      <section aria-labelledby="unassigned-requests-heading">
        <h2 id="unassigned-requests-heading" className="mb-4 text-lg font-semibold text-slate-900">Unassigned requests</h2>
        {unassigned.length === 0 ? (
        <p className="text-sm text-slate-600">No submitted requests are waiting for assignment.</p>
        ) : cards(unassigned)}
      </section>
      <section aria-labelledby="assigned-events-heading">
        <h2 id="assigned-events-heading" className="mb-4 text-lg font-semibold text-slate-900">Assigned events</h2>
        <p className="mb-4 text-sm text-slate-600">Choose a different coordinator to reassign an active event. Completed, cancelled and rejected events are excluded.</p>
        {assignedEvents.length === 0 ? <p className="text-sm text-slate-600">No active assigned events.</p> : cards(assignedEvents)}
      </section>
    </div>
  )
}
