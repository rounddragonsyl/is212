import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Field, TextInput } from '../../../components/ui/FormControls'
import { AuthPageShell } from '../components/AuthPageShell'
import { signIn } from '../authService'
import { useCurrentUser } from '../sessionContext'
import { validateCredentials } from '../validation'
import type { CredentialIssue } from '../validation'

interface LocationState {
  from?: string
}

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useCurrentUser()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [issues, setIssues] = useState<CredentialIssue[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Send people back where they were headed, not to a generic landing page.
  const destination = (location.state as LocationState | null)?.from ?? '/'

  if (!loading && session) return <Navigate to={destination} replace />

  const messageFor = (field: CredentialIssue['field']) =>
    issues.find((issue) => issue.field === field)?.message

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const validation = validateCredentials({ email, password })
    if (!validation.ok) {
      setIssues(validation.issues)
      return
    }
    setIssues([])
    setBusy(true)

    const result = await signIn(validation.email, validation.password)
    if (!result.ok) {
      setFormError(result.reason)
      setBusy(false)
      return
    }

    // No profile work here: handle_new_user (0005, replaced by 0042) created the row with the
    // account, so it already existed when signIn told SessionProvider to look it up.
    navigate(destination, { replace: true })
  }

  return (
    <AuthPageShell
      title="Sign in to your account"
      subtitle="Manage your event requests and see where each one stands."
    >
      <form
        onSubmit={submit}
        noValidate
        className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
      >
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
            autoComplete="current-password"
            aria-invalid={Boolean(messageFor('password'))}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Please wait…' : 'Sign in'}
        </Button>

        {/* Sign-up has its own page (US29). It creates Attendees, so this page no longer
            promises anyone an organiser account. */}
        <p className="text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-indigo-700 underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthPageShell>
  )
}
