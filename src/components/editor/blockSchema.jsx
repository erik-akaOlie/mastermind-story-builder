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

// ── Image Album (Chunk A placeholder — count only) ───────────────────────────
const ImageAlbum = createReactBlockSpec(
  { type: 'imageAlbum', propSchema: { images: { default: '[]' } }, content: 'none' },
  {
    render: (props) => {
      let count = 0
      try {
        count = JSON.parse(props.block.props.images || '[]').length
      } catch {
        count = 0
      }
      return (
        <div
          contentEditable={false}
          style={{
            border: '1px dashed #c4b5fd',
            borderRadius: 8,
            padding: '8px 10px',
            margin: '4px 0',
            width: '100%',
            fontSize: 12,
            color: '#6b7280',
          }}
        >
          Image Album · {count} image{count === 1 ? '' : 's'}
          <span style={{ color: '#9ca3af' }}> — grid &amp; upload coming next</span>
        </div>
      )
    },
  }
)

// ── Connections (Chunk A placeholder — live list comes in Chunk B) ───────────
const Connections = createReactBlockSpec(
  { type: 'connections', propSchema: {}, content: 'none' },
  {
    render: () => (
      <div
        contentEditable={false}
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '8px 10px',
          margin: '4px 0',
          width: '100%',
          background: '#fafafa',
          fontSize: 12,
          color: '#6b7280',
        }}
      >
        Connections — live list coming next
      </div>
    ),
  }
)

// v0.51: createReactBlockSpec returns a FACTORY that must be CALLED to get the
// BlockSpec; createReactInlineContentSpec returns its spec object directly.
export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, imageAlbum: ImageAlbum(), connections: Connections() },
  inlineContentSpecs: { ...defaultInlineContentSpecs, nodeLink: NodeLink },
})
