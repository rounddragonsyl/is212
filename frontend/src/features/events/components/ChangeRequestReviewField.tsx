import { useId } from 'react'
import { CHANGE_FIELD_LABELS, formatChangeValue } from '../changeRequestDisplay'
import type { ChangeRequestFieldDecision, ProposedEventChanges } from '../types'

export type FieldReviewChoice = Omit<ChangeRequestFieldDecision, 'decision'> & {
  decision: ChangeRequestFieldDecision['decision'] | ''
}

export function ChangeRequestReviewField({ field, current, proposed, choice, onChange }: {
  field: keyof ProposedEventChanges
  current: unknown
  proposed: unknown
  choice: FieldReviewChoice
  onChange: (choice: FieldReviewChoice) => void
}) {
  const id = useId()
  const label = CHANGE_FIELD_LABELS[field] ?? field
  const noteRequired = choice.decision === 'rejected' || choice.decision === 'clarification_requested'
  return <fieldset className="rounded-lg border border-slate-200 p-4">
    <legend className="px-1 text-sm font-semibold text-slate-900">{label}</legend>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-slate-500">Current value</dt>
        <dd className="mt-1 whitespace-pre-wrap">{formatChangeValue(field, current)}</dd></div>
      <div><dt className="text-slate-500">Proposed value</dt>
        <dd className="mt-1 whitespace-pre-wrap">{formatChangeValue(field, proposed)}</dd></div>
    </dl>
    <label htmlFor={`${id}-decision`} className="mt-4 block text-sm font-medium">Decision for {label}</label>
    <select id={`${id}-decision`} value={choice.decision}
      onChange={(event) => onChange({ ...choice, decision: event.target.value as FieldReviewChoice['decision'] })}
      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm">
      <option value="">Choose a decision</option>
      <option value="approved">Approve</option>
      <option value="rejected">Reject</option>
      <option value="clarification_requested">Request clarification</option>
    </select>
    <label htmlFor={`${id}-note`} className="mt-3 block text-sm font-medium">
      Comment for {label} {noteRequired ? '(required)' : '(optional)'}
    </label>
    <textarea id={`${id}-note`} rows={2} value={choice.note} aria-required={noteRequired}
      onChange={(event) => onChange({ ...choice, note: event.target.value })}
      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
      placeholder={choice.decision === 'clarification_requested' ? 'What should the organiser clarify?'
        : choice.decision === 'rejected' ? 'Explain the rejection or required follow-up.' : 'Optional comment'} />
  </fieldset>
}
