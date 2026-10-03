import { useState } from 'react'
import { RequirementStatusBadge } from './RequirementStatusBadge'
import type { EquipmentRequirement } from '../types'

interface RequirementListProps {
  requirements: EquipmentRequirement[]
  canManage: boolean
  busy: boolean
  onEdit: (requirement: EquipmentRequirement) => void
  onRemove: (requirement: EquipmentRequirement) => void
}

const holdsEquipment = ({ status }: EquipmentRequirement) => status === 'reserved' || status === 'partially_reserved'

export function RequirementList({ requirements, canManage, busy, onEdit, onRemove }: RequirementListProps) {
  // Removal asks first: for a held line it also releases equipment, which cannot be undone here.
  const [confirming, setConfirming] = useState<string | null>(null)

  if (requirements.length === 0) {
    return <p className="text-sm text-slate-500">No equipment requirements recorded yet.</p>
  }
  return <ul aria-label="Equipment requirements" className="divide-y divide-slate-100">
    {requirements.map((requirement) => <li key={requirement.id} className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">{requirement.typeName}</span>
        <span className="text-sm text-slate-600">× {requirement.quantity}</span>
        <RequirementStatusBadge status={requirement.displayStatus} />
        {canManage && <span className="ml-auto flex gap-2">
          <button type="button" disabled={busy} aria-label={`Edit ${requirement.typeName}`}
            onClick={() => onEdit(requirement)} className="text-sm font-medium text-indigo-700">Edit</button>
          <button type="button" disabled={busy} aria-label={`Remove ${requirement.typeName}`}
            onClick={() => setConfirming(requirement.id)} className="text-sm font-medium text-red-700">Remove</button>
        </span>}
      </div>
      {requirement.technicalNotes && <p className="mt-1 text-sm text-slate-600">{requirement.technicalNotes}</p>}
      {confirming === requirement.id && <div role="alertdialog" aria-label="Confirm removal"
        className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p>{holdsEquipment(requirement)
          ? 'Removing this line releases its reserved equipment.'
          : 'Remove this equipment requirement?'}</p>
        <div className="mt-2 flex gap-3">
          <button type="button" disabled={busy} className="font-semibold"
            onClick={() => { setConfirming(null); onRemove(requirement) }}>Confirm removal</button>
          <button type="button" onClick={() => setConfirming(null)}>Keep</button>
        </div>
      </div>}
    </li>)}
  </ul>
}
