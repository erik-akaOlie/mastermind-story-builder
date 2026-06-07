// ============================================================================
// BlockNote schema — the set of block + inline types our editor understands
// ----------------------------------------------------------------------------
// Promoted from the spike (ADR-0016). Registers the two custom blocks the
// migration emits (imageAlbum, connections) plus the inline [[Node]] link, so
// migrated content loads without BlockNote stripping unknown types.
//
// Chunk A renders these minimally (placeholders + counts) — enough to prove the
// editor mounts, loads migrated content, and saves. The real data-driven
// Connections + Image Album blocks (reading live rows / signed image URLs) and
// the [[ trigger that creates connections land in Chunks B and C.
//
// Per ADR-0016 §8, custom blocks must be driven by external app/data state, not
// state held inside the block component — so the real versions read live every
// render rather than caching in component state.
// ============================================================================

import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import './inspectorEditor.css' // Inspector-scoped overrides — MUST stay after Mantine's
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core'
import { createReactBlockSpec, createReactInlineContentSpec } from '@blocknote/react'
import ImageAlbumView from './ImageAlbumBlock.jsx'

// ── "Callout" = MasterMind's product name for BlockNote's native `quote` block ──
// We deliberately do NOT create a custom block type. The stored document JSON keeps
// BlockNote's standard `quote` type (so there is no migration, Markdown export stays
// clean, and the change is trivially reversible); we only RELABEL it "Callout"
// everywhere users and maintainers interact with it. Reference this constant instead
// of the literal 'quote' wherever we mean the Callout block, so the intent is explicit
// and a future promotion to a real custom `callout` type is a one-symbol change.
//
// Promote to a custom type ONLY when Callouts need callout-specific structure (icon,
// title, color variants). See the ADR-0016 addendum (added in F5b).
export const CALLOUT_BLOCK_TYPE = 'quote'

// ── Inline [[Node]] link ─────────────────────────────────────────────────────
const NodeLink = createReactInlineContentSpec(
  { type: 'nodeLink', propSchema: { nodeId: { default: '' }, label: { default: '' } }, content: 'none' },
  {
    render: (props) => (
      <span
        style={{
          color: '#7C3AED',
          background: '#f3e8ff',
          borderRadius: 4,
          padding: '0 4px',
          fontWeight: 500,
        }}
      >
        {props.inlineContent.props.label}
      </span>
    ),
  }
)

// ── Image Album (data-driven: thumbnails + upload + remove) ──────────────────
const ImageAlbum = createReactBlockSpec(
  { type: 'imageAlbum', propSchema: { images: { default: '[]' } }, content: 'none' },
  { render: (props) => <ImageAlbumView block={props.block} editor={props.editor} /> }
)

// ── Connections — NO LONGER a content block (ADR-0016 revised) ───────────────
// Connections render in a fixed, non-removable panel below the GM zone editor
// (see CardZones), not inside the document. The type stays registered ONLY as
// crash-safety so any already-migrated doc that still contains a stray
// connections block loads without error; CardZones strips them on load, and the
// migration no longer emits them, so this render is effectively never seen.
const Connections = createReactBlockSpec(
  { type: 'connections', propSchema: {}, content: 'none' },
  { render: () => null }
)

// v0.51: createReactBlockSpec returns a FACTORY that must be CALLED to get the
// BlockSpec; createReactInlineContentSpec returns its spec object directly.
export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, imageAlbum: ImageAlbum(), connections: Connections() },
  inlineContentSpecs: { ...defaultInlineContentSpecs, nodeLink: NodeLink },
})
