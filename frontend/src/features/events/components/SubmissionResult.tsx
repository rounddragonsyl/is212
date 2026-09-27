import { organiserStatusLabel } from '../status/organiserStatusLabel'
import type { SubmitEventRequestResult } from '../types'

interface SubmissionResultProps {
  result: SubmitEventRequestResult | null
}

/** AC-005.3 and AC-005.4: the organiser is told either way, and told why on failure. */
export function SubmissionResult({ result }: SubmissionResultProps) {
  if (!result) return null

  if (!result.ok) {
    return (
      <div
        role="alert"
        className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900"
      >
        <p className="font-semibold">Your event request was not submitted</p>
        <p className="mt-1">{result.reason}</p>
      </div>
    )
  }

  return (
    <div
      // role="status" rather than "alert": success is announced politely, without
      // interrupting whatever the screen reader is already saying.
      role="status"
      className="rounded border border-green-300 bg-green-50 p-4 text-sm text-green-900"
    >
      <p className="font-semibold">Your event request was submitted</p>
      <p className="mt-1">
        Reference <span className="font-mono font-semibold">{result.event.reference}</span> ·
        status {organiserStatusLabel(result.event.status)}
      </p>
      <p className="mt-1 text-xs">
        Quote this reference when you contact a coordinator about the request.
      </p>
    </div>
  )
}
