import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button } from '../../../components/ui/Button'
import { DraftAccess } from '../components/DraftAccess'
import { StatusBadge } from '../components/StatusBadge'
import { listEventDrafts, DRAFT_LOAD_MESSAGES } from '../eventDraftQueryService'
import { formatDateTime } from '../formatters'
import type { ListEventDraftsResult } from '../types'

export function MyDraftsPage() {
  return <PageContainer>
    <h1 className="mb-6 text-3xl font-bold text-slate-900">My Drafts</h1>
    <DraftAccess><DraftList /></DraftAccess>
  </PageContainer>
}

function DraftList() {
  const [result, setResult] = useState<ListEventDraftsResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    listEventDrafts().then((response) => {
      if (active) setResult(response)
    }).catch(() => {
      if (active) setResult({ ok: false, reason: DRAFT_LOAD_MESSAGES.listFailed })
    })
    return () => { active = false }
  }, [attempt])

  return <div className="space-y-5">
    <Link to="/events/new" className="text-indigo-700 underline">Start a new request</Link>
    {!result ? <p role="status">Loading drafts…</p> : !result.ok ? <div>
      <p role="alert" className="mb-3">{result.reason}</p>
      <Button onClick={() => { setResult(null); setAttempt(attempt + 1) }}>Try again</Button>
    </div> : result.drafts.length === 0 ? <p>You have no saved drafts.</p> : (
      <ul className="divide-y rounded-xl border border-slate-200 bg-white">
        {result.drafts.map((draft) => <li key={draft.id}>
          <Link to={`/drafts/${draft.id}`} className="flex items-center justify-between gap-4 p-5 hover:bg-slate-50">
            <span>
              <span className="block font-medium">{draft.name?.trim() || draft.purpose?.trim() || 'Untitled draft'}</span>
              <span className="text-sm text-slate-500">Last saved: {formatDateTime(draft.updatedAt)}</span>
            </span>
            <StatusBadge status="draft" />
          </Link>
        </li>)}
      </ul>
    )}
  </div>
}
