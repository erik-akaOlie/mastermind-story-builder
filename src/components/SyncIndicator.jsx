// ============================================================================
// SyncIndicator
// ----------------------------------------------------------------------------
// Notion-style text indicator styled as a bottom-left chip so it stays
// readable when cards scroll behind it. Reports the current persistence state
// in plain English and updates the "Edited Nm ago" relative time every 60s.
//
// lastSavedAt is seeded from the campaign's most recent updated_at on load
// (see useCampaignData → getCampaignLastEditedAt) and bumps on both local
// saves and Realtime events from other tabs, so the chip reflects real
// activity even on first paint.
//
// States (priority order):
//   Offline     — "Offline"
//   Locked      — "Can't save"
//   Saved       — "Edited just now" / "Edited 1m ago" / …
//   Initial     — (renders nothing only for a brand-new campaign with no
//                  rows yet, since lastSavedAt would still be null)
// ============================================================================

import { useEffect, useState } from 'react'
import { useSyncStore, selectLocked } from '../store/useSyncStore.js'

const TICK_INTERVAL_MS = 60_000

export default function SyncIndicator() {
  const isOffline = useSyncStore((s) => s.isOffline)
  const locked = useSyncStore(selectLocked)
  const lastSavedAt = useSyncStore((s) => s.lastSavedAt)

  // Force re-render every minute so the relative time stays current.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const display = getDisplay({ isOffline, locked, lastSavedAt })
  if (!display) return null

  return (
    <div
      className="fixed bottom-4 left-4 z-40 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm border border-gray-200 text-xs text-gray-500 select-none"
      title={display.tooltip}
    >
      {display.text}
    </div>
  )
}

function getDisplay({ isOffline, locked, lastSavedAt }) {
  if (isOffline) {
    return {
      text: 'Offline',
      tooltip: "You're offline. Reconnect to continue editing.",
    }
  }
  if (locked) {
    return {
      text: "Can't save",
      tooltip: "Recent changes may not be saved. We're retrying in the background.",
    }
  }
  if (lastSavedAt) {
    return {
      text: `Edited ${formatRelative(lastSavedAt)}`,
      tooltip: lastSavedAt.toLocaleString(),
    }
  }
  return null
}

function formatRelative(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 30) return 'just now'
  if (seconds < 90) return '1m ago'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}
