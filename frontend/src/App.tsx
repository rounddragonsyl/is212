import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { SignInPage } from './features/auth/pages/SignInPage'
import { SessionProvider } from './features/auth/SessionProvider'
import { ReviewRequestDetailPage } from './features/events/pages/ReviewRequestDetailPage'
import { ReviewRequestsPage } from './features/events/pages/ReviewRequestsPage'
import { SubmitEventRequestPage } from './features/events/pages/SubmitEventRequestPage'
import { MyDraftsPage } from './features/events/pages/MyDraftsPage'
import { ResumeDraftPage } from './features/events/pages/ResumeDraftPage'
import { HomePage } from './pages/HomePage'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SubmitEventChangesPage } from './features/events/pages/SubmitEventChangesPage'
import { VenueSearchPage } from './features/venues/pages/VenueSearchPage'
import { VenueSuitabilityPage } from './features/venues/pages/VenueSuitabilityPage'
import { EventEquipmentPage } from './features/equipment/pages/EventEquipmentPage'
import { TechSupportEquipmentPage } from './features/equipment/pages/TechSupportEquipmentPage'
import { ReserveEquipmentPage } from './features/equipment/pages/ReserveEquipmentPage'
import { FEATURES } from './lib/features'

/**
 * Routes are declared here rather than scattered across features, so the sitemap is one
 * file. Each feature contributes pages; the route table stays readable as the other 28
 * stories add to it.
 */
export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            {/* The landing page at a fixed URL, so it can be reviewed without signing out. */}
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/events/new" element={<SubmitEventRequestPage />} />
            <Route path="/drafts" element={<MyDraftsPage />} />
            <Route path="/drafts/:id" element={<ResumeDraftPage />} />
            {/* One route for both roles: RLS decides whether it lists everyone's requests
                or only your own, so there is no privileged route to protect. */}
            <Route path="/requests" element={<ReviewRequestsPage />} />
            <Route path="/requests/:id" element={<ReviewRequestDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
            <Route path="/requests/:id/request-change" element={<SubmitEventChangesPage />} />
            <Route path="/venues/search" element={<VenueSearchPage />} />
            {FEATURES.venueSuitability && <Route path="/venues/suitability" element={<VenueSuitabilityPage />} />}
            <Route path="/requests/:id/equipment" element={<EventEquipmentPage />} />
            <Route path="/equipment" element={<TechSupportEquipmentPage />} />
            <Route path="/equipment/reservations" element={<ReserveEquipmentPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}