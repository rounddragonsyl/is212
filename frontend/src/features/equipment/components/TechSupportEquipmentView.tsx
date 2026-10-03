import { useEffect, useState } from 'react'
import { loadAllRequirements, loadMyEquipmentNotifications } from '../equipmentRequirementService'
import { RequirementStatusBadge } from './RequirementStatusBadge'
import type { EquipmentNotification, EquipmentNotificationAction, TechSupportRequirement } from '../types'

const ACTION_LABELS: Record<EquipmentNotificationAction, string> = {
  added: 'Added', changed: 'Changed', removed: 'Removed',
}

/** Read-only by design: Technical Support reviews requirements here and reserves in US14. */
export function TechSupportEquipmentView() {
  const [requirements, setRequirements] = useState<TechSupportRequirement[] | null>(null)
  const [notifications, setNotifications] = useState<EquipmentNotification[]>([])
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    let current = true
    void loadAllRequirements().then((result) => {
      if (!current) return
      if (result.ok) setRequirements(result.data)
      else setErrors((previous) => [...previous, result.reason])
    })
    void loadMyEquipmentNotifications().then((result) => {
      if (!current) return
      if (result.ok) setNotifications(result.data)
      else setErrors((previous) => [...previous, result.reason])
    })
    return () => { current = false }
  }, [])

  return <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">Equipment requirements</h2>
      {errors.map((error) => <p key={error} role="alert" className="text-sm text-red-700">{error}</p>)}
      {requirements?.length === 0 && <p className="text-sm text-slate-500">No equipment requirements recorded yet.</p>}
      {requirements && requirements.length > 0 && <ul className="divide-y divide-slate-100">
        {requirements.map((line) => <li key={line.id} className="py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{line.eventReference ?? 'No reference'}</span>
            <span className="text-slate-700">{line.eventName}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{line.typeName}</span>
            <span className="text-slate-600">× {line.quantity}</span>
            <RequirementStatusBadge status={line.displayStatus} />
          </div>
          {line.technicalNotes && <p className="mt-1 text-slate-600">{line.technicalNotes}</p>}
        </li>)}
      </ul>}
    </section>
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
      {notifications.length === 0
        ? <p className="text-sm text-slate-500">No notifications yet.</p>
        : <ul aria-label="Equipment notifications" className="space-y-2">
          {notifications.map((notice) => <li key={notice.id} className="rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
            <strong>{ACTION_LABELS[notice.action]}:</strong> {notice.typeName} × {notice.quantity} on {notice.eventReference ?? 'an event'}
            <span className="block text-xs text-slate-500">{new Date(notice.createdAt).toLocaleString()}</span>
          </li>)}
        </ul>}
    </section>
  </div>
}
