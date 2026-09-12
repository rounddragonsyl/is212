import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, TextInput } from '../../../components/ui/FormControls'
import { ensureOrganiserProfile, getCurrentSession, signIn, signUp } from '../authService'

/**
 * DEVELOPMENT SCAFFOLDING — replaced by US-002.
 *
 * Rendered only under import.meta.env.DEV, so it cannot reach a production build. It
 * exists so US-005 can be demonstrated end to end: without a session, RLS correctly
 * refuses every insert and the submit path cannot be exercised at all.
 */
export function DevAuthPanel() {
  const [email, setEmail] = useState('organiser@example.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: 'signIn' | 'signUp') => {
    setBusy(true)
    setError(null)

    const result = action === 'signIn' ? await signIn(email, password) : await signUp(email, password)

    if (!result.ok) {
      setError(result.reason)
      setBusy(false)
      return
    }

    // A brand-new account has no profile row, and events.organiser_id references it.
    const session = await getCurrentSession()
    if (session) {
      const profile = await ensureOrganiserProfile(session)
      if (!profile.ok) setError(profile.reason)
    } else {
      setError('Account created. Confirm the email address, then sign in.')
    }

    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50/60 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
        Development sign-in
      </p>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">Sign in to submit a request</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Temporary sign-in for local development. This panel never appears in a production
        build — see DevAuthPanel.tsx for why it exists.
      </p>

      <div className="mt-5 space-y-4">
        <Field id="dev-email" label="Email">
          <TextInput
            id="dev-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field id="dev-password" label="Password" hint="At least 6 characters.">
          <TextInput
            id="dev-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="button" disabled={busy} onClick={() => run('signIn')}>
            {busy ? 'Working…' : 'Sign in'}
          </Button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run('signUp')}
            className="text-sm font-medium text-indigo-700 underline-offset-4 hover:underline
              disabled:text-slate-400"
          >
            Create a test account
          </button>
        </div>
      </div>
    </div>
  )
}
