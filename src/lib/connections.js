// ============================================================================
// Connections API
// ----------------------------------------------------------------------------
// Supabase CRUD for edges between nodes. Relationship-type labels are not
// wired yet (Sprint 4); for now each connection is just a source→target link.
// ============================================================================

import { supabase } from './supabase.js'

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
// ----------------------------------------------------------------------------
export async function createConnection({ campaignId, sourceNodeId, targetNodeId }) {
  const { data, error } = await supabase
    .from('connections')
    .insert({
      campaign_id:    campaignId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
    })
    .select()
    .single()
  if (error) throw error

  return {
    id:     data.id,
    source: data.source_node_id,
    target: data.target_node_id,
    type:   'floating',
  }
}

// ----------------------------------------------------------------------------
// Delete a connection by its id.
// ----------------------------------------------------------------------------
export async function deleteConnection(id) {
  const { error } = await supabase.from('connections').delete().eq('id', id)
  if (error) throw error
}
