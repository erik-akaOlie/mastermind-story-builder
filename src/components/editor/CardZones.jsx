// ============================================================================
// CardZones — the two stacked zone editors for a card (block-editor Phase 2)
// ----------------------------------------------------------------------------
// Loads the migrated card_view / gm_only block JSON for one card and renders a
// ZoneEditor for each, stacked (Card View on top, GM's Eyes Only below). Each
// zone saves independently via saveBlockZones.
//
// Connections are NOT part of the editable document (ADR-0016 revised). They
// render in a FIXED, non-removable panel pinned below the GM zone editor, so the
// user can never delete or move the connections surface. Any stray `connections`
// block from earlier migrated data is stripped on load.
//
// Lazy-loaded by the Inspector so the ~1 MB BlockNote bundle is only fetched
// when a card is actually opened — never in the main app bundle.
// ============================================================================

import { useEffect, useState } from 'react'
import ZoneEditor from './ZoneEditor.jsx'
import ConnectionsView from './ConnectionsBlock.jsx'
import InspectorSectionHeader from '../InspectorSectionHeader.jsx'
import { EditorErrorBoundary } from './EditorErrorBoundary.jsx'
import { loadBlockZones, saveBlockZones, DEFAULT_GM_ZONE } from '../../lib/blockZones.js'
import { dedupeBlockIds } from './blockIds.js'

// Strip any legacy `connections` block — connections live in the fixed panel now.
function stripConnections(blocks) {
  return Array.isArray(blocks) ? blocks.filter((b) => b?.type !== 'connections') : blocks
}

export default function CardZones({ nodeId }) {
  const [zones, setZones] = useState(null) // { card_view, gm_only } | null while loading
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setZones(null)
    setError(null)
    loadBlockZones(nodeId)
      .then((z) => {
        // Self-heal (F5f, Layer 2): regenerate any duplicate block IDs already
        // persisted (from a session before the live plugin existed) so the editor
        // mounts a clean document. dedupeBlockIds returns the SAME reference when
        // there's nothing to fix, so clean cards incur no change. Per-zone, since
        // each zone is its own document. Persists on the user's next edit (lazy).
        if (alive)
          setZones({
            card_view: dedupeBlockIds(z.card_view),
            gm_only: dedupeBlockIds(stripConnections(z.gm_only)),
          })
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
    // `inspector-editor` scopes inspectorEditor.css's BlockNote overrides to the
    // Inspector's editors only — the selectors there are otherwise global `.bn-*`
    // and would restyle any future BlockNote instance elsewhere in the app.
    <div className="inspector-editor flex flex-col gap-8">
      {/* The two zone editors are wrapped in an error boundary so a BlockNote
          render crash shows a readable error here instead of white-screening the
          whole app. The Connection Manager stays outside it (separate concern). */}
      <EditorErrorBoundary>
        {/* ── Card View ── */}
        <section className="flex flex-col gap-4">
          <InspectorSectionHeader label="Card View" />
          <ZoneEditor
            initialContent={zones.card_view}
            onSave={(doc) => saveBlockZones(nodeId, { card_view: doc }).catch(console.error)}
          />
        </section>

        {/* ── GM's Eyes Only ── */}
        <section className="flex flex-col gap-4">
          <InspectorSectionHeader label="GM&rsquo;s Eyes Only" />
          {/* New cards (no gm_only row yet → null) seed the default GM doc:
              H1 "Inspiration" + an empty Media Gallery (F5e). Migrated/edited cards
              use their stored content. Card View is intentionally never seeded. */}
          <ZoneEditor
            initialContent={zones.gm_only ?? DEFAULT_GM_ZONE}
            onSave={(doc) => saveBlockZones(nodeId, { gm_only: doc }).catch(console.error)}
          />
        </section>
      </EditorErrorBoundary>

      {/* ── Connection Manager ── its own section now. Connections live OUTSIDE
          the editable document so they can never be deleted or reordered away;
          reads/deletes still flow through EditorContext (unchanged). */}
      <section className="flex flex-col gap-4">
        <InspectorSectionHeader label="Connection Manager" />
        <ConnectionsView />
      </section>
    </div>
  )
}
