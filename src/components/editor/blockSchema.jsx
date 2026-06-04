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
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core'
import { createReactBlockSpec, createReactInlineContentSpec } from '@blocknote/react'
import ImageAlbumView from './ImageAlbumBlock.jsx'
import ConnectionsView from './ConnectionsBlock.jsx'

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

// ── Connections (data-driven: live chips + delete; reads EditorContext) ──────
const Connections = createReactBlockSpec(
  { type: 'connections', propSchema: {}, content: 'none' },
  { render: () => <ConnectionsView /> }
)

// v0.51: createReactBlockSpec returns a FACTORY that must be CALLED to get the
// BlockSpec; createReactInlineContentSpec returns its spec object directly.
export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, imageAlbum: ImageAlbum(), connections: Connections() },
  inlineContentSpecs: { ...defaultInlineContentSpecs, nodeLink: NodeLink },
})
