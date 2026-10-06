import { useId, useRef, useState } from 'react'
import { assignEventCoordinator } from '../coordinatorAssignmentService'
import type { CoordinatorOption } from '../coordinatorAssignmentService'

interface Props {
  eventId: string
  eventName: string
  coordinators: CoordinatorOption[]
  disabled: boolean
  onAssigned: () => void
}

export function CoordinatorAssignmentForm({ eventId, eventName, coordinators, disabled, onAssigned }: Props) {
  const inputId = useId()
  const pending = useRef(false)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const validSelection = coordinators.some(coordinator => coordinator.id === selected)

  async function save() {
    if (pending.current || disabled || !validSelection) return
    pending.current = true
    setSaving(true)
    setError(null)
    try {
      const result = await assignEventCoordinator(eventId, selected)
      if (!result.ok) { setError(result.reason); return }
      setSelected('')
      onAssigned()
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return (
    <form className="mt-5 border-t border-slate-100 pt-4" onSubmit={event => { event.preventDefault(); void save() }}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">Coordinator for {eventName}</label>
      <div className="mt-2 flex flex-wrap gap-3">
        <select id={inputId} value={selected} disabled={disabled || saving || coordinators.length === 0}
          onChange={event => { setSelected(event.target.value); setError(null) }}
          className="min-w-0 rounded-md border border-slate-300 bg-white p-2 text-sm disabled:opacity-60">
          <option value="">Choose a coordinator</option>
          {coordinators.map(coordinator => <option key={coordinator.id} value={coordinator.id}>
            {coordinator.name} — {coordinator.activeEventCount} active {coordinator.activeEventCount === 1 ? 'event' : 'events'}
          </option>)}
        </select>
        <button type="submit" disabled={disabled || saving || !validSelection}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Assigning…' : 'Assign coordinator'}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </form>
  )
}
