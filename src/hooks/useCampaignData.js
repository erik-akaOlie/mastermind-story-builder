// ============================================================================
// useCampaignData
// ----------------------------------------------------------------------------
// Owns the load lifecycle for a single campaign's canvas data:
//
//   - ensures the user's built-in node types exist and hydrates the local
//     type store so components reading via useNodeTypes() are current,
//   - loads cards (nodes), edges (connections), and freestanding text nodes
//     in parallel,
//   - hands the results to the canvas via the supplied setNodes / setEdges
//     setters (which come from React Flow's useNodesState / useEdgesState),
//   - subscribes to Supabase Realtime channels for the same campaign and
//     merges incoming INSERT / UPDATE / DELETE events into the same setters
//     so changes from another tab or device reflect here within ~100ms.
//
// Returns { loading, loadError } so the caller can render a loading or error
// screen while the canvas is hydrating.
//
// Realtime notes (Sprint 1.5, V1):
//   - No echo-by-origin filter. A self-write round-trips through the
//     channel and the handler runs. Each UPDATE handler now compares the
//     incoming row against current local state and returns the array
//     unchanged if every field already matches — a true no-op echo causes
//     no re-render. Legitimate remote updates (any value differs) flow
//     through the apply branch unchanged. The guards killed most of the
//     undo/redo visual flicker; some sub-frame stutter remains in chained
//     Ctrl+Z sequences. Cosmetic, not a correctness issue. Tracked as
//     "Undo/redo residual flicker" in BACKLOG.md (Tier 4 polish), with
//     suspected root cause in useEdgeGeometry's render cascade.
//   - node_sections has no campaign_id column, so it can't be DB-filtered
//     by campaign. RLS already restricts events to the user's own rows;
//     handlers additionally drop events whose node_id isn't in local state.
// ============================================================================

import { useEffect, useState } from 'react'
import { useTypeStore } from '../store/useTypeStore'
import { useSyncStore } from '../store/useSyncStore.js'
import { useUndoStore } from '../store/useUndoStore.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { ensureBuiltinTypes, getCampaignLastEditedAt } from '../lib/campaigns.js'
import { loadNodes, dbNodeToReactFlow, normalizeBullets } from '../lib/nodes.js'
import { loadConnections } from '../lib/connections.js'
import { loadTextNodes, dbTextNodeToReactFlow } from '../lib/textNodes.js'
import { supabase } from '../lib/supabase.js'
import { deepEqual } from '../lib/undoActions.js'

const KIND_TO_FIELD = {
  narrative:   'storyNotes',
  hidden_lore: 'hiddenLore',
  dm_notes:    'dmNotes',
  media:       'media',
}

// Bullet kinds use `{id, value}[]` with stable ids (phase 7b). Media stays
// as the legacy mixed shape.
const BULLET_KINDS = new Set(['narrative', 'hidden_lore', 'dm_notes'])

export function useCampaignData({ campaignId, setNodes, setEdges }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    let channel = null

    // Per-campaign undo scope. setScope hydrates from sessionStorage if this
    // tab already has history for (userId × campaignId), otherwise starts
    // empty. Switching campaigns or users automatically swaps the stack.
    useUndoStore.getState().setScope({ userId, campaignId })

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const types = await ensureBuiltinTypes()
        useTypeStore.getState().hydrate(types)

        const keyById = {}
        for (const t of types) {
          keyById[t.id] = { key: t.key, color: t.color, label: t.label, iconName: t.icon_name }
        }

        const [campaignNodes, campaignConnections, campaignTextNodes, lastEditedAt] = await Promise.all([
          loadNodes(campaignId, keyById),
          loadConnections(campaignId),
          loadTextNodes(campaignId),
          getCampaignLastEditedAt(campaignId),
        ])

        if (cancelled) return

        setNodes([...campaignNodes, ...campaignTextNodes])
        setEdges(campaignConnections)
        if (lastEditedAt) useSyncStore.getState().setLastSavedAt(lastEditedAt)

        channel = subscribeRealtime({ campaignId, keyById, setNodes, setEdges })
      } catch (err) {
        if (!cancelled) setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
      // Each campaign owns its own edit history. Clear lastSavedAt on
      // campaign switch / unmount so the chip never carries a previous
      // campaign's timestamp into a new view.
      useSyncStore.getState().setLastSavedAt(null)
    }
  }, [campaignId, userId, setNodes, setEdges])

  return { loading, loadError }
}

// ============================================================================
// Realtime subscription wiring
// ----------------------------------------------------------------------------
// One channel per campaign with four postgres_changes listeners. Each handler
// translates a DB event back into the React/React Flow shape used on the canvas.
// Every incoming event also bumps the sync store's lastSavedAt so the "Edited
// Nm ago" chip reflects activity from other tabs / sessions in real time.
// (Self-writes also bump via writeSucceeded; setLastSavedAt only rolls
// forward, so the double-bump is harmless.)
// ============================================================================
function subscribeRealtime({ campaignId, keyById, setNodes, setEdges }) {
  const channel = supabase.channel(`campaign:${campaignId}`)
  const bumpLastSaved = () => useSyncStore.getState().setLastSavedAt(new Date())

  // --- nodes -----------------------------------------------------------------
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'nodes', filter: `campaign_id=eq.${campaignId}` },
    (payload) => {
      bumpLastSaved()
      const { eventType, new: row, old } = payload
      if (eventType === 'INSERT') {
        setNodes((nds) => {
          if (nds.some((n) => n.id === row.id)) return nds
          return [...nds, dbNodeToReactFlow(row, {}, keyById)]
        })
      } else if (eventType === 'UPDATE') {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== row.id) return n
            const typeInfo = keyById?.[row.type_id]
            const newType  = typeInfo?.key ?? n.data.type
            // No-op echo guard: if every field this handler would write
            // already matches local state, return the node unchanged so
            // React doesn't re-render. Section content lives in a separate
            // table and isn't compared here. Coerce position fields the
            // same way the apply branch does so a string-vs-number diff
            // from Postgres doesn't masquerade as a real change.
            const same =
              n.position.x   === Number(row.position_x) &&
              n.position.y   === Number(row.position_y) &&
              n.data.label   === row.label &&
              n.data.summary === row.summary &&
              n.data.avatar  === row.avatar_url &&
              n.data.type    === newType
            if (same) return n
            return {
              ...n,
              position: { x: Number(row.position_x), y: Number(row.position_y) },
              data: {
                ...n.data,
                label:   row.label,
                summary: row.summary,
                avatar:  row.avatar_url,
                type:    newType,
              },
            }
          })
        )
      } else if (eventType === 'DELETE') {
        setNodes((nds) => nds.filter((n) => n.id !== old.id))
      }
    }
  )

  // --- node_sections ---------------------------------------------------------
  // No DB-side filter (no campaign_id column). RLS scopes to the user; we
  // additionally drop events whose node_id isn't in our local state.
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'node_sections' },
    (payload) => {
      const { eventType, new: row, old } = payload
      const targetRow = row && Object.keys(row).length > 0 ? row : old
      const nodeId = targetRow?.node_id
      const kind   = targetRow?.kind
      const field  = KIND_TO_FIELD[kind]
      if (!nodeId || !field) return
      bumpLastSaved()

      setNodes((nds) => {
        const idx = nds.findIndex((n) => n.id === nodeId)
        if (idx === -1) return nds
        const prev = nds[idx]
        const raw = (eventType === 'DELETE') ? [] : (row.content ?? [])
        // Normalize bullet kinds so the {id, value}[] contract holds even
        // when the broadcasting tab is on legacy code or the DB row is
        // pre-7b. Media doesn't need this — its items already have natural
        // identity (storage path).
        const value = BULLET_KINDS.has(kind) ? normalizeBullets(raw) : raw
        // No-op echo guard: deep-equal against the field's current value.
        // For self-writes the local optimistic state already matches what
        // the DB just confirmed, so the echo is a true no-op and the
        // re-render is unnecessary. Any structural diff (length, value,
        // id, reorder) bypasses the guard and applies normally. Note
        // legacy `string[]` echoes do regenerate ids inside normalizeBullets
        // and so will diff and apply — that's intentional, since we'd
        // rather adopt the structured form than keep a string[] in state.
        if (deepEqual(prev.data?.[field], value)) return nds
        const next = nds.slice()
        next[idx] = { ...prev, data: { ...prev.data, [field]: value } }
        return next
      })
    }
  )

  // --- connections -----------------------------------------------------------
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'connections', filter: `campaign_id=eq.${campaignId}` },
    (payload) => {
      bumpLastSaved()
      const { eventType, new: row, old } = payload
      if (eventType === 'INSERT') {
        setEdges((eds) => {
          if (eds.some((e) => e.id === row.id)) return eds
          return [...eds, {
            id:     row.id,
            source: row.source_node_id,
            target: row.target_node_id,
            type:   'floating',
          }]
        })
      } else if (eventType === 'UPDATE') {
        setEdges((eds) =>
          eds.map((e) => {
            if (e.id !== row.id) return e
            // No-op echo guard. Source / target are the only mutable fields
            // a connection UPDATE can change; if both already match local
            // state, return the edge unchanged so React doesn't re-render
            // and useEdgeGeometry doesn't recompute spread points for nothing.
            if (e.source === row.source_node_id && e.target === row.target_node_id) {
              return e
            }
            return { ...e, source: row.source_node_id, target: row.target_node_id }
          })
        )
      } else if (eventType === 'DELETE') {
        setEdges((eds) => eds.filter((e) => e.id !== old.id))
      }
    }
  )

  // --- text_nodes ------------------------------------------------------------
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'text_nodes', filter: `campaign_id=eq.${campaignId}` },
    (payload) => {
      bumpLastSaved()
      const { eventType, new: row, old } = payload
      if (eventType === 'INSERT') {
        setNodes((nds) => {
          if (nds.some((n) => n.id === row.id)) return nds
          return [...nds, dbTextNodeToReactFlow(row)]
        })
      } else if (eventType === 'UPDATE') {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== row.id) return n
            const fresh = dbTextNodeToReactFlow(row)
            // Preserve UI-only state (e.g., editing) so a remote update
            // doesn't kick this tab out of edit mode mid-keystroke.
            const merged = { ...fresh, data: { ...fresh.data, editing: n.data?.editing ?? false } }
            // No-op echo guard. Compare position + data (with editing
            // already aligned via the merge above) against local state.
            // Any mismatch in any persisted field falls through to apply.
            if (
              n.position?.x === merged.position.x &&
              n.position?.y === merged.position.y &&
              deepEqual(n.data, merged.data)
            ) return n
            return merged
          })
        )
      } else if (eventType === 'DELETE') {
        setNodes((nds) => nds.filter((n) => n.id !== old.id))
      }
    }
  )

  channel.subscribe()
  return channel
}
