// ============================================================================
// UserMenu
// ----------------------------------------------------------------------------
// Top-right canvas overlay showing:
//   - "Campaigns" button (back to picker)
//   - Profile avatar with dropdown (email + sign out)
//
// Minimal, fixed-position, non-intrusive over the canvas.
// ============================================================================

import { House } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext.jsx'
import { useCampaign } from '../lib/CampaignContext.jsx'
import UserAvatar from './UserAvatar.jsx'

export default function UserMenu() {
  const { user } = useAuth()
  const { setActiveCampaignId } = useCampaign()
  if (!user) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <button
        onClick={() => setActiveCampaignId(null)}
        className="flex items-center gap-1 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm border border-gray-200 text-xs text-gray-500 hover:text-gray-900 transition-colors"
        title="Back to campaigns"
      >
        <House size={14} weight="bold" />
        Campaigns
      </button>

      <UserAvatar />
    </div>
  )
}
