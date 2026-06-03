// ─────────────────────────────────────────────────────────────────────────
// SPIKE-ONLY: BlockNote prototype. Same four deciding factors as the Tiptap
// spike, so the two can be compared on equal footing.
// Throwaway. Delete with src/spike/.
// ─────────────────────────────────────────────────────────────────────────
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core'
import { useCreateBlockNote, createReactBlockSpec, createReactInlineContentSpec, SuggestionMenuController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { useState } from 'react'
import { searchNodes, FAKE_IMAGES, FAKE_CONNECTIONS } from './fakeNodes.js'

// ── 1. Inline [[Node]] link — custom inline content ─────────────────────────
// NOTE: BlockNote inline/block propSchema values are PRIMITIVES only
// (string | number | boolean). nodeId/label are fine here; the constraint
// bites on the Image Album block below.
const NodeLink = createReactInlineContentSpec(
  { type: 'nodeLink', propSchema: { nodeId: { default: '' }, label: { default: '' } }, content: 'none' },
  {
    render: (props) => (
      <span style={{ color: '#7C3AED', background: '#f3e8ff', borderRadius: 4, padding: '0 4px', fontWeight: 500 }}>
        [[{props.inlineContent.props.label}]]
      </span>
    ),
  }
)

// ── 2a. Image Album — props are primitives, so the image list must be
//        JSON-stringified into a single string prop and parsed on render. ────
const ImageAlbum = createReactBlockSpec(
  { type: 'imageAlbum', propSchema: { images: { default: '[]' } }, content: 'none' },
  {
    render: (props) => {
      const imgs = JSON.parse(props.block.props.images || '[]')
      return (
        <div style={{ border: '1px dashed #c4b5fd', borderRadius: 8, padding: 8, margin: '6px 0', width: '100%' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>IMAGE ALBUM ({imgs.length})</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {imgs.map((u, i) => <img key={i} src={u} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} />)}
            <button
              onClick={() => props.editor.updateBlock(props.block, {
                type: 'imageAlbum',
                props: { images: JSON.stringify([...imgs, FAKE_IMAGES[imgs.length % FAKE_IMAGES.length]]) },
              })}
              style={{ width: 80, height: 60, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>+ add</button>
          </div>
        </div>
      )
    },
  }
)

// LIFECYCLE: when a connection is deleted, every [[link]] in the document that
// points at that node reverts to plain text (the words stay, the link dies).
// Walks the doc and rewrites matching nodeLink inline items to text items.
function revertLinksForNode(editor, nodeId) {
  const updates = []
  for (const block of editor.document) {
    if (!Array.isArray(block.content)) continue
    let changed = false
    const newContent = block.content.map((it) => {
      if (it.type === 'nodeLink' && it.props.nodeId === nodeId) {
        changed = true
        return { type: 'text', text: it.props.label, styles: {} }
      }
      return it
    })
    if (changed) updates.push([block, newContent])
  }
  updates.forEach(([block, content]) => editor.updateBlock(block, { content }))
}

// ── 2b. Connections — read-mostly block rendering live data + delete. ───────
const Connections = createReactBlockSpec(
  { type: 'connections', propSchema: {}, content: 'none' },
  {
    render: (props) => {
      const [conns, setConns] = useState(FAKE_CONNECTIONS)
      const del = (c) => {
        setConns((cs) => cs.filter((x) => x.id !== c.id))
        revertLinksForNode(props.editor, c.targetId)  // [[links]] → plain text
      }
      return (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, margin: '6px 0', background: '#fafafa', width: '100%' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>CONNECTIONS</div>
          {conns.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13 }}>
              <span>[[{c.label}]]</span>
              <button onClick={() => del(c)}
                style={{ color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>delete</button>
            </div>
          ))}
          {!conns.length && <div style={{ fontSize: 12, color: '#9ca3af' }}>No connections.</div>}
        </div>
      )
    },
  }
)

const schema = BlockNoteSchema.create({
  // v0.51: createReactBlockSpec returns a FACTORY — must be called to get the
  // BlockSpec. (createReactInlineContentSpec returns its spec object directly.)
  blockSpecs: { ...defaultBlockSpecs, imageAlbum: ImageAlbum(), connections: Connections() },
  inlineContentSpecs: { ...defaultInlineContentSpecs, nodeLink: NodeLink },
})

// ── 4. Markdown serializer over editor.document (built-in MD is lossy and
//        cannot emit our [[wikilinks]] or custom blocks). ────────────────────
function serializeInline(items) {
  return (items || []).map((it) => {
    if (it.type === 'nodeLink') return `[[${it.props.label}]]`
    if (it.type !== 'text') return ''
    let t = it.text || ''
    const s = it.styles || {}
    if (s.bold) t = `**${t}**`
    if (s.italic) t = `*${t}*`
    if (s.strike) t = `~~${t}~~`
    if (s.underline) t = `<u>${t}</u>`        // HTML fallback — no native MD
    return t
  }).join('')
}

export function blockNoteDocToMarkdown(blocks) {
  const out = []
  for (const b of blocks || []) {
    switch (b.type) {
      case 'heading': out.push('#'.repeat(b.props.level || 1) + ' ' + serializeInline(b.content)); break
      case 'paragraph': out.push(serializeInline(b.content)); break
      case 'bulletListItem': out.push('- ' + serializeInline(b.content)); break
      case 'numberedListItem': out.push('1. ' + serializeInline(b.content)); break
      case 'quote': out.push('> ' + serializeInline(b.content)); break
      case 'imageAlbum': JSON.parse(b.props.images || '[]').forEach((u) => out.push(`![](${u})`)); break
      case 'connections': out.push('## Connections'); FAKE_CONNECTIONS.forEach((c) => out.push(`- [[${c.label}]]`)); break
      default: out.push(serializeInline(b.content)); break
    }
    out.push('')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function ZoneEditor({ label, initialContent, onExport }) {
  const editor = useCreateBlockNote({ schema, initialContent })
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <button onClick={() => editor.insertBlocks([{ type: 'imageAlbum', props: { images: '[]' } }], editor.getTextCursorPosition().block, 'after')}>+ album</button>
        <button onClick={() => editor.insertBlocks([{ type: 'connections' }], editor.getTextCursorPosition().block, 'after')}>+ connections</button>
        <button onClick={() => onExport(blockNoteDocToMarkdown(editor.document))}>export ⭳</button>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, minHeight: 160 }}>
        <BlockNoteView editor={editor} slashMenu>
          {/* [[ ]] WORKAROUND. Measured BlockNote behavior: it re-triggers on the
              SECOND "[", so the query is the plain search text ("ire"), and on
              select it deletes only the 2nd "[" + query — leaving the 1st "[" as a
              stray. So we trigger on "[", search the query directly, and after
              insert we strip the stray leading "[" via a document rewrite. */}
          <SuggestionMenuController
            triggerCharacter="["
            getItems={async (query) =>
              searchNodes(query).map((n) => ({
                title: `${n.label}  ·  ${n.type}`,
                onItemClick: () => {
                  editor.insertInlineContent([{ type: 'nodeLink', props: { nodeId: n.id, label: n.label } }, ' '])
                  // Strip the stray leading "[" the double-bracket leaves behind.
                  const block = editor.getTextCursorPosition().block
                  if (Array.isArray(block.content)) {
                    const idx = block.content.findIndex(
                      (it) => it.type === 'nodeLink' && it.props?.nodeId === n.id,
                    )
                    const prev = idx > 0 ? block.content[idx - 1] : null
                    if (prev && prev.type === 'text' && prev.text.endsWith('[')) {
                      const newContent = [...block.content]
                      newContent[idx - 1] = { ...prev, text: prev.text.slice(0, -1) }
                      editor.updateBlock(block, { content: newContent })
                    }
                  }
                  // eslint-disable-next-line no-console
                  console.log('[spike] create connection ->', n.id, n.label)
                },
              }))
            }
          />
        </BlockNoteView>
      </div>
    </div>
  )
}

export default function BlockNoteSpike() {
  const [md, setMd] = useState('')
  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
        Type <code>[[</code> to autocomplete a node link. Slash menu (<code>/</code>) and drag handles are built in. Buttons insert custom blocks.
      </p>
      <div style={{ display: 'flex', gap: 16 }}>
        <ZoneEditor label="Card View" onExport={setMd}
          initialContent={[{ type: 'heading', props: { level: 2 }, content: 'Strahd von Zarovich' }, { type: 'paragraph', content: 'The vampire lord obsessed with ' }]} />
        <ZoneEditor label="GM's Eyes Only" onExport={setMd}
          initialContent={[{ type: 'paragraph', content: 'Secret: he fears the dawn.' }]} />
      </div>
      {md && (
        <pre style={{ marginTop: 12, background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>{md}</pre>
      )}
    </div>
  )
}
