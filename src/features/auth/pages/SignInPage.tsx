import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandMark } from '../../../components/layout/BrandMark'
import { Button } from '../../../components/ui/Button'
import { Field, TextInput } from '../../../components/ui/FormControls'
import { ensureOrganiserProfile, getCurrentSession, signIn, signUp } from '../authService'
import { useCurrentUser } from '../sessionContext'
import { validateCredentials } from '../validation'
import type { CredentialIssue } from '../validation'

type Mode = 'signIn' | 'signUp'

interface LocationState {
  from?: string
}

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useCurrentUser()

  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [issues, setIssues] = useState<CredentialIssue[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Send people back where they were headed, not to a generic landing page.
  const destination = (location.state as LocationState | null)?.from ?? '/'

  if (!loading && session) return <Navigate to={destination} replace />

  const messageFor = (field: CredentialIssue['field']) =>
    issues.find((issue) => issue.field === field)?.message

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setNotice(null)

    const validation = validateCredentials({ email, password })
    if (!validation.ok) {
      setIssues(validation.issues)
      return
    }
    setIssues([])
    setBusy(true)

    const result =
      mode === 'signIn'
        ? await signIn(validation.email, validation.password)
        : await signUp(validation.email, validation.password)

    if (!result.ok) {
      setFormError(result.reason)
      setBusy(false)
      return
    }

    // A new account may need email confirmation before it has a session.
    const current = await getCurrentSession()
    if (!current) {
      setNotice('Account created. Check your email to confirm it, then sign in.')
      setMode('signIn')
      setBusy(false)
      return
    }

    // events.organiser_id references profiles, so a first-time user needs a row before
    // they can file anything. See the note on ensureOrganiserProfile: in production this
    // belongs to an administrator, not to the user signing themselves up.
    const profile = await ensureOrganiserProfile(current)
    if (!profile.ok) {
      setFormError(profile.reason)
      setBusy(false)
      return
    }

    navigate(destination, { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="flex justify-center">
        <BrandMark />
      </div>

      <h1 className="mt-8 text-center text-2xl font-bold tracking-tight text-slate-900">
        {mode === 'signIn' ? 'Sign in to your account' : 'Create your account'}
      </h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        {mode === 'signIn'
          ? 'Manage your event requests and see where each one stands.'
          : 'You will be set up as an event organiser.'}
      </p>

      <form
        onSubmit={submit}
        noValidate
        className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
      >
        {notice && (
          <p
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          >
            {notice}
          </p>
        )}

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          >
            {formError}
          </p>
        )}

        <Field id="email" label="Email" error={messageFor('email')}>
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={Boolean(messageFor('email'))}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field id="password" label="Password" error={messageFor('password')}>
          <TextInput
            id="password"
            type="password"
            // Tells a password manager whether to offer a saved password or a new one.
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            aria-invalid={Boolean(messageFor('password'))}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-slate-600">
          {mode === 'signIn' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn')
              setIssues([])
              setFormError(null)
            }}
            className="font-medium text-indigo-700 underline-offset-4 hover:underline"
          >
            {mode === 'signIn' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        <Link to="/" className="hover:text-slate-900 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  )
}
