import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { FieldErrors, Resolver } from 'react-hook-form'
import { requestEventChange, CHANGE_REQUEST_MESSAGES } from './eventChangeRequestService'
import type { RequestEventChangeResult } from './eventChangeRequestService'
import type { ProposedEventChanges } from './types'

type ChangeRequestFormValues = Required<ProposedEventChanges> & { reason: string }

const emptyChangeForm: ChangeRequestFormValues = {
  name: '',
  purpose: '',
  eventType: '',
  description: '',
  proposedStart: '',
  proposedEnd: '',
  expectedAttendance: '',
  programme: '',
  layoutPreference: '',
  accessibilityRequirements: '',
  equipmentRequirements: '',
  registrationRequired: false,
  specialArrangements: '',
  reason: '',
}

/**
 * Every event field is optional here — a change request may touch just one field. The
 * only value this form itself requires is `reason`. Whether at least one field was
 * actually filled in is checked at submit time, not here, since it needs to run after
 * blank fields are stripped out rather than as a per-field rule.
 */
const resolver: Resolver<ChangeRequestFormValues> = (values) => {
  const errors: FieldErrors<ChangeRequestFormValues> = {}
  if (!values.reason.trim()) {
    errors.reason = { type: 'validation', message: CHANGE_REQUEST_MESSAGES.reasonRequired }
  }
  return Object.keys(errors).length > 0 ? { values: {}, errors } : { values, errors: {} }
}

/** Collects only the fields the organiser actually filled in. A blank string means "no
 *  change to this field" — this is not a diff against original values, since the form
 *  never held original values to begin with. */
function collectChanges(
  values: ChangeRequestFormValues,
): Partial<Omit<ChangeRequestFormValues, 'reason'>> {
  const { reason, registrationRequired, ...rest } = values
  const changes: Partial<Omit<ChangeRequestFormValues, 'reason'>> = {}

  for (const key of Object.keys(rest) as (keyof typeof rest)[]) {
    const value = rest[key]
    if (typeof value === 'string' && value.trim() !== '') {
      (changes as any)[key] = value
    }
  }

  // registrationRequired is a boolean, so "blank" doesn't apply — it's excluded above and
  // handled separately once the form has a real tri-state control for it (see note below).

  return changes
}

export function useEventChangeRequestForm(eventId: string) {
  const [result, setResult] = useState<RequestEventChangeResult | null>(null)
  const busy = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeRequestFormValues>({ defaultValues: emptyChangeForm, resolver })

  const onSubmit = handleSubmit(async (values) => {
    if (busy.current) return
    busy.current = true
    setResult(null)
    try {
      const changes = collectChanges(values)

      if (Object.keys(changes).length === 0) {
        setResult({ ok: false, reason: CHANGE_REQUEST_MESSAGES.noChangesProposed })
        return
      }

      const outcome = await requestEventChange(eventId, changes, values.reason)
      setResult(outcome)
      if (outcome.ok) reset(emptyChangeForm)
    } catch {
      setResult({ ok: false, reason: CHANGE_REQUEST_MESSAGES.unexpected })
    } finally {
      busy.current = false
    }
  })

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [result])

  return {
    register, errors, result, resultRef,
    onSubmit, isSubmitting, disabled: isSubmitting,
  }
}