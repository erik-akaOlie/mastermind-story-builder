import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import 'reactflow/dist/style.css'  // third-party first — our styles override below
import './index.css'
import App from './App.jsx'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import { WorkspaceProvider, useWorkspace } from './lib/WorkspaceContext.jsx'
import { ProfileProvider } from './lib/ProfileContext.jsx'
import { useOnlineListener, useProbeLoop } from './lib/useSyncLifecycle.js'
import Login from './components/Login.jsx'
import CampaignPicker from './components/CampaignPicker.jsx'
import UserMenu from './components/UserMenu.jsx'
import SearchBar from './components/SearchBar.jsx'
import LockOverlay from './components/LockOverlay.jsx'
import FeedbackChipBar from './components/FeedbackChipBar.jsx'
import MigrateImages from './components/MigrateImages.jsx'
import Profile from './components/Profile.jsx'
import AnalyticsBootstrap from './components/AnalyticsBootstrap.jsx'
import TermsOfServicePage from './components/TermsOfServicePage.jsx'
import PrivacyPolicyPage from './components/PrivacyPolicyPage.jsx'
import SpikeIndex from './spike/SpikeIndex.jsx'  // SPIKE-ONLY — remove with src/spike/

// Tiny hash-based router. We don't need React Router for one ad-hoc page;
// the `#migrate` route is temporary and gets removed once Phase 5 lands.
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

// ============================================================================
// Root gatekeeper
// ----------------------------------------------------------------------------
// Decides what the user sees based on auth + campaign state:
//   - loading          : render nothing (prevents a flash of the login screen
//                        while Supabase hydrates any stored session)
//   - not signed in    : show the Login screen
//   - no active campaign : show the CampaignPicker
//   - has active campaign: render the main App, with a floating UserMenu
// ============================================================================
function Root() {
  const { session, loading } = useAuth()
  const { activeWorkspaceId } = useWorkspace()
  const hash = useHashRoute()

  // Keep the sync store in sync with navigator.onLine and probe while locked.
  // These are no-ops until a write fails or the network drops.
  useOnlineListener()
  useProbeLoop()

  // SPIKE-ONLY — auth-independent so it renders even if Supabase is slow/offline.
  // Remove with src/spike/.
  if (hash === '#editor-spike') return <SpikeIndex />

  if (loading) return null
  // Pre-auth routes — accessible without signing in so a prospective user can
  // read the legal documents before deciding to create an account.
  if (hash === '#terms')   return <TermsOfServicePage />
  if (hash === '#privacy') return <PrivacyPolicyPage />
  if (!session) return <Login />
  if (hash === '#migrate') return <MigrateImages />
  if (hash === '#profile') return <Profile />
  if (!activeWorkspaceId) return <CampaignPicker />

  return (
    <>
      <App />
      <UserMenu />
      <SearchBar />
      <FeedbackChipBar />
      <LockOverlay />
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <WorkspaceProvider>
        <ProfileProvider>
          <AnalyticsBootstrap />
          <Root />
        </ProfileProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </StrictMode>,
)
