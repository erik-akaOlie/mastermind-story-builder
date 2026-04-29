import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import 'reactflow/dist/style.css'  // third-party first — our styles override below
import './index.css'
import App from './App.jsx'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import { CampaignProvider, useCampaign } from './lib/CampaignContext.jsx'
import { useOnlineListener, useProbeLoop } from './lib/useSyncLifecycle.js'
import Login from './components/Login.jsx'
import CampaignPicker from './components/CampaignPicker.jsx'
import UserMenu from './components/UserMenu.jsx'
import LockOverlay from './components/LockOverlay.jsx'
import SyncIndicator from './components/SyncIndicator.jsx'
import MigrateImages from './components/MigrateImages.jsx'

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
  const { activeCampaignId } = useCampaign()
  const hash = useHashRoute()

  // Keep the sync store in sync with navigator.onLine and probe while locked.
  // These are no-ops until a write fails or the network drops.
  useOnlineListener()
  useProbeLoop()

  if (loading) return null
  if (!session) return <Login />
  if (hash === '#migrate') return <MigrateImages />
  if (!activeCampaignId) return <CampaignPicker />

  return (
    <>
      <App />
      <UserMenu />
      <SyncIndicator />
      <LockOverlay />
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <CampaignProvider>
        <Root />
        <Toaster position="bottom-right" richColors closeButton />
      </CampaignProvider>
    </AuthProvider>
  </StrictMode>,
)
