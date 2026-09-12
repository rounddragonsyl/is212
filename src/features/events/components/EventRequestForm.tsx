import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { FieldErrors, Resolver } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Field, TextArea, TextInput } from '../../../components/ui/FormControls'
import { submitEventRequest } from '../eventService'
import { validateEventRequest } from '../validation'
import type { EventRequestFormValues, SubmitEventRequestResult } from '../types'
import { OptionalRequirementsFields } from './OptionalRequirementsFields'
import { SubmissionResult } from './SubmissionResult'

const emptyForm: EventRequestFormValues = {
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
}

/**
 * React Hook Form is wired to our own pure validator instead of zodResolver, so the rules
 * the form enforces are byte-for-byte the rules the unit tests assert. One definition,
 * two consumers.
 */
const resolver: Resolver<EventRequestFormValues> = (values) => {
  const result = validateEventRequest(values)
  if (result.ok) return { values, errors: {} }

  const errors = Object.fromEntries(
    result.issues.map((issue) => [issue.field, { type: 'validation', message: issue.message }]),
  ) as FieldErrors<EventRequestFormValues>

  return { values: {}, errors }
}

export function EventRequestForm() {
  const [result, setResult] = useState<SubmitEventRequestResult | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventRequestFormValues>({ defaultValues: emptyForm, resolver })

  // AC-005.2 keeps this handler from ever running with invalid values; the service
  // revalidates anyway, because it is callable from places that are not this form.
  const onSubmit = handleSubmit(async (values) => {
    const outcome = await submitEventRequest(values)
    setResult(outcome)
    if (outcome.ok) reset(emptyForm)
  })

  // The banner sits above a long form, so the organiser presses Submit at the bottom and
  // would otherwise see nothing happen. React Hook Form already focuses the first invalid
  // field; this covers the outcome of a submission that actually reached the server.
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [result])

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div ref={resultRef}>
        <SubmissionResult result={result} />
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">About the event</legend>

        <Field id="name" label="Event name">
          <TextInput id="name" {...register('name')} />
        </Field>

        <Field id="purpose" label="Purpose of the event" required error={errors.purpose?.message}>
          <TextArea
            id="purpose"
            aria-invalid={Boolean(errors.purpose)}
            {...register('purpose')}
          />
        </Field>

        <Field id="eventType" label="Type of event">
          <TextInput
            id="eventType"
            placeholder="Conference, gala dinner, workshop…"
            {...register('eventType')}
          />
        </Field>

        <Field id="description" label="Description">
          <TextArea id="description" {...register('description')} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">When and how many</legend>

        {/* Start and end read as one decision, so they sit on one row where there is space. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="proposedStart"
            label="Preferred start"
            required
            error={errors.proposedStart?.message}
          >
            <TextInput
              id="proposedStart"
              type="datetime-local"
              aria-invalid={Boolean(errors.proposedStart)}
              {...register('proposedStart')}
            />
          </Field>

          <Field
            id="proposedEnd"
            label="Preferred end"
            required
            error={errors.proposedEnd?.message}
          >
            <TextInput
              id="proposedEnd"
              type="datetime-local"
              aria-invalid={Boolean(errors.proposedEnd)}
              {...register('proposedEnd')}
            />
          </Field>
        </div>

        <Field
          id="expectedAttendance"
          label="Expected number of attendees"
          required
          error={errors.expectedAttendance?.message}
        >
          <TextInput
            id="expectedAttendance"
            type="number"
            min={1}
            aria-invalid={Boolean(errors.expectedAttendance)}
            {...register('expectedAttendance')}
          />
        </Field>
      </fieldset>

      <OptionalRequirementsFields register={register} />

      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 pt-6">
        <p className="mr-auto text-xs text-slate-500">
          You can discuss the details with your coordinator after submitting.
        </p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Submit event request'}
        </Button>
      </div>
    </form>
  )
}
