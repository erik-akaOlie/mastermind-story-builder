// ============================================================================
// UserAvatar
// ----------------------------------------------------------------------------
// Circular profile button + dropdown menu. Shows the user's profile image if
// present, otherwise the first letter of their email inside a colored circle.
// Click toggles a dropdown with account context and a Sign out action.
//
// Reusable across the canvas overlay (UserMenu) and the campaign picker.
//
// Keyboard / pointer affordances:
//  - Click avatar to toggle
//  - Click outside or press Escape to close
//  - Hover ring for affordance
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext.jsx'

// Derive the placeholder initial from the user's email.
function initialFor(user) {
  const source = user?.email ?? ''
  const first = source[0]
  return first ? first.toUpperCase() : '?'
}

export default function UserAvatar({ menuAlign = 'right' }) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])

  // Click-outside and Escape to close
  useEffect(() => {
    if (!open) return

    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        close()
      }
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
  }, [open, close])

  if (!user) return null

  const avatarUrl = user.user_metadata?.avatar_url ?? null
  const initial = initialFor(user)

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Account menu for ${user.email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-semibold overflow-hidden shadow-sm ring-1 ring-black/5 hover:ring-2 hover:ring-sky-600/40 transition-shadow"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 text-sm z-50 ${menuAlign === 'left' ? 'left-0' : 'right-0'}`}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-[0.6875rem] uppercase tracking-wide text-gray-500">
              Signed in as
            </div>
            <div className="text-xs text-gray-900 truncate">{user.email}</div>
          </div>

          <button
            role="menuitem"
            onClick={() => {
              close()
              signOut()
            }}
            className="w-full text-left px-3 py-2 flex items-center gap-2 text-gray-700 hover:bg-gray-50"
          >
            <SignOut size={14} weight="bold" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
