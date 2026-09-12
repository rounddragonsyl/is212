import { PageContainer } from '../components/layout/PageContainer'
import { useCurrentUser } from '../features/auth/sessionContext'
import { LandingPage } from './LandingPage'
import { SignedInHome } from './SignedInHome'

export function HomePage() {
  const { session, profile, loading } = useCurrentUser()

  if (loading) {
    return (
      <PageContainer>
        <p className="text-sm text-slate-500">Loading…</p>
      </PageContainer>
    )
  }

  // Someone signed in has a job to do, not a product to be sold. They get the dashboard;
  // the landing page is for visitors who have not signed in yet. It also lives at /welcome
  // for anyone who wants to see it while signed in.
  if (session && profile) {
    return (
      <PageContainer>
        <SignedInHome profile={profile} />
      </PageContainer>
    )
  }

  return <LandingPage />
}
