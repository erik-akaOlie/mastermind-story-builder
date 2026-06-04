// ============================================================================
// Card content migration — fielded sections → BlockNote block JSON
// ----------------------------------------------------------------------------
// Converts one card's existing fixed-field content (Summary, Story Notes,
// Hidden Lore, DM Notes, Image Section images) into the two block-JSON zones of
// the new editor (ADR-0016). This is a PURE function — no Supabase, no side
// effects — so it is fully unit-testable and the lossy-risk logic lives in one
// place. The one-shot migration tool wraps it and persists the result.
//
//   Zone 'card_view'  ← Summary + "Discoverable Lore" (was Story Notes)
//   Zone 'gm_only'    ← "Notes" (Hidden Lore then DM Notes, merged)
//                       + Image Album (the Image Section images)
//                       + a Connections block
//
// Connections are deliberately NOT an input here. They remain first-class rows
// in the `connections` table (ADR-0016 §6); the GM zone emits a marker
// Connections block that reads them live (§8). This function structurally
// cannot lose or duplicate a connection because it never sees one.
//
// Bullet identity: the old per-item bullet ids (lib/nodes.js normalizeBullets)
// are NOT carried over — they belong to the old per-item undo system, which
// does not apply to block JSON. Only the bullet TEXT is preserved.
// ============================================================================

// BlockNote partial-block builders. We emit the canonical inline-array content
// form (`[{ type: 'text', text, styles: {} }]`) so the stored JSON is the same
// shape BlockNote produces from editing — no surprise normalization on load.
const inline = (text) => (text ? [{ type: 'text', text, styles: {} }] : [])
const paragraph = (text) => ({ type: 'paragraph', content: inline(text) })
const heading = (text, level = 2) => ({ type: 'heading', props: { level }, content: inline(text) })
const bulletItem = (text) => ({ type: 'bulletListItem', content: inline(text) })

// A bullet arrives as either the canonical { id, value } shape or a legacy
// plain string. Pull out the text either way.
const bulletText = (b) => (typeof b === 'string' ? b : (b?.value ?? ''))

/**
 * @param {object} card  React-shaped card content (the `data` fields).
 * @param {string} [card.summary]
 * @param {Array<{id?:string,value:string}|string>} [card.storyNotes]
 * @param {Array<{id?:string,value:string}|string>} [card.hiddenLore]
 * @param {Array<{id?:string,value:string}|string>} [card.dmNotes]
 * @param {Array<object|string>} [card.media]  Image Section entries, preserved as-is.
 * @returns {{ card_view: object[], gm_only: object[] }} two BlockNote documents.
 */
export function migrateCardToBlocks(card = {}) {
  const {
    summary = '',
    storyNotes = [],
    hiddenLore = [],
    dmNotes = [],
    media = [],
  } = card

  // ── Card View: Summary, then Discoverable Lore ─────────────────────────────
  const cardView = []
  if (summary && summary.trim()) cardView.push(paragraph(summary))
  if (storyNotes.length) {
    cardView.push(heading('Discoverable Lore'))
    for (const b of storyNotes) cardView.push(bulletItem(bulletText(b)))
  }

  // ── GM's Eyes Only: Notes (hidden lore THEN dm notes), Album, Connections ──
  const gmOnly = []
  const notes = [...hiddenLore, ...dmNotes]
  if (notes.length) {
    gmOnly.push(heading('Notes'))
    for (const b of notes) gmOnly.push(bulletItem(bulletText(b)))
  }
  if (media.length) {
    // Block props are primitives only (spike finding #2), so the image list is
    // a JSON string. Stringify the media array verbatim — structured
    // { path, alt, uploaded_at } entries and legacy strings alike — so the
    // round-trip is byte-for-byte lossless.
    gmOnly.push({ type: 'imageAlbum', props: { images: JSON.stringify(media) } })
  }
  // Always emit the Connections block: a card may have connection rows even with
  // no other content, and the block reads them live from the connections table.
  gmOnly.push({ type: 'connections', props: {} })

  return { card_view: cardView, gm_only: gmOnly }
}
