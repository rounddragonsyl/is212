import { classifyChangeRequest } from '../changeRequestSignificance'
import { CHANGE_FIELD_LABELS } from '../changeRequestDisplay'
import type { ProposedEventChanges } from '../types'

export function ChangeRequestSignificance({ proposedChanges }: { proposedChanges: ProposedEventChanges }) {
  const { kind, fields } = classifyChangeRequest(proposedChanges)
  return <div className="mt-3 text-sm">
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${kind === 'significant'
      ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
      {kind === 'significant' ? 'Significant change' : 'Ordinary edit'}
    </span>
    {kind === 'significant' && <p className="mt-1 text-slate-600">
      Affects: {fields.map((field) => CHANGE_FIELD_LABELS[field]).join(', ')}.
    </p>}
  </div>
}
