// ============================================================================
// UserMenu
// ----------------------------------------------------------------------------
// Top-LEFT canvas overlay that serves as identity + location anchor:
//   - Profile avatar (with dropdown for sign out)
//   - Breadcrumb chip that collapses to a house icon by default and expands
//     on hover to reveal "Campaigns / <current campaign>" + a dropdown
//     chevron. The chevron opens a menu of all campaigns the user owns so
//     they can jump directly between campaigns without going back to the
//     picker screen.
//
// The sync-status indicator is intentionally NOT rendered here — it lives in
// its own bottom-left chip so persistent system state doesn't collide with
// navigation UI.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { CaretDown, Check, House } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext.jsx'
import { useCampaign } from '../lib/CampaignContext.jsx'
import { listCampaigns } from '../lib/campaigns.js'
import UserAvatar from './UserAvatar.jsx'

export default function UserMenu() {
  const { user } = useAuth()
  const { activeCampaign, activeCampaignId, setActiveCampaignId } = useCampaign()

  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [campaigns, setCampaigns] = useState(null) // null = not yet fetched
  const wrapperRef = useRef(null)

  const close = useCallback(() => setMenuOpen(false), [])

  // Fetch the campaign list on first menu open; refresh every subsequent open
  // so new/renamed/deleted campaigns show up without a page reload.
  useEffect(() => {
    if (!menuOpen) return
    let cancelled = false
    listCampaigns()
      .then((rows) => { if (!cancelled) setCampaigns(rows) })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to list campaigns', err)
          setCampaigns([])
        }
      })
    return () => { cancelled = true }
  }, [menuOpen])

  // Close the dropdown on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) close()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, close])

  if (!user) return null

  // Expanded when the user is hovering OR the dropdown is pinned open.
  const expanded = hovered || menuOpen

  const handlePickCampaign = (id) => {
    if (id !== activeCampaignId) setActiveCampaignId(id)
    close()
  }

  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
      <UserAvatar menuAlign="left" />

      <div
        ref={wrapperRef}
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex items-center bg-white/90 backdrop-blur rounded-full shadow-sm border border-gray-200 text-xs overflow-hidden transition-all duration-150 ease-out">
          {/* Always-visible house: clicking it goes back to the picker.
              When collapsed the button is equal-padded so it forms a proper
              circle centered on the icon. */}
          <button
            onClick={() => setActiveCampaignId(null)}
            className={`flex items-center justify-center text-gray-500 hover:text-gray-900 transition-all duration-150 ease-out whitespace-nowrap ${
              expanded ? 'px-3 py-1.5 gap-1' : 'p-1.5'
            }`}
            title="Back to campaigns"
            aria-label="Back to campaigns"
          >
            <House size={14} weight="bold" />
            {expanded && <span>Campaigns</span>}
          </button>

          {/* Slash + current name + chevron — only rendered when expanded
              so the collapsed chip has no hidden children contributing width. */}
          {expanded && activeCampaign && (
            <div className="flex items-center gap-1.5 pr-3 whitespace-nowrap">
              <span className="text-gray-300" aria-hidden="true">/</span>
              <span className="text-gray-900 font-medium truncate max-w-[16rem]">
                {activeCampaign.name}
              </span>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="text-gray-400 hover:text-gray-900 transition-colors p-0.5"
                aria-label="Switch campaign"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <CaretDown size={12} weight="bold" />
              </button>
            </div>
          )}
        </div>

        {menuOpen && (
          <div
            role="menu"
            className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 text-sm z-50"
          >
            <div className="px-3 py-1.5 text-[0.6875rem] uppercase tracking-wide text-gray-500 border-b border-gray-100">
              Switch campaign
            </div>

            {campaigns === null ? (
              <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
            ) : campaigns.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No other campaigns.</div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {campaigns.map((c) => {
                  const isActive = c.id === activeCampaignId
                  return (
                    <button
                      key={c.id}
                      role="menuitem"
                      onClick={() => handlePickCampaign(c.id)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-gray-50 ${
                        isActive ? 'bg-sky-50 text-sky-900' : 'text-gray-800'
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {isActive && <Check size={14} weight="bold" className="text-sky-600 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
