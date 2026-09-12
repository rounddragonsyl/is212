import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { USER_ROLE_LABELS } from '../../auth/types'
import type { UserProfile } from '../../auth/types'
import { EventRequestForm } from '../components/EventRequestForm'
import { SubmissionGuidance } from '../components/SubmissionGuidance'

/** US-005. The page is a shell: the form owns submission, the service owns persistence. */
export function SubmitEventRequestPage() {
  const { session, profile, loading } = useCurrentUser()

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500">
        <Link to="/" className="hover:text-slate-900 hover:underline">
          Home
        </Link>
        <span aria-hidden="true" className="mx-2">
          /
        </span>
        <span className="text-slate-700">Submit an event request</span>
      </nav>

      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Event organiser
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Submit an event request
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Tell us what you are planning. A coordinator reviews every request and comes back to
          you with a venue, a date and the arrangements you asked for.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Checking your session…</p>
      ) : !session ? (
        // Showing the form to a signed-out user would be a trap: RLS refuses the insert, so
        // they would fill in twelve fields only to be told at the end that they cannot submit.
        <SignedOutNotice />
      ) : !profile ? (
        <Card title="No organiser profile">
          <p className="text-sm text-slate-600">
            You are signed in, but no profile row exists for your account, so there is nothing
            to file a request against. Sign out and back in, or ask a coordinator to create
            your profile.
          </p>
        </Card>
      ) : profile.role !== 'organiser' ? (
        <WrongRoleNotice profile={profile} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card title="Event request" description="Fields marked with an asterisk are required.">
            <EventRequestForm />
          </Card>
          <SubmissionGuidance />
        </div>
      )}
    </PageContainer>
  )
}

function SignedOutNotice() {
  return (
    <Card title="Sign in to continue">
      <p className="text-sm text-slate-600">
        You need to be signed in as an event organiser to submit a request.
      </p>
      {/* `from` so signing in returns them here, rather than dropping them on the home
          page to find their way back. */}
      <Link
        to="/signin"
        state={{ from: '/events/new' }}
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5
          py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
      >
        Sign in
      </Link>
    </Card>
  )
}

/**
 * US-005 belongs to the organiser. Hiding the form from other roles is a courtesy, not the
 * control — the events_insert_own policy is what actually stops a non-organiser filing a
 * request, and it holds even if this component is bypassed entirely.
 */
function WrongRoleNotice({ profile }: { profile: UserProfile }) {
  return (
    <Card title="Not available for your role">
      <p className="text-sm text-slate-600">
        You are signed in as <strong>{USER_ROLE_LABELS[profile.role]}</strong>. Event requests
        are submitted by the organiser running the event.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        If you need to raise one yourself, ask your coordinator to set you up as an organiser.
      </p>
    </Card>
  )
}
