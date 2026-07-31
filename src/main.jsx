import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
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
import MigrateBlocks from './components/MigrateBlocks.jsx'
import Profile from './components/Profile.jsx'
import AnalyticsBootstrap from './components/AnalyticsBootstrap.jsx'
import { RootErrorBoundary } from './components/RootErrorBoundary.jsx'
import TermsOfServicePage from './components/TermsOfServicePage.jsx'
import PrivacyPolicyPage from './components/PrivacyPolicyPage.jsx'
import SpikeIndex from './spike/SpikeIndex.jsx'  // SPIKE-ONLY — remove with src/spike/

// DEV-ONLY FTUE design-QA harness (#ftue-preview). import.meta.env.DEV is
// statically `false` in production builds, so this whole definition — and
// the dynamically-imported module behind it — is dead-code-eliminated from
// the shipped bundle (verify: grep dist for FTUE-PREVIEW-HARNESS → absent).
const FtuePreview = import.meta.env.DEV
  ? lazy(() => import('./dev/FtuePreview.jsx'))
  : null

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

  // DEV-ONLY — the FTUE design-QA harness; auth-independent, absent from
  // production builds (see the FtuePreview definition above).
  if (import.meta.env.DEV && hash === '#ftue-preview') {
    return (
      <Suspense fallback={null}>
        <FtuePreview />
      </Suspense>
    )
  }

  // DEV-ONLY — empty-library design-QA harness: the REAL CampaignPicker with
  // the zero-workspace state forced (previewEmpty is honored only in dev
  // builds), so the handwritten guidance + arrow can be inspected at any
  // window size without an empty account. Auth-independent; the create flow
  // itself won't persist here (no session) — this harness is for looking,
  // not creating.
  if (import.meta.env.DEV && hash === '#empty-picker-preview') {
    return <CampaignPicker previewEmpty />
  }

  if (loading) return null
  // Pre-auth routes — accessible without signing in so a prospective user can
  // read the legal documents before deciding to create an account.
  if (hash === '#terms')   return <TermsOfServicePage />
  if (hash === '#privacy') return <PrivacyPolicyPage />
  if (!session) return <Login />
  if (hash === '#migrate') return <MigrateImages />
  if (hash === '#migrate-blocks') return <MigrateBlocks />
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
    <RootErrorBoundary>
      <AuthProvider>
        <WorkspaceProvider>
          <ProfileProvider>
            <AnalyticsBootstrap />
            <Root />
          </ProfileProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
)
