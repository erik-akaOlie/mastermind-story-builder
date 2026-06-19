// ============================================================================
// UserMenu
// ----------------------------------------------------------------------------
// Top-LEFT canvas overlay that serves as identity + location anchor:
//   - Profile avatar (with dropdown for sign out)
//   - Breadcrumb chip that collapses to a house icon by default and expands
//     on hover to reveal "Home / <current workspace>" + a dropdown
//     chevron. "Home" is the navigation destination (the picker screen), not
//     a label for the data model — see ADR-0012. The chevron opens a menu
//     of all workspaces the user owns so they can jump directly between
//     them without going back to the picker.
//
// The sync-status indicator is intentionally NOT rendered here — it lives in
// its own bottom-left chip so persistent system state doesn't collide with
// navigation UI.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { CaretDown, Check, House } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext.jsx'
import { useWorkspace } from '../lib/WorkspaceContext.jsx'
import { listWorkspaces } from '../lib/workspaces.js'
import UserAvatar from './UserAvatar.jsx'
import HoverReveal from './HoverReveal.jsx'
import WorkspaceThumbnail from './WorkspaceThumbnail.jsx'

export default function UserMenu() {
  const { user } = useAuth()
  const { activeWorkspace, activeWorkspaceId, leaveWorkspace } = useWorkspace()

  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState(null) // null = not yet fetched
  const wrapperRef = useRef(null)

  const close = useCallback(() => setMenuOpen(false), [])

  // Fetch the workspace list on first menu open; refresh every subsequent open
  // so new/renamed/deleted workspaces show up without a page reload.
  useEffect(() => {
    if (!menuOpen) return
    let cancelled = false
    listWorkspaces()
      .then((rows) => { if (!cancelled) setWorkspaces(rows) })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to list workspaces', err)
          setWorkspaces([])
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

  const handlePickWorkspace = (id) => {
    if (id !== activeWorkspaceId) leaveWorkspace(id) // capture snapshot of the one we're leaving
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
        <div className="flex items-center bg-white/90 backdrop-blur rounded-full shadow-sm border border-gray-200 text-xs overflow-hidden">
          {/* Always-visible house: clicking it goes back to the picker. Equal
              padding so it forms a proper circle centered on the icon; the
              "Home" label reveals beside it on hover (its own left padding
              supplies the gap, so a collapsed/zero-width reveal adds zero
              width and the circle stays a circle). */}
          <button
            onClick={() => leaveWorkspace(null)}
            className="flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors whitespace-nowrap p-1.5"
            title="Home"
            aria-label="Go to home"
          >
            <House size={14} weight="bold" />
            <HoverReveal open={expanded}>
              <span className="pl-1 whitespace-nowrap">Home</span>
            </HoverReveal>
          </button>

          {/* Slash + current name + chevron. Stays mounted (so the hover morph
              has something to interpolate) and clips to zero width when
              collapsed via HoverReveal. */}
          {activeWorkspace && (
            <HoverReveal open={expanded}>
              <div className="flex items-center gap-1.5 pl-1 pr-3 whitespace-nowrap">
                <span className="text-gray-300" aria-hidden="true">/</span>
                <span className="text-gray-900 font-medium truncate max-w-[16rem]">
                  {activeWorkspace.name}
                </span>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="text-gray-400 hover:text-gray-900 transition-colors p-0.5"
                  aria-label="Switch workspace"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  tabIndex={expanded ? 0 : -1}
                >
                  <CaretDown size={12} weight="bold" />
                </button>
              </div>
            </HoverReveal>
          )}
        </div>

        {menuOpen && (
          <div
            role="menu"
            className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-1 text-sm z-50"
          >
            <div className="px-3 py-1.5 text-[0.6875rem] uppercase tracking-wide text-gray-500 border-b border-gray-100">
              Switch workspace
            </div>

            {workspaces === null ? (
              <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
            ) : workspaces.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No other workspaces.</div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {workspaces.map((c) => {
                  const isActive = c.id === activeWorkspaceId
                  return (
                    <button
                      key={c.id}
                      role="menuitem"
                      onClick={() => handlePickWorkspace(c.id)}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 ${
                        isActive ? 'bg-sky-50 text-sky-900' : 'text-gray-800'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <WorkspaceThumbnail
                          workspace={c}
                          variant="thumb"
                          className="w-10 h-10 rounded-full flex-shrink-0 ring-1 ring-black/5"
                        />
                        <span className="truncate">{c.name}</span>
                      </span>
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
