import type { SaveEventDraftResult } from '../types'

export function DraftSaveResult({ result }: { result: SaveEventDraftResult | null }) {
  if (!result) return null
  return (
    <div
      role={result.ok ? 'status' : 'alert'}
      className={`rounded border p-4 text-sm ${result.ok
        ? 'border-green-300 bg-green-50 text-green-900'
        : 'border-red-300 bg-red-50 text-red-900'}`}
    >
      <p className="font-semibold">{result.ok ? 'Draft saved' : 'Draft save not confirmed'}</p>
      <p className="mt-1">
        {result.ok ? 'Your request has not been submitted. You can keep editing.' : result.reason}
      </p>
    </div>
  )
}
