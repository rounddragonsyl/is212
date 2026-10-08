import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { USER_ROLE_LABELS } from '../features/auth/types'
import type { UserProfile } from '../features/auth/types'
import { listEventRequests } from '../features/events/eventReviewService'
import { StatusBadge } from '../features/events/components/StatusBadge'
import { formatDateTime, orDash } from '../features/events/formatters'
import { useRequestResource } from '../features/events/status/useRequestResource'

const primaryButton =
  'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm ' +
  'font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'

/**
 * A landing page that answers "what should I do now?" for the person looking at it, rather
 * than describing the product to someone who has already signed in.
 */
export function SignedInHome({ profile }: { profile: UserProfile }) {
  const read = useCallback(async () => {
    // Attendees cannot read event requests (RLS returns none), so do not ask.
    if (profile.role === 'attendee') return { ok: true as const, value: [] }
    const result = await listEventRequests(profile.role === 'organiser')
    return result.ok ? { ok: true as const, value: result.requests } : result
  }, [profile.role])
  const { value: requests, error, refresh } = useRequestResource(
    `${profile.id}:${profile.role}`, read,
  )

  const isCoordinator = profile.role === 'coordinator'
  const isOrganiser = profile.role === 'organiser'
  const isManager = profile.role === 'operations_manager'
  const isLead = profile.role === 'coordinator_lead'
  const isAttendee = profile.role === 'attendee'
  const canViewRequests = isOrganiser || isCoordinator || isManager
  const awaiting = requests?.filter((request) => request.status === 'submitted') ?? []
  const recent = requests?.slice(0, 3) ?? []

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Welcome back, {profile.fullName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as {USER_ROLE_LABELS[profile.role]}.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          {isLead && (
            <Link to="/requests" className={primaryButton}>View coordinator assignments</Link>
          )}
          {isAttendee && (
            <Link to="/events/open" className={primaryButton}>Browse events</Link>
          )}
          {isAttendee && (
            <Link to="/registrations" className="text-sm font-medium text-indigo-700 hover:underline">
              My registrations
            </Link>
          )}
          {isOrganiser && (
            <Link to="/events/new" className={primaryButton}>
              Start a new request
            </Link>
          )}
          {isOrganiser && (
            <Link to="/drafts" className="text-sm font-medium text-indigo-700 hover:underline">
              My Drafts
            </Link>
          )}
          {isCoordinator && (
            <Link to="/requests" className={primaryButton}>
              {awaiting.length > 0
                ? `Review ${awaiting.length} new ${awaiting.length === 1 ? 'request' : 'requests'}`
                : 'View all requests'}
            </Link>
          )}
          {canViewRequests && (
            <Link
              to="/requests"
              className="text-sm font-medium text-indigo-700 underline-offset-4 hover:underline"
            >
              {isOrganiser ? 'See my requests' : 'See all requests'}
            </Link>
          )}
        </div>

        {/* Attendees act on events, not on requests: this message predates them (US29 defect,
            8 October 2026), so they get their own guidance. */}
        {isAttendee && (
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-slate-600">
            Find events that are open for registration and sign up for the ones you want to attend.
          </p>
        )}

        {!canViewRequests && !isLead && !isAttendee && (
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-slate-600">
            There is nothing for you to action here right now. Your coordinator will be in
            touch when an event needs you.
          </p>
        )}
      </section>

      {canViewRequests && (
        <section aria-labelledby="recent-heading" className="border-t border-slate-200 pt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="recent-heading" className="text-lg font-semibold text-slate-900">
              {isOrganiser ? 'Your recent requests' : 'Latest requests'}
            </h2>
            <Link
              to="/requests"
              className="text-sm font-medium text-indigo-700 underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </div>

          {error ? (
            <div role="alert" className="mt-6 text-sm text-red-700">
              {error} <button type="button" onClick={refresh} className="underline">Try again</button>
            </div>
          ) : requests === null ? (
            <p className="mt-6 text-sm text-slate-500">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-slate-600">
              {isCoordinator || isManager
                ? 'No requests have come in yet. They will appear here as soon as an organiser submits one.'
                : 'You have not submitted a request yet. Starting one takes about two minutes.'}
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {recent.map((request) => (
                <li key={request.id}>
                  <Link
                    to={`/requests/${request.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4
                      transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {orDash(request.name ?? request.purpose)}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {orDash(request.reference)} · {formatDateTime(request.proposedStart)}
                      </span>
                    </span>
                    <StatusBadge status={request.status} organiserView={isOrganiser} reviewNote={request.reviewNote} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
