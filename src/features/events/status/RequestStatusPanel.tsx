import { Card } from '../../../components/ui/Card'
import { StatusBadge } from '../components/StatusBadge'
import type { EventRequestDetail } from '../types'

export function RequestStatusPanel({ request }: { request: EventRequestDetail }) {
  const note = request.reviewNote?.trim()
  const returned = request.status === 'submitted' && Boolean(note)
  return (
    <Card title="Current status">
      <div aria-live="polite" className="space-y-4">
        <StatusBadge status={request.status} />
        {returned ? (
          <div>
            <h3 className="font-semibold text-amber-800">Outstanding clarification or amendment request</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{note}</p>
          </div>
        ) : request.status === 'rejected' ? (
          <div>
            <h3 className="font-semibold text-red-800">Reason for rejection</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {note || 'No reason was recorded. Please contact your event coordinator.'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No outstanding clarification or amendment requests.</p>
        )}
      </div>
    </Card>
  )
}
