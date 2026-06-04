// ============================================================================
// Block-zone persistence — the editor's read/write boundary (block-editor Phase 2)
// ----------------------------------------------------------------------------
// Loads and saves the two BlockNote zone documents (card_view / gm_only) that
// the migration produced (ADR-0016). Kept separate from lib/nodes.js (the
// legacy fielded-section CRUD) and from lib/blockMigration.js (the one-shot
// migration) so the editor's persistence has a single, focused home.
//
// Each zone saves INDEPENDENTLY: saveBlockZones replaces only the kinds present
// in its payload, so saving Card View never wipes GM's Eyes Only and vice versa.
// The replace is scoped to these two kinds only — legacy section rows
// (narrative / hidden_lore / dm_notes / media) are never touched.
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'

export const ZONE_KINDS = ['card_view', 'gm_only']

// Stable per-zone sort order so independent saves don't reshuffle the rows.
const ZONE_SORT = { card_view: 0, gm_only: 1 }

// ----------------------------------------------------------------------------
// Load the two zone documents for one card. Returns block JSON per zone, or
// null for a zone that has no row yet (e.g. an un-migrated card).
// ----------------------------------------------------------------------------
export async function loadBlockZones(nodeId) {
  const { data, error } = await supabase
    .from('node_sections')
    .select('kind, content')
    .eq('node_id', nodeId)
    .in('kind', ZONE_KINDS)
  if (error) throw error

  const out = { card_view: null, gm_only: null }
  for (const r of data || []) out[r.kind] = r.content
  return out
}

// ----------------------------------------------------------------------------
// Save one or both zones. `zones` is a subset of { card_view, gm_only }; only
// the provided kinds are replaced (delete-then-insert scoped to those kinds).
// Non-atomic per kind, same as the migration writer; a failed insert leaves the
// zone empty for a moment and a re-save fixes it. Legacy rows are never in scope.
// ----------------------------------------------------------------------------
export async function saveBlockZones(nodeId, zones) {
  const kinds = Object.keys(zones || {}).filter((k) => ZONE_KINDS.includes(k))
  if (!kinds.length) return

  return persistWrite(async () => {
    const { error: delErr } = await supabase
      .from('node_sections')
      .delete()
      .eq('node_id', nodeId)
      .in('kind', kinds)
    if (delErr) throw delErr

    const rows = kinds.map((kind) => ({
      node_id: nodeId,
      kind,
      content: zones[kind],
      sort_order: ZONE_SORT[kind],
    }))
    const { error: insErr } = await supabase.from('node_sections').insert(rows)
    if (insErr) throw insErr
  }, 'this card')
}
