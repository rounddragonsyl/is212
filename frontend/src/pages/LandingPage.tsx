import { LandingCta } from './landing/LandingCta'
import { LandingHero } from './landing/LandingHero'
import { LandingValue } from './landing/LandingValue'
import { LandingWorkflow } from './landing/LandingWorkflow'

/**
 * The marketing page. Served at /welcome as well as at / for signed-out visitors, so it
 * can be reviewed and worked on without signing out of a session first.
 */
export function LandingPage() {
  return (
    <>
      <LandingHero />
      <LandingValue />
      <LandingWorkflow />
      <LandingCta />
    </>
  )
}
