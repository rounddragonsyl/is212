import { CHANGE_STATUS_LABELS } from '../changeRequestDisplay'
import type { ChangeRequestStatus } from '../types'

const styles: Record<ChangeRequestStatus, string> = {
  submitted: 'bg-amber-50 text-amber-700', approved: 'bg-emerald-50 text-emerald-700',
  partially_approved: 'bg-amber-50 text-amber-700', rejected: 'bg-red-50 text-red-700',
  clarification_requested: 'bg-blue-50 text-blue-700', withdrawn: 'bg-slate-100 text-slate-500',
}

export function ChangeRequestStatusBadge({ status }: { status: ChangeRequestStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
    {CHANGE_STATUS_LABELS[status]}
  </span>
}
