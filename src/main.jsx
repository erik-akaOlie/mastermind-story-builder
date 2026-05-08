import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'reactflow/dist/style.css'  // third-party first — our styles override below
import './index.css'
import App from './App.jsx'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import { CampaignProvider, useCampaign } from './lib/CampaignContext.jsx'
import Login from './components/Login.jsx'
import CampaignPicker from './components/CampaignPicker.jsx'
import UserMenu from './components/UserMenu.jsx'

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

  if (loading) return null
  if (!session) return <Login />
  if (!activeCampaignId) return <CampaignPicker />

  return (
    <>
      <App />
      <UserMenu />
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <CampaignProvider>
        <Root />
      </CampaignProvider>
    </AuthProvider>
  </StrictMode>,
)
