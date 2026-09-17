import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { DraftAccess } from '../components/DraftAccess'
import { EventRequestForm } from '../components/EventRequestForm'
import { getEventDraft, DRAFT_LOAD_MESSAGES } from '../eventDraftQueryService'
import type { LoadEventDraftResult } from '../types'

export function ResumeDraftPage() {
  const { id = '' } = useParams()
  return <PageContainer>
    <Link to="/drafts" className="text-indigo-700 underline">Back to My Drafts</Link>
    <h1 className="my-6 text-3xl font-bold text-slate-900">Resume draft</h1>
    <DraftAccess><DraftEditor key={id} id={id} /></DraftAccess>
  </PageContainer>
}

function DraftEditor({ id }: { id: string }) {
  const [result, setResult] = useState<LoadEventDraftResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    getEventDraft(id).then((response) => {
      if (active) setResult(response)
    }).catch(() => {
      if (active) setResult({ ok: false, reason: DRAFT_LOAD_MESSAGES.loadFailed })
    })
    return () => { active = false }
  }, [id, attempt])

  if (!result) return <p role="status">Loading draft…</p>
  if (!result.ok) return <div>
    <p role="alert" className="mb-3">{result.reason}</p>
    <Button onClick={() => { setResult(null); setAttempt(attempt + 1) }}>Try again</Button>
  </div>
  return <Card title="Event request" description="Save your changes before leaving. Required fields apply only to submission.">
    <EventRequestForm initialDraft={result.draft} />
  </Card>
}
