// ============================================================================
// Campaigns + Node Types API
// ----------------------------------------------------------------------------
// Thin wrapper around Supabase for campaigns and the user-scoped node_types.
// Card types belong to the USER (cross-campaign), not the individual campaign.
//
// Single source of truth for the five built-in types lives here as
// BUILT_IN_TYPES. useTypeStore hydrates from the DB on app load.
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'

// The five built-in card types, seeded once per user via ensureBuiltinTypes.
export const BUILT_IN_TYPES = [
  { key: 'character', label: 'Character', color: '#7C3AED', icon_name: 'UserCircle', sort_order: 0 },
  { key: 'location',  label: 'Location',  color: '#16A34A', icon_name: 'MapPin',     sort_order: 1 },
  { key: 'item',      label: 'Item',      color: '#EA580C', icon_name: 'Backpack',   sort_order: 2 },
  { key: 'faction',   label: 'Faction',   color: '#2563EB', icon_name: 'ShieldPlus', sort_order: 3 },
  { key: 'story',     label: 'Story',     color: '#9CA3AF', icon_name: 'BookOpen',   sort_order: 4 },
]

// ----------------------------------------------------------------------------
// List all campaigns owned by the current user, most recently updated first.
// ----------------------------------------------------------------------------
export async function listCampaigns() {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

// ----------------------------------------------------------------------------
// Create a campaign. Types are NOT seeded here anymore — they live at the user
// level and are guaranteed by ensureBuiltinTypes() on app load.
// ----------------------------------------------------------------------------
export async function createCampaign(name, description = null) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const trimmed = (name ?? '').trim()
  if (!trimmed) throw new Error('Campaign name is required')

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({ owner_id: user.id, name: trimmed, description })
    .select()
    .single()
  if (error) throw error

  return { campaign }
}

// ----------------------------------------------------------------------------
// Fetch a single campaign by id (RLS scopes to the current user).
// ----------------------------------------------------------------------------
export async function getCampaign(id) {
  const { data, error } = await supabase
    .from('campaigns')
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
// Rename a campaign (and/or update its description).
// ----------------------------------------------------------------------------
export async function updateCampaign(id, patch) {
  return persistWrite(async () => {
    const { data, error } = await supabase
      .from('campaigns')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }, 'this campaign')
}

// ----------------------------------------------------------------------------
// Delete a campaign. Schema has ON DELETE CASCADE so all related rows
// (nodes, node_sections, connections, text_nodes) go with it. Types are
// per-user and survive — they're owned by the user, not the campaign.
// ----------------------------------------------------------------------------
export async function deleteCampaign(id) {
  return persistWrite(async () => {
    const { error } = await supabase.from('campaigns').delete().eq('id', id)
    if (error) throw error
  }, 'this deletion')
}
