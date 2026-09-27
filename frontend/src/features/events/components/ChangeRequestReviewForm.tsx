import { useRef, useState } from 'react'
import { saveChangeRequestReview, CHANGE_REVIEW_SERVICE_MESSAGES } from '../changeRequestReviewService'
import { validateChangeRequestReview, CHANGE_REVIEW_MESSAGES } from '../changeRequestReviewValidation'
import { ChangeRequestReviewField } from './ChangeRequestReviewField'
import type { FieldReviewChoice } from './ChangeRequestReviewField'
import type { ChangeRequestReviewContext, EventChangeRequest, PreparedChangeRequestReview, ProposedEventChanges } from '../types'

export function ChangeRequestReviewForm({ request, context, onSaved }: {
  request: EventChangeRequest
  context: ChangeRequestReviewContext
  onSaved: (status: PreparedChangeRequestReview['status']) => void
}) {
  const [choices, setChoices] = useState<FieldReviewChoice[]>(() =>
    (Object.keys(request.proposedChanges) as (keyof ProposedEventChanges)[]).map((field) => ({
      field, decision: '', note: '',
    })))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reloadRequired, setReloadRequired] = useState(false)
  const [saved, setSaved] = useState(false)
  const saving = useRef(false)
  const needsClarification = choices.some(({ decision }) => decision === 'clarification_requested')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current || reloadRequired || saved) return
    if (choices.some(({ decision }) => decision === '')) {
      setError(CHANGE_REVIEW_MESSAGES.incompleteDecisions)
      return
    }
    const input = { action: 'decide', decisions: choices }
    const validation = validateChangeRequestReview(request.proposedChanges, input)
    if (!validation.ok) { setError(validation.reason); return }
    saving.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await saveChangeRequestReview(request, context.eventUpdatedAt, input)
      if (!result.ok) {
        setError(result.reason)
        // A save may have reached the database even when its response was lost.
        // Reload before any retry, rather than allowing duplicate/stale decisions.
        setReloadRequired(true)
      } else {
        setSaved(true)
        onSaved(result.status)
      }
    } catch {
      setError(CHANGE_REVIEW_SERVICE_MESSAGES.failed)
      setReloadRequired(true)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return <form onSubmit={submit} noValidate className="mt-5 space-y-4" aria-label="Review change request">
    <fieldset disabled={busy || saved || reloadRequired} className="space-y-4 disabled:opacity-70">
      <legend className="mb-2 text-base font-semibold">Review each requested change</legend>
      {choices.map((choice, index) => <ChangeRequestReviewField key={choice.field}
        field={choice.field} current={context.currentValues[choice.field]}
        proposed={request.proposedChanges[choice.field]} choice={choice}
        onChange={(next) => {
          setChoices((previous) => previous.map((value, i) => i === index ? next : value))
          setError(null)
        }} />)}
      <p className="text-sm text-slate-600">
        {needsClarification
          ? 'Your decisions and questions will be saved. No event details will change while clarification is outstanding.'
          : 'Finalising applies only the approved fields. Rejected fields keep their current values.'}
      </p>
      <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Saving review…' : needsClarification ? 'Save clarification requests' : 'Finalise review'}
      </button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {reloadRequired && <p className="text-sm text-slate-600">Use Reload review above to check the latest details before trying again.</p>}
  </form>
}
