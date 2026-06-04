// ============================================================================
// Block migration — orchestration over the pure converter (Phase 1)
// ----------------------------------------------------------------------------
// Reads every card the signed-in user owns (RLS-scoped), converts each card's
// legacy fielded content into the two new block-JSON zones via the pure
// `migrateCardToBlocks`, writes ONLY the new `card_view` / `gm_only` rows, then
// reads them back and verifies the saved data survived the database round-trip.
//
// Hard guarantees (per the Phase-1 decision):
//   - NEVER modifies, deletes, or overwrites legacy rows
//     (narrative / hidden_lore / dm_notes / media). This tool only ever
//     touches the two new kinds.
//   - Idempotent (B1): a card already migrated AND up-to-date is skipped; a
//     card that is new or stale has only its two new-kind rows replaced — never
//     duplicated.
//   - Migration ≠ destruction. This module does not delete legacy data under
//     any circumstance. Legacy cleanup is a future, separate tool + ADR.
//
// What proves what:
//   - Dry-run proves CONVERSION readiness (every card converts cleanly). It
//     writes nothing and therefore cannot prove database survival.
//   - The real run's read-back (A1) proves the SAVED data survived the
//     database round-trip — it re-reads the rows and re-checks no-loss.
// ============================================================================

import { supabase } from './supabase.js'
import { normalizeBullets } from './nodes.js'
import { migrateCardToBlocks } from './migrateCardToBlocks.js'

export const SOURCE_KINDS = ['narrative', 'hidden_lore', 'dm_notes', 'media']
export const MIGRATED_KINDS = ['card_view', 'gm_only']

// ── Pure helpers (exported for unit testing) ─────────────────────────────────

// Order-insensitive deep equality. Objects compare by key set + recursion, so
// a JSONB round-trip that reorders object keys still reads as equal. Arrays
// stay order-SENSITIVE — block and bullet order is meaningful content.
export function jsonEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return a === b
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => jsonEqual(v, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], b[k]))
  }
  return false
}

// Flatten a block's inline content to plain text. Tolerant of the string
// shorthand and the canonical inline-array form, and of node-link inline items.
function inlineText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((it) => {
      if (it?.type === 'text') return it.text ?? ''
      if (it?.type === 'nodeLink') return it.props?.label ?? ''
      return ''
    })
    .join('')
}

const bulletTexts = (blocks) =>
  (blocks || []).filter((b) => b?.type === 'bulletListItem').map((b) => inlineText(b.content))
const allText = (blocks) => (blocks || []).map((b) => inlineText(b?.content)).join('\n')
const arrEq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * The verifier. Given a card's SOURCE fields and the SAVED block JSON for both
 * zones, return a list of human-readable loss issues — empty means no loss.
 *
 * This is the load-bearing safety check behind the "saved data survived"
 * claim, so it is unit-tested independently (it must actually CATCH loss, not
 * just rubber-stamp). It mirrors the no-loss test's assertions but runs against
 * data read back from the database.
 *
 * @param {object} source  { summary, storyNotes, hiddenLore, dmNotes, media }
 *                         (bullets as {id,value}[] or string[]; media verbatim)
 * @param {any} savedCardView  block JSON read back from the card_view row
 * @param {any} savedGmOnly    block JSON read back from the gm_only row
 * @returns {string[]} issues
 */
export function checkNoLoss(source, savedCardView, savedGmOnly) {
  const issues = []
  const val = (b) => (typeof b === 'string' ? b : b?.value ?? '')

  const cardView = Array.isArray(savedCardView) ? savedCardView : null
  const gmOnly = Array.isArray(savedGmOnly) ? savedGmOnly : null
  if (!cardView) issues.push('card_view row missing or not a block array')
  if (!gmOnly) issues.push('gm_only row missing or not a block array')

  // Summary survives somewhere in the Card View zone.
  if (source.summary && source.summary.trim()) {
    if (!cardView || !allText(cardView).includes(source.summary)) {
      issues.push('Summary text not found in Card View')
    }
  }

  // Story Notes → Discoverable Lore bullets, in order.
  const story = (source.storyNotes || []).map(val)
  if (cardView && !arrEq(bulletTexts(cardView), story)) {
    issues.push('Discoverable Lore bullets do not match Story Notes')
  }

  // Hidden Lore + DM Notes → Notes bullets (hidden-lore-first), in order.
  const notes = [...(source.hiddenLore || []), ...(source.dmNotes || [])].map(val)
  if (gmOnly && !arrEq(bulletTexts(gmOnly), notes)) {
    issues.push('Notes bullets do not match Hidden Lore + DM Notes')
  }

  // Image Section images → Image Album, byte-for-byte.
  const media = source.media || []
  if (media.length) {
    const album = gmOnly && gmOnly.find((b) => b?.type === 'imageAlbum')
    if (!album) {
      issues.push('Image Album missing despite Image Section images')
    } else {
      let imgs = null
      try {
        imgs = JSON.parse(album.props?.images ?? '[]')
      } catch {
        imgs = null
      }
      if (!jsonEqual(imgs, media)) issues.push('Image Album images do not match Image Section')
    }
  }

  // Connections must remain renderable: a live-reading Connections block exists.
  if (gmOnly && !gmOnly.some((b) => b?.type === 'connections')) {
    issues.push('Connections block missing from GM zone')
  }

  return issues
}

/**
 * Classify one loaded card against the converter's current output.
 * `upToDate` true → already migrated and current → skip.
 * Otherwise the card is new or stale → migrate (replace the two new kinds).
 */
export function classifyCard(card) {
  const fresh = migrateCardToBlocks(card.source)
  const upToDate =
    card.existing?.card_view != null &&
    card.existing?.gm_only != null &&
    jsonEqual(card.existing.card_view, fresh.card_view) &&
    jsonEqual(card.existing.gm_only, fresh.gm_only)
  return { fresh, upToDate }
}

// ── Supabase I/O ─────────────────────────────────────────────────────────────

// Load every card the user owns (RLS-scoped) with its source sections AND any
// existing migrated rows, so classification needs no extra per-card reads.
async function loadCards() {
  const { data: workspaces, error: wErr } = await supabase.from('workspaces').select('id')
  if (wErr) throw wErr
  const wsIds = (workspaces || []).map((w) => w.id)
  if (!wsIds.length) return []

  const { data: nodeRows, error: nErr } = await supabase
    .from('nodes')
    .select('id, label, summary, workspace_id')
    .in('workspace_id', wsIds)
  if (nErr) throw nErr
  if (!nodeRows?.length) return []

  const nodeIds = nodeRows.map((n) => n.id)
  const { data: sectionRows, error: sErr } = await supabase
    .from('node_sections')
    .select('node_id, kind, content')
    .in('node_id', nodeIds)
  if (sErr) throw sErr

  const byNode = {}
  for (const s of sectionRows || []) {
    ;(byNode[s.node_id] ||= {})[s.kind] = s.content
  }

  return nodeRows.map((n) => {
    const secs = byNode[n.id] || {}
    return {
      id: n.id,
      workspaceId: n.workspace_id,
      label: n.label || 'Untitled',
      source: {
        summary: n.summary || '',
        storyNotes: normalizeBullets(secs.narrative),
        hiddenLore: normalizeBullets(secs.hidden_lore),
        dmNotes: normalizeBullets(secs.dm_notes),
        media: Array.isArray(secs.media) ? secs.media : [],
      },
      existing: {
        card_view: secs.card_view ?? null,
        gm_only: secs.gm_only ?? null,
      },
    }
  })
}

// Idempotent write of ONLY the two new kinds. Delete-then-insert is
// non-atomic: if the insert fails after the delete, the card is left with no
// new-kind rows (legacy untouched) and a re-run rewrites it. Legacy data is
// never at risk because the delete is scoped to MIGRATED_KINDS.
async function writeMigrated(nodeId, fresh) {
  const { error: delErr } = await supabase
    .from('node_sections')
    .delete()
    .eq('node_id', nodeId)
    .in('kind', MIGRATED_KINDS)
  if (delErr) throw delErr

  const rows = [
    { node_id: nodeId, kind: 'card_view', content: fresh.card_view, sort_order: 0 },
    { node_id: nodeId, kind: 'gm_only', content: fresh.gm_only, sort_order: 1 },
  ]
  const { error: insErr } = await supabase.from('node_sections').insert(rows)
  if (insErr) throw insErr
}

// Read the just-written rows back and verify against source (A1). Throws with a
// joined issue list if anything was lost in the round-trip.
async function verifyMigrated(card) {
  const { data, error } = await supabase
    .from('node_sections')
    .select('kind, content')
    .eq('node_id', card.id)
    .in('kind', MIGRATED_KINDS)
  if (error) throw error

  const saved = {}
  for (const r of data || []) saved[r.kind] = r.content

  const issues = checkNoLoss(card.source, saved.card_view, saved.gm_only)
  if (issues.length) throw new Error(issues.join('; '))
}

/**
 * Run the migration.
 *
 * @param {{ dryRun: boolean }} opts
 * @returns {Promise<object>} report:
 *   { dryRun, total, toMigrate, migrated, verified, skipped,
 *     failed: [{ cardId, label, phase, reason }], nothingToMigrate }
 */
export async function runBlockMigration({ dryRun }) {
  const cards = await loadCards()

  const report = {
    dryRun,
    total: cards.length,
    toMigrate: 0,
    migrated: 0,
    verified: 0,
    skipped: 0,
    failed: [],
    nothingToMigrate: false,
  }

  for (const card of cards) {
    const { fresh, upToDate } = classifyCard(card)
    if (upToDate) {
      report.skipped++
      continue
    }
    report.toMigrate++
    if (dryRun) continue

    try {
      await writeMigrated(card.id, fresh)
      report.migrated++
    } catch (err) {
      report.failed.push({ cardId: card.id, label: card.label, phase: 'write', reason: err.message })
      continue
    }

    try {
      await verifyMigrated(card)
      report.verified++
    } catch (err) {
      report.failed.push({ cardId: card.id, label: card.label, phase: 'verify', reason: err.message })
    }
  }

  report.nothingToMigrate = report.toMigrate === 0
  return report
}
