import { useRef, useState } from 'react'
import { CHANGE_FIELD_LABELS } from '../changeRequestDisplay'
import { saveChangeRequestReply, CHANGE_REPLY_SERVICE_MESSAGES } from '../changeRequestReplyService'
import { validateChangeRequestReply } from '../changeRequestReplyValidation'
import type { EventChangeRequest } from '../types'

export function ChangeRequestReplyForm({ request, onSaved }: {
  request: EventChangeRequest
  onSaved: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const saving = useRef(false)
  const questions = request.fieldDecisions.filter((decision) => decision.decision === 'clarification_requested')
  const legacy = request.fieldDecisions.length === 0

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current || locked) return
    const input = legacy ? { note } : { replies: questions.map(({ field }) => ({ field, message: answers[field] ?? '' })) }
    const validation = validateChangeRequestReply(request, input)
    if (!validation.ok) { setError(validation.reason); return }
    saving.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await saveChangeRequestReply(request, input)
      setLocked(true)
      if (result.ok) onSaved()
      else setError(result.reason)
    } catch {
      setLocked(true)
      setError(CHANGE_REPLY_SERVICE_MESSAGES.failed)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  if (request.status !== 'clarification_requested') return null
  return <form aria-label="Reply to clarification" onSubmit={submit} noValidate className="mt-4 space-y-3">
    <fieldset disabled={busy || locked} className="space-y-3 disabled:opacity-70">
      <legend className="mb-2 font-semibold">Answer the coordinator’s questions</legend>
      {legacy ? <label className="block text-sm">Reply to coordinator
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label> : questions.map(({ field }) => <label key={field} className="block text-sm">
        Reply for {CHANGE_FIELD_LABELS[field] ?? field}
        <textarea value={answers[field] ?? ''} onChange={(event) => setAnswers((previous) => ({ ...previous, [field]: event.target.value }))}
          rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>)}
      <p className="text-sm text-slate-600">Answer every question before sending. Your answers explain the existing proposal; they do not change the event details.</p>
      <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
        {busy ? 'Sending replies…' : 'Send replies for review'}
      </button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {locked && error && <p className="text-sm text-slate-600">Your answers are kept here. Use Reload change requests to check the latest status before retrying; reloading clears unsaved answers.</p>}
  </form>
}
