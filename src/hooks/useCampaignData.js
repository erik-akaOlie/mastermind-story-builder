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
//   - No echo filter. A self-write round-trips through the channel and
//     re-sets identical values; this is accepted for V1.
//   - node_sections has no campaign_id column, so it can't be DB-filtered
//     by campaign. RLS already restricts events to the user's own rows;
//     handlers additionally drop events whose node_id isn't in local state.
// ============================================================================

import { useEffect, useState } from 'react'
import { useTypeStore } from '../store/useTypeStore'
import { ensureBuiltinTypes } from '../lib/campaigns.js'
import { loadNodes, dbNodeToReactFlow } from '../lib/nodes.js'
import { loadConnections } from '../lib/connections.js'
import { loadTextNodes, dbTextNodeToReactFlow } from '../lib/textNodes.js'
import { supabase } from '../lib/supabase.js'

const KIND_TO_FIELD = {
  narrative:   'storyNotes',
  hidden_lore: 'hiddenLore',
  dm_notes:    'dmNotes',
  media:       'media',
}

export function useCampaignData({ campaignId, setNodes, setEdges }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    let channel = null

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

        const [campaignNodes, campaignConnections, campaignTextNodes] = await Promise.all([
          loadNodes(campaignId, keyById),
          loadConnections(campaignId),
          loadTextNodes(campaignId),
        ])

        if (cancelled) return

        setNodes([...campaignNodes, ...campaignTextNodes])
        setEdges(campaignConnections)

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
    }
  }, [campaignId, setNodes, setEdges])

  return { loading, loadError }
}

// ============================================================================
// Realtime subscription wiring
// ----------------------------------------------------------------------------
// One channel per campaign with four postgres_changes listeners. Each handler
// translates a DB event back into the React/React Flow shape used on the canvas.
// ============================================================================
function subscribeRealtime({ campaignId, keyById, setNodes, setEdges }) {
  const channel = supabase.channel(`campaign:${campaignId}`)

  // --- nodes -----------------------------------------------------------------
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'nodes', filter: `campaign_id=eq.${campaignId}` },
    (payload) => {
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
            return {
              ...n,
              position: { x: Number(row.position_x), y: Number(row.position_y) },
              data: {
                ...n.data,
                label:   row.label,
                summary: row.summary,
                avatar:  row.avatar_url,
                type:    typeInfo?.key ?? n.data.type,
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

      setNodes((nds) => {
        const idx = nds.findIndex((n) => n.id === nodeId)
        if (idx === -1) return nds
        const next = nds.slice()
        const prev = next[idx]
        const value = (eventType === 'DELETE') ? [] : (row.content ?? [])
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
          eds.map((e) =>
            e.id === row.id
              ? { ...e, source: row.source_node_id, target: row.target_node_id }
              : e
          )
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
            return { ...fresh, data: { ...fresh.data, editing: n.data?.editing ?? false } }
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
