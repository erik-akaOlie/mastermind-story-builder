// ============================================================================
// Connections API
// ----------------------------------------------------------------------------
// Supabase CRUD for edges between nodes. Relationship-type labels are not
// wired yet (Sprint 4); for now each connection is just a source→target link.
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'

// ----------------------------------------------------------------------------
// Load all connections for a workspace, shaped as React Flow edges.
// ----------------------------------------------------------------------------
export async function loadConnections(workspaceId) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('workspace_id', workspaceId)
  if (error) throw error

  return data.map((c) => ({
    id:     c.id,
    source: c.source_node_id,
    target: c.target_node_id,
    type:   'floating',
  }))
}

// ----------------------------------------------------------------------------
// Create a new connection. Returns the React Flow edge, or NULL when the two
// nodes are already connected.
//
// `id` is optional. Pass it to recreate a connection at a known UUID — used
// by the undo system when redoing addConnection (after the connection was
// removed via undo) or undoing removeConnection. Without `id`, Postgres
// assigns a fresh one.
//
// One-line-per-pair invariant (migration 009): the DB has a unique index on
// the unordered (source, target) pair. An insert that violates it (Postgres
// error 23505) means the desired end state — "these two cards are connected"
// — already holds, so it's treated as a benign no-op rather than an error.
// Returning early (instead of throwing) keeps persistWrite from retrying a
// write that can never succeed and from raising the save-failure overlay.
// ----------------------------------------------------------------------------
export async function createConnection({ id, workspaceId, sourceNodeId, targetNodeId }) {
  return persistWrite(async () => {
    const insertRow = {
      workspace_id:    workspaceId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
    }
    if (id) insertRow.id = id

    const { data, error } = await supabase
      .from('connections')
      .insert(insertRow)
      .select()
      .single()
    if (error) {
      if (error.code === '23505') return null   // pair already connected
      throw error
    }

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
