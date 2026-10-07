import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Checkbox, Field, TextInput } from '../../../components/ui/FormControls'
import { AuthAlert, AuthPageShell } from '../components/AuthPageShell'
import { signUp } from '../authService'
import { SIGN_UP_LANDING_PATH } from '../types'
import { useCurrentUser } from '../sessionContext'
import { signUpFormSchema } from '../validation'
import type { SignUpFormValues } from '../validation'

type SubmitError = { reason: string; duplicate: boolean }

/** US29: anyone can create an Attendee account here; organiser access is only requested. */
export function SignUpPage() {
  const navigate = useNavigate()
  const { session, loading } = useCurrentUser()
  const [submitError, setSubmitError] = useState<SubmitError | null>(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  // Set once a sign-up is under way, so a session that arrives because of it is not mistaken
  // for someone who was already signed in when they opened the page.
  const [signingUp, setSigningUp] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { fullName: '', email: '', password: '', requestOrganiser: false },
  })

  if (!loading && session) return <Navigate to={signingUp ? SIGN_UP_LANDING_PATH : '/'} replace />

  async function submit(values: SignUpFormValues) {
    setSubmitError(null)
    setSigningUp(true)
    const result = await signUp(values)

    if (!result.ok) {
      setSigningUp(false)
      setSubmitError({ reason: result.reason, duplicate: Boolean(result.duplicate) })
      return
    }
    if (result.signedIn) {
      navigate(SIGN_UP_LANDING_PATH, { replace: true })
      return
    }
    // "Confirm email" is on (US29 D1): the link in the email signs them in.
    setAwaitingConfirmation(true)
  }

  if (awaitingConfirmation) {
    return (
      <AuthPageShell title="Check your email">
        <p role="status" className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
          Check your email to confirm your account. The link in it signs you in and shows the
          events open for registration.
        </p>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell title="Create your account" subtitle="Register for events and keep track of your registrations.">
      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
      >
        {submitError && (
          <AuthAlert>
            {submitError.reason}{' '}
            {submitError.duplicate && (
              <Link to="/signin" className="font-medium underline">Sign in</Link>
            )}
          </AuthAlert>
        )}

        <Field id="fullName" label="Full name" error={errors.fullName?.message}>
          <TextInput id="fullName" autoComplete="name" autoFocus
            aria-invalid={Boolean(errors.fullName)} {...register('fullName')} />
        </Field>

        <Field id="email" label="Email" error={errors.email?.message}>
          <TextInput id="email" type="email" autoComplete="email"
            aria-invalid={Boolean(errors.email)} {...register('email')} />
        </Field>

        <Field id="password" label="Password" error={errors.password?.message}>
          <TextInput id="password" type="password" autoComplete="new-password"
            aria-invalid={Boolean(errors.password)} {...register('password')} />
        </Field>

        {/* A request, not a role choice: the database still creates an Attendee (0042). */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox id="requestOrganiser" {...register('requestOrganiser')} />
            <label htmlFor="requestOrganiser" className="text-sm text-slate-700">
              I want to organise events
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Organiser access needs approval by our team. You start as an Attendee until then.
          </p>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Please wait…' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-slate-600">
          <Link to="/signin" className="font-medium text-indigo-700 underline-offset-4 hover:underline">
            I already have an account
          </Link>
        </p>
      </form>
    </AuthPageShell>
  )
}
