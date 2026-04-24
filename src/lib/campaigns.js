// ============================================================================
// Campaigns API
// ----------------------------------------------------------------------------
// Thin wrapper around Supabase for campaigns + their built-in node types.
// All functions throw on error so the caller can decide how to surface it.
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'

// The five built-in card types, seeded on every new campaign.
// Matches src/store/useTypeStore.js (the hardcoded DEFAULT_TYPES).
const BUILT_IN_TYPES = [
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
// Create a campaign and seed its built-in node types.
// NOTE: this is two separate inserts, not a transaction. In the rare case the
// second insert fails we'd have an empty campaign with no types. Acceptable
// for V1; revisit with an RPC/stored procedure if this becomes a real issue.
// ----------------------------------------------------------------------------
export async function createCampaign(name, description = null) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const trimmed = (name ?? '').trim()
  if (!trimmed) throw new Error('Campaign name is required')

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({ owner_id: user.id, name: trimmed, description })
    .select()
    .single()
  if (campaignError) throw campaignError

  const typeRows = BUILT_IN_TYPES.map((t) => ({
    ...t,
    campaign_id: campaign.id,
    is_system: true,
  }))
  const { data: insertedTypes, error: typesError } = await supabase
    .from('node_types')
    .insert(typeRows)
    .select()
  if (typesError) throw typesError

  // Return campaign + the seeded types, so callers can use type IDs
  // without a second query (useful for sample-data seeding).
  return { campaign, nodeTypes: insertedTypes }
}

// ----------------------------------------------------------------------------
// Fetch a single campaign by id. Returns null if not found (or not owned by
// the current user — RLS filters it out before we see it).
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
// Load the node types for a campaign. Returned in insertion order.
// ----------------------------------------------------------------------------
export async function listNodeTypes(campaignId) {
  const { data, error } = await supabase
    .from('node_types')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
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
// (node_types, nodes, node_sections, connections, text_nodes) go with it.
// ----------------------------------------------------------------------------
export async function deleteCampaign(id) {
  return persistWrite(async () => {
    const { error } = await supabase.from('campaigns').delete().eq('id', id)
    if (error) throw error
  }, 'this deletion')
}
