// ============================================================================
// Workspaces + Node Types API
// ----------------------------------------------------------------------------
// Thin wrapper around Supabase for workspaces and the user-scoped node_types.
// Card types belong to the USER (cross-workspace), not the individual
// workspace.
//
// "Workspace" is the foundational architectural name for the top-level
// bounded container — replacing the prior "campaign" terminology that was
// carried over from the product's D&D-first audience. User-facing copy that
// references "campaign" survives only where the language is genuinely
// domain-flavored (placeholder examples, etc.); see ADR-0012.
//
// Single source of truth for the five built-in types lives here as
// BUILT_IN_TYPES. useTypeStore hydrates from the DB on app load. (When
// ADR-0008 ships, BUILT_IN_TYPES moves to src/lib/cardTypes.js; it lives
// here today because that refactor hasn't landed yet.)
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'

// The five built-in card types, seeded once per user via ensureBuiltinTypes.
export const BUILT_IN_TYPES = [
  { key: 'character', label: 'Character', color: '#7C3AED', icon_name: 'UserCircle', sort_order: 0 },
  { key: 'location',  label: 'Location',  color: '#16A34A', icon_name: 'MapPin',     sort_order: 1 },
  { key: 'item',      label: 'Item',      color: '#EA580C', icon_name: 'Backpack',   sort_order: 2 },
  { key: 'faction',   label: 'Faction',   color: '#2563EB', icon_name: 'ShieldCheckered', sort_order: 3 },
  { key: 'story',     label: 'Story',     color: '#9CA3AF', icon_name: 'BookOpen',   sort_order: 4 },
]

// ----------------------------------------------------------------------------
// List all workspaces owned by the current user, most recently updated first.
// ----------------------------------------------------------------------------
export async function listWorkspaces() {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

// ----------------------------------------------------------------------------
// Create a workspace. Types are NOT seeded here — they live at the user
// level and are guaranteed by ensureBuiltinTypes() on app load.
// ----------------------------------------------------------------------------
export async function createWorkspace(name, description = null) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const trimmed = (name ?? '').trim()
  if (!trimmed) throw new Error('Workspace name is required')

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({ owner_id: user.id, name: trimmed, description })
    .select()
    .single()
  if (error) throw error

  return { workspace }
}

// ----------------------------------------------------------------------------
// Fetch a single workspace by id (RLS scopes to the current user).
// ----------------------------------------------------------------------------
export async function getWorkspace(id) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// ----------------------------------------------------------------------------
// List all node types for the current user (built-in + custom).
// Returned in sort_order so the UI can render the picker consistently.
// ----------------------------------------------------------------------------
export async function listNodeTypes() {
  const { data, error } = await supabase
    .from('node_types')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}

// ----------------------------------------------------------------------------
// Make sure the current user has all five built-in types. Idempotent: insert
// only the keys they're missing. Safe to call on every app load.
// ----------------------------------------------------------------------------
export async function ensureBuiltinTypes() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const existing = await listNodeTypes()
  const haveKeys = new Set(existing.map((t) => t.key))
  const missing = BUILT_IN_TYPES.filter((t) => !haveKeys.has(t.key))
  if (missing.length === 0) return existing

  const rows = missing.map((t) => ({
    ...t,
    owner_id: user.id,
    is_system: true,
  }))
  const { data: inserted, error } = await supabase
    .from('node_types')
    .insert(rows)
    .select()
  if (error) throw error

  return [...existing, ...inserted].sort((a, b) => a.sort_order - b.sort_order)
}

// ----------------------------------------------------------------------------
// Create a custom (user-defined) node type. Returns the new row.
// Wrapped in persistWrite so the sync indicator/lock react to failures.
// ----------------------------------------------------------------------------
export async function createCustomType({ key, label, color, iconName, sortOrder = 100 }) {
  return persistWrite(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    const { data, error } = await supabase
      .from('node_types')
      .insert({
        owner_id: user.id,
        key,
        label,
        color,
        icon_name: iconName,
        is_system: false,
        sort_order: sortOrder,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }, 'your new type')
}

// ----------------------------------------------------------------------------
// Rename a workspace (and/or update its description).
// ----------------------------------------------------------------------------
export async function updateWorkspace(id, patch) {
  return persistWrite(async () => {
    const { data, error } = await supabase
      .from('workspaces')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }, 'this workspace')
}

// ----------------------------------------------------------------------------
// Delete a workspace. Schema has ON DELETE CASCADE so all related rows
// (nodes, node_sections, connections, text_nodes) go with it. Types are
// per-user and survive — they're owned by the user, not the workspace.
// ----------------------------------------------------------------------------
export async function deleteWorkspace(id) {
  return persistWrite(async () => {
    const { error } = await supabase.from('workspaces').delete().eq('id', id)
    if (error) throw error
  }, 'this deletion')
}

// ----------------------------------------------------------------------------
// Returns the most recent edit timestamp across all of this workspace's data,
// or null if the workspace has no rows yet. Used to seed the "Edited Nm ago"
// chip so it reflects real activity on initial load (not just in-session
// saves). Connections only have created_at; their delete events leave no
// timestamp behind, which is an accepted accuracy gap for V1.
// ----------------------------------------------------------------------------
export async function getWorkspaceLastEditedAt(workspaceId) {
  const [nodesRes, sectionsRes, connectionsRes, textNodesRes] = await Promise.all([
    supabase.from('nodes')
      .select('updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('node_sections')
      .select('updated_at, node:nodes!inner(workspace_id)')
      .eq('node.workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('connections')
      .select('created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('text_nodes')
      .select('updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const candidates = [
    nodesRes.data?.updated_at,
    sectionsRes.data?.updated_at,
    connectionsRes.data?.created_at,
    textNodesRes.data?.updated_at,
  ].filter(Boolean)

  if (candidates.length === 0) return null
  const latest = candidates.reduce((max, ts) => (ts > max ? ts : max))
  return new Date(latest)
}
