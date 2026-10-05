import { REQUIREMENT_STATUS_LABELS } from '../validation'
import type { RequirementDisplayStatus } from '../types'

const styles: Record<RequirementDisplayStatus, string> = {
  pending_review: 'bg-amber-50 text-amber-700',
  reserved: 'bg-emerald-50 text-emerald-700',
  partially_reserved: 'bg-blue-50 text-blue-700',
  unavailable: 'bg-red-50 text-red-700',
  non_essential: 'bg-slate-100 text-slate-600',
}

export function RequirementStatusBadge({ status }: { status: RequirementDisplayStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
    {REQUIREMENT_STATUS_LABELS[status]}
  </span>
}
