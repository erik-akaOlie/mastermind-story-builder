// ============================================================================
// CardZones — the two stacked zone editors for a card (block-editor Phase 2)
// ----------------------------------------------------------------------------
// Loads the migrated card_view / gm_only block JSON for one card and renders a
// ZoneEditor for each, stacked (Card View on top, GM's Eyes Only below), per
// the confirmed layout. Each zone saves independently via saveBlockZones.
//
// Lazy-loaded by the Inspector so the ~1 MB BlockNote bundle is only fetched
// when a card is actually opened — never in the main app bundle.
// ============================================================================

import { useEffect, useState } from 'react'
import ZoneEditor from './ZoneEditor.jsx'
import SectionLabel from '../SectionLabel.jsx'
import { loadBlockZones, saveBlockZones } from '../../lib/blockZones.js'

export default function CardZones({ nodeId }) {
  const [zones, setZones] = useState(null) // { card_view, gm_only } | null while loading
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setZones(null)
    setError(null)
    loadBlockZones(nodeId)
      .then((z) => {
        if (alive) setZones(z)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [nodeId])

  if (error) {
    return <div className="text-sm text-red-600">Couldn&rsquo;t load card content: {error}</div>
  }
  if (!zones) {
    return <div className="text-sm text-gray-400">Loading editor…</div>
  }

  return (
    <div className="flex flex-col gap-8">
      <Zone label="Card View" content={zones.card_view} kind="card_view" nodeId={nodeId} />
      <Zone label="GM's Eyes Only" content={zones.gm_only} kind="gm_only" nodeId={nodeId} />
    </div>
  )
}

function Zone({ label, content, kind, nodeId }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <div className="rounded-[0.25rem] border border-[#d1d5db] bg-white">
        <ZoneEditor
          initialContent={content}
          onSave={(doc) => saveBlockZones(nodeId, { [kind]: doc }).catch(console.error)}
        />
      </div>
    </div>
  )
}
