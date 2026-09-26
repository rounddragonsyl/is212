import { CHANGE_FIELD_LABELS } from '../changeRequestDisplay'
import { formatDateTime } from '../formatters'
import type { ChangeRequestReplyRound } from '../changeRequestReplyTypes'

export function ChangeRequestReplyHistory({ rounds }: { rounds: ChangeRequestReplyRound[] }) {
  if (rounds.length === 0) return null
  return <section aria-label="Clarification history" className="mt-4 space-y-3 border-t border-slate-200 pt-4">
    <h3 className="text-sm font-semibold">Clarification history</h3>
    {rounds.map((round, index) => <div key={`${round.requestVersion}:${index}`} className="rounded-lg bg-slate-50 p-3 text-sm">
      <p className="mb-2 font-medium">Reply {index + 1} · {formatDateTime(round.repliedAt)}</p>
      {'replies' in round.reply ? round.reply.replies.map((answer) => <div key={answer.field} className="mt-3 whitespace-pre-wrap">
        <p className="font-medium">{CHANGE_FIELD_LABELS[answer.field] ?? answer.field}</p>
        <p><strong>Coordinator’s question: </strong>{round.fieldDecisions?.find((decision) => decision.field === answer.field)?.note}</p>
        <p><strong>Organiser’s answer: </strong>{answer.message}</p>
      </div>) : <div className="whitespace-pre-wrap">
        <p><strong>Coordinator’s question: </strong>{round.reviewNote}</p>
        <p><strong>Organiser’s answer: </strong>{round.reply.note}</p>
      </div>}
    </div>)}
  </section>
}
