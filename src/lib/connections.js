// ============================================================================
// Connections API
// ----------------------------------------------------------------------------
// Supabase CRUD for edges between nodes. Relationship-type labels are not
// wired yet (Sprint 4); for now each connection is just a source→target link.
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'

// ----------------------------------------------------------------------------
// Load all connections for a campaign, shaped as React Flow edges.
// ----------------------------------------------------------------------------
export async function loadConnections(campaignId) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('campaign_id', campaignId)
  if (error) throw error

  return data.map((c) => ({
    id:     c.id,
    source: c.source_node_id,
    target: c.target_node_id,
    type:   'floating',
  }))
}

// ----------------------------------------------------------------------------
// Create a new connection. Returns the React Flow edge.
//
// `id` is optional. Pass it to recreate a connection at a known UUID — used
// by the undo system when redoing addConnection (after the connection was
// removed via undo) or undoing removeConnection. Without `id`, Postgres
// assigns a fresh one.
// ----------------------------------------------------------------------------
export async function createConnection({ id, campaignId, sourceNodeId, targetNodeId }) {
  return persistWrite(async () => {
    const insertRow = {
      campaign_id:    campaignId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
    }
    if (id) insertRow.id = id

    const { data, error } = await supabase
      .from('connections')
      .insert(insertRow)
      .select()
      .single()
    if (error) throw error

    return {
      id:     data.id,
      source: data.source_node_id,
      target: data.target_node_id,
      type:   'floating',
    }
  }, 'this connection')
}

// ----------------------------------------------------------------------------
// Delete a connection by its id.
// ----------------------------------------------------------------------------
export async function deleteConnection(id) {
  return persistWrite(async () => {
    const { error } = await supabase.from('connections').delete().eq('id', id)
    if (error) throw error
  }, 'this deletion')
}
