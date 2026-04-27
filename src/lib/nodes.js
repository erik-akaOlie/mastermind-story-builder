// ============================================================================
// Nodes API
// ----------------------------------------------------------------------------
// Supabase CRUD for card nodes. Each card is a row in `nodes` plus up to four
// rows in `node_sections` (one per kind). The section kinds we use today are:
//   narrative     — the bullet list shown in the card body (`storyNotes`)
//   hidden_lore   — DM-only bullets hidden from players
//   dm_notes      — DM-only notes
//   media         — array of image URLs / data URIs (`media`)
//
// The section content is stored as JSONB — currently always an array of
// strings. Marshaling between React shape and DB shape happens here so the
// rest of the app can keep using the flat data.label / data.storyNotes / etc.
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'

const SECTION_KINDS = ['narrative', 'hidden_lore', 'dm_notes', 'media']

// ----------------------------------------------------------------------------
// Load all card nodes + their sections for a campaign.
// Returns React-shaped objects: { id, position, data: { label, type, storyNotes, ... } }
// The caller still needs the node_types lookup to resolve type_id → type key.
// ----------------------------------------------------------------------------
export async function loadNodes(campaignId, nodeTypesById) {
  const [{ data: nodeRows, error: nodesErr }, { data: sectionRows, error: secErr }] =
    await Promise.all([
      supabase.from('nodes').select('*').eq('campaign_id', campaignId),
      supabase
        .from('node_sections')
        .select('*, node:nodes!inner(campaign_id)')
        .eq('node.campaign_id', campaignId),
    ])

  if (nodesErr) throw nodesErr
  if (secErr) throw secErr

  // Group sections by node_id, then by kind
  const sectionsByNode = {}
  for (const s of sectionRows) {
    if (!sectionsByNode[s.node_id]) sectionsByNode[s.node_id] = {}
    sectionsByNode[s.node_id][s.kind] = s.content
  }

  return nodeRows.map((n) => dbNodeToReactFlow(n, sectionsByNode[n.id] || {}, nodeTypesById))
}

// ----------------------------------------------------------------------------
// Insert a new card node + its four default (empty) sections.
// Returns the full React-shaped node.
// ----------------------------------------------------------------------------
export async function createNode({
  campaignId,
  typeId,
  typeKey,
  label = '',
  summary = '',
  avatarUrl = null,
  positionX = 0,
  positionY = 0,
  storyNotes = [],
  hiddenLore = [],
  dmNotes = [],
  media = [],
}) {
  return persistWrite(async () => {
    const { data: node, error } = await supabase
      .from('nodes')
      .insert({
        campaign_id: campaignId,
        type_id: typeId,
        label,
        summary,
        avatar_url: avatarUrl,
        position_x: positionX,
        position_y: positionY,
      })
      .select()
      .single()
    if (error) throw error

    await writeSections(node.id, { storyNotes, hiddenLore, dmNotes, media })

    return dbNodeToReactFlow(
      node,
      { narrative: storyNotes, hidden_lore: hiddenLore, dm_notes: dmNotes, media },
      { [typeId]: { key: typeKey } }
    )
  }, 'your new card')
}

// ----------------------------------------------------------------------------
// Update core node fields (label, summary, avatar, position) and sections.
// Pass any subset; unspecified values are left untouched.
// ----------------------------------------------------------------------------
export async function updateNode(id, { label, summary, avatarUrl, positionX, positionY, typeId }) {
  const patch = {}
  if (label !== undefined) patch.label = label
  if (summary !== undefined) patch.summary = summary
  if (avatarUrl !== undefined) patch.avatar_url = avatarUrl
  if (positionX !== undefined) patch.position_x = positionX
  if (positionY !== undefined) patch.position_y = positionY
  if (typeId !== undefined) patch.type_id = typeId
  if (Object.keys(patch).length === 0) return

  return persistWrite(async () => {
    const { error } = await supabase.from('nodes').update(patch).eq('id', id)
    if (error) throw error
  }, 'this card')
}

// ----------------------------------------------------------------------------
// Replace all sections for a node. Deletes existing sections, inserts new ones.
// For V1 this is simple and correct; can be optimized with upserts later.
// ----------------------------------------------------------------------------
export async function updateNodeSections(nodeId, { storyNotes, hiddenLore, dmNotes, media }) {
  return persistWrite(
    () => writeSections(nodeId, { storyNotes, hiddenLore, dmNotes, media }),
    'this card'
  )
}

// ----------------------------------------------------------------------------
// Delete a node (cascades to its sections and any connections touching it).
// ----------------------------------------------------------------------------
export async function deleteNode(id) {
  return persistWrite(async () => {
    const { error } = await supabase.from('nodes').delete().eq('id', id)
    if (error) throw error
  }, 'this deletion')
}

// ============================================================================
// Internal helpers
// ============================================================================

async function writeSections(nodeId, { storyNotes = [], hiddenLore = [], dmNotes = [], media = [] }) {
  // Wipe existing
  await supabase.from('node_sections').delete().eq('node_id', nodeId)

  const rows = [
    { node_id: nodeId, kind: 'narrative',  content: storyNotes, sort_order: 0 },
    { node_id: nodeId, kind: 'hidden_lore', content: hiddenLore, sort_order: 1 },
    { node_id: nodeId, kind: 'dm_notes',   content: dmNotes,    sort_order: 2 },
    { node_id: nodeId, kind: 'media',      content: media,      sort_order: 3 },
  ]
  const { error } = await supabase.from('node_sections').insert(rows)
  if (error) throw error
}

// Exported for unit testing; this is the marshaling boundary the tests cover.
export function dbNodeToReactFlow(n, sections, nodeTypesById) {
  const typeInfo = nodeTypesById?.[n.type_id]
  return {
    id: n.id,
    type: 'campaignNode',
    position: { x: Number(n.position_x), y: Number(n.position_y) },
    data: {
      id:          n.id,
      label:       n.label,
      type:        typeInfo?.key ?? 'story',
      avatar:      n.avatar_url,
      summary:     n.summary,
      storyNotes:  sections.narrative ?? [],
      hiddenLore:  sections.hidden_lore ?? [],
      dmNotes:     sections.dm_notes ?? [],
      media:       sections.media ?? [],
      locked:      false,
    },
  }
}
