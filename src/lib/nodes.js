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

// Bullet sections (narrative / hidden_lore / dm_notes) store
// `[{id, value}, ...]` JSONB so each item has a stable identity. ID stability
// is the foundation phase 7c builds per-item undo entries on — without it,
// position-and-value matching would misidentify duplicate-text bullets and
// fail under concurrent edits.
//
// Legacy data is `string[]`. We normalize lazily on read: any item that
// arrives as a plain string gets a fresh UUID assigned right here. Those IDs
// are NOT persisted on read alone (would cause a write storm on cold load
// of a legacy workspace). They get persisted naturally the next time the user
// makes any edit to that card — auto-save then writes the structured form,
// from which point IDs are stable across sessions.
//
// Trade-off accepted: if a user opens but never edits a legacy card, the
// in-memory IDs are session-local and regenerate on next read. That matters
// only for cross-session F5-recovered undo entries built on those IDs in
// phase 7c. Until the user makes one persisted edit, per-item undo for that
// card degrades to "refused on F5" — which is the right thing (better than
// silently re-applying an entry against re-keyed bullets).
export function normalizeBullets(content) {
  if (!Array.isArray(content)) return []
  const out = []
  for (const item of content) {
    if (typeof item === 'string') {
      out.push({ id: crypto.randomUUID(), value: item })
      continue
    }
    if (item && typeof item === 'object' && typeof item.value === 'string') {
      // Already structured. Defensive: if `id` is missing or non-string
      // (shouldn't happen with well-formed DB rows but cheap to guard),
      // mint a fresh one rather than rendering null/undefined as a React key.
      const id = typeof item.id === 'string' && item.id.length > 0
        ? item.id
        : crypto.randomUUID()
      out.push({ id, value: item.value })
      continue
    }
    // Malformed entry — coerce defensively to preserve user data.
    out.push({ id: crypto.randomUUID(), value: String(item ?? '') })
  }
  return out
}

// ----------------------------------------------------------------------------
// Load all card nodes + their sections for a workspace.
// Returns React-shaped objects: { id, position, data: { label, type, storyNotes, ... } }
// The caller still needs the node_types lookup to resolve type_id → type key.
// ----------------------------------------------------------------------------
export async function loadNodes(workspaceId, nodeTypesById) {
  const [{ data: nodeRows, error: nodesErr }, { data: sectionRows, error: secErr }] =
    await Promise.all([
      supabase.from('nodes').select('*').eq('workspace_id', workspaceId),
      supabase
        .from('node_sections')
        .select('*, node:nodes!inner(workspace_id)')
        .eq('node.workspace_id', workspaceId),
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
//
// `id` is optional. Pass it to recreate a node at a known UUID — used by
// the undo system when redoing a createCard (after it was undone via delete)
// so that any subsequent action records still pointing at that id keep
// working. Without `id`, Postgres assigns a fresh one.
// ----------------------------------------------------------------------------
export async function createNode({
  id,
  workspaceId,
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
    const insertRow = {
      workspace_id: workspaceId,
      type_id: typeId,
      label,
      summary,
      avatar_url: avatarUrl,
      position_x: positionX,
      position_y: positionY,
    }
    if (id) insertRow.id = id

    const { data: node, error } = await supabase
      .from('nodes')
      .insert(insertRow)
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
// Duplicate a card (block-editor cutover, ADR-0016 Chunk E2).
//
// Inserts a new card row copying the source's core fields, then copies EVERY
// one of the source's node_sections rows — kind-agnostic — under the new id.
// Reading "all rows" (rather than an enumerated list of kinds) is the
// future-proof choice: any kind added later is duplicated automatically, and
// it never becomes its own cutover problem.
//
// Section content is read from the DB, not from canvas memory, for the same
// reason buildDeleteCardSnapshot does: the GM zone (`gm_only`) is never held in
// React state. The caller flushes the source editor first if it's open, so the
// copy includes the latest unsaved edits.
//
// Connections are NOT copied. A connection is a deliberate act (ADR-0016 §4),
// so a duplicate enters the graph unconnected (product decision, 2026-06-04).
// No undo entry is recorded — duplicate is not undoable by design; the
// affordance is to delete the copy (which IS undoable since E1).
//
// Returns the full React-shaped duplicate node.
// ----------------------------------------------------------------------------
export async function duplicateCard({
  sourceId,
  workspaceId,
  typeId,
  typeKey,
  label = '',
  summary = '',
  avatarUrl = null,
  positionX = 0,
  positionY = 0,
}) {
  return persistWrite(async () => {
    const { data: node, error: nodeErr } = await supabase
      .from('nodes')
      .insert({
        workspace_id: workspaceId,
        type_id: typeId,
        label,
        summary,
        avatar_url: avatarUrl,
        position_x: positionX,
        position_y: positionY,
      })
      .select()
      .single()
    if (nodeErr) throw nodeErr

    const { data: sectionRows, error: secErr } = await supabase
      .from('node_sections')
      .select('kind, content, sort_order')
      .eq('node_id', sourceId)
    if (secErr) throw secErr

    const sectionsByKind = {}
    if (sectionRows?.length) {
      const copies = sectionRows.map((s) => ({
        node_id:    node.id,
        kind:       s.kind,
        content:    s.content,
        sort_order: s.sort_order,
      }))
      const { error: insErr } = await supabase.from('node_sections').insert(copies)
      if (insErr) throw insErr
      for (const s of sectionRows) sectionsByKind[s.kind] = s.content
    }

    return dbNodeToReactFlow(node, sectionsByKind, { [typeId]: { key: typeKey } })
  }, 'this duplicate')
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

// ----------------------------------------------------------------------------
// Build a DB-shape snapshot of everything a deleteCard cascade will remove
// (per ADR-0006 §8). Capture this BEFORE issuing the delete so the inverse
// can rebuild the card with its sections and connections intact.
//
// ASYNC + DB-sourced section content (block-editor cutover, ADR-0016 Chunk E1):
// the card row and connection rows are read from the in-memory canvas state
// (live truth — positions persist on drag-stop, connections persist instantly,
// node columns flush on save). But SECTION CONTENT is read from the database,
// not from canvas memory. The GM zone (`gm_only`) is never held in React state
// (only `card_view` is, to drive the canvas preview), so an in-memory snapshot
// would be structurally blind to half the card's content. Reading every kind
// here makes the snapshot lossless for the new block zones (`card_view` /
// `gm_only`) AND any surviving legacy kinds during the transition.
//
// A section-fetch error THROWS rather than returning a partial snapshot, so the
// caller can FAIL CLOSED — never remove a card we can't fully restore. (The
// caller must flush any pending editor saves before calling this, so the DB
// holds the latest content.)
//
// `typeIdByKey` is passed in (rather than read from useTypeStore here) to
// keep this module free of store dependencies. App.jsx supplies the lookup
// at call time.
//
// Returns null if the card isn't in local state (no DB fetch is issued).
// ----------------------------------------------------------------------------
export async function buildDeleteCardSnapshot(cardId, { nodes, edges, workspaceId, typeIdByKey }) {
  const node = nodes.find((n) => n.id === cardId)
  if (!node) return null

  const dbCardRow = {
    id:          node.id,
    workspace_id: workspaceId,
    type_id:     typeIdByKey?.[node.data.type] ?? null,
    label:       node.data.label   ?? '',
    summary:     node.data.summary ?? '',
    avatar_url:  node.data.avatar  ?? null,
    position_x:  node.position.x,
    position_y:  node.position.y,
  }

  // Every section row for this card, regardless of kind. Mapped to the
  // restore-insert shape restoreCardWithDependents expects.
  const { data: sectionRows, error: secErr } = await supabase
    .from('node_sections')
    .select('kind, content, sort_order')
    .eq('node_id', cardId)
  if (secErr) throw secErr

  const dbSectionRows = (sectionRows || []).map((s) => ({
    node_id:    cardId,
    kind:       s.kind,
    content:    s.content,
    sort_order: s.sort_order,
  }))

  const dbConnectionRows = (edges || [])
    .filter((e) => e.source === cardId || e.target === cardId)
    .map((e) => ({
      id:             e.id,
      workspace_id:    workspaceId,
      source_node_id: e.source,
      target_node_id: e.target,
    }))

  return { dbCardRow, dbSectionRows, dbConnectionRows }
}

// ----------------------------------------------------------------------------
// Inverse of a card delete: re-insert the card row, its four section rows,
// and any connections that touched it. Order matters — connections reference
// the card via FK, so the card row must land first. Per ADR-0006 §"Trade-offs
// accepted", this is non-transactional; partial-restore failure is rare in
// practice and would warrant a Postgres RPC if it becomes real.
//
// Realtime echoes these INSERTs back to all subscribers (including this tab),
// but useWorkspaceData's handlers are idempotent — they skip rows whose ids
// already exist locally. So the optimistic setNodes/setEdges in the dispatcher
// won't be double-applied.
// ----------------------------------------------------------------------------
export async function restoreCardWithDependents({ dbCardRow, dbSectionRows, dbConnectionRows }) {
  return persistWrite(async () => {
    const { error: nodeErr } = await supabase.from('nodes').insert(dbCardRow)
    if (nodeErr) throw nodeErr

    if (dbSectionRows?.length) {
      const { error: secErr } = await supabase.from('node_sections').insert(dbSectionRows)
      if (secErr) throw secErr
    }

    if (dbConnectionRows?.length) {
      const { error: connErr } = await supabase.from('connections').insert(dbConnectionRows)
      if (connErr) throw connErr
    }
  }, 'this restore')
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
//
// Bullet sections (narrative / hidden_lore / dm_notes) pass through
// normalizeBullets so legacy `string[]` data is promoted in memory to the
// `{id, value}[]` shape phase 7c's per-item undo depends on. Media stays
// as-is — its items already have natural identity (the storage `path` for
// uploaded entries; legacy strings still render via useImageUrl).
export function dbNodeToReactFlow(n, sections, nodeTypesById) {
  const typeInfo = nodeTypesById?.[n.type_id]
  // A missing typeInfo means n.type_id doesn't resolve to a known type —
  // a data-integrity problem that the FK constraint on nodes.type_id is
  // supposed to make impossible. If it ever happens, surface it (don't
  // silently relabel the card to a built-in type) so the corruption is
  // visible instead of papered over. The card renders with a gray
  // fallback in CampaignNode (typeConfig fallback branch).
  if (!typeInfo) {
    console.error(`dbNodeToReactFlow: node ${n.id} has unresolved type_id=${n.type_id}`)
  }
  return {
    id: n.id,
    type: 'campaignNode',
    position: { x: Number(n.position_x), y: Number(n.position_y) },
    data: {
      id:          n.id,
      label:       n.label,
      type:        typeInfo?.key ?? null,
      avatar:      n.avatar_url,
      summary:     n.summary,
      storyNotes:  normalizeBullets(sections.narrative),
      hiddenLore:  normalizeBullets(sections.hidden_lore),
      dmNotes:     normalizeBullets(sections.dm_notes),
      media:       sections.media ?? [],
      // Card View block JSON (block-editor Phase 2, Chunk D) — drives the
      // read-only canvas preview. null when the card has no card_view row yet
      // (un-migrated or brand-new); the canvas falls back to legacy fields then.
      cardView:    sections.card_view ?? null,
      locked:      false,
    },
  }
}
