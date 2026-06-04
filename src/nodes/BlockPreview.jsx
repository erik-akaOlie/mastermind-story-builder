// ============================================================================
// BlockPreview — lightweight read-only renderer for Card View block JSON
// ----------------------------------------------------------------------------
// Renders a card's Card View block document as static HTML on the canvas card
// (ADR-0016 §9). It is deliberately NOT a BlockNote editor instance — mounting
// an editor per card would not scale to hundreds of cards. It only needs to
// cover the block types that appear in a Card View zone (paragraph, heading,
// lists, quote); Image Album and Connections live in the GM zone and never
// reach here.
//
// Inline content renders text plus [[Node]] links (as colored, non-interactive
// spans). Styling is intentionally minimal/small — this is a glanceable
// preview, not the editing surface. Visual polish is Chunk F.
// ============================================================================

function renderInline(content, keyPrefix) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  return content.map((it, i) => {
    const key = `${keyPrefix}-${i}`
    if (it?.type === 'nodeLink') {
      return (
        <span key={key} className="text-violet-600">
          {it.props?.label ?? ''}
        </span>
      )
    }
    if (it?.type === 'text') {
      const s = it.styles || {}
      let node = it.text ?? ''
      if (s.bold) node = <strong>{node}</strong>
      if (s.italic) node = <em>{node}</em>
      return <span key={key}>{node}</span>
    }
    return null
  })
}

// Does this block carry any visible text? Used to skip empty paragraphs that
// would otherwise add dead vertical space to the preview.
function hasText(block) {
  const c = block?.content
  if (typeof c === 'string') return c.trim().length > 0
  if (!Array.isArray(c)) return false
  return c.some((it) => (it?.type === 'nodeLink') || (it?.text && it.text.length > 0))
}

function BlockLine({ block, idx }) {
  const inline = renderInline(block.content, `b${idx}`)

  switch (block?.type) {
    case 'heading':
      return <div className="font-semibold text-gray-700 text-xs leading-snug mt-1">{inline}</div>
    case 'bulletListItem':
      return (
        <div className="flex items-start gap-2 text-xs text-gray-700 leading-snug">
          <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
          <span className="min-w-0">{inline}</span>
        </div>
      )
    case 'numberedListItem':
      return (
        <div className="flex items-start gap-2 text-xs text-gray-700 leading-snug">
          <span className="text-gray-400 flex-shrink-0">•</span>
          <span className="min-w-0">{inline}</span>
        </div>
      )
    case 'quote':
      return <p className="border-l-2 border-gray-300 pl-2 italic text-xs text-gray-600 leading-snug">{inline}</p>
    case 'paragraph':
    default:
      return <p className="text-gray-500 text-xs leading-snug">{inline}</p>
  }
}

export default function BlockPreview({ blocks }) {
  const visible = Array.isArray(blocks)
    ? blocks.filter((b) => b?.type === 'heading' ? hasText(b) : (b?.type !== 'paragraph' || hasText(b)))
    : []

  if (visible.length === 0) {
    return <p className="text-gray-300 text-xs italic leading-snug">No content yet</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((b, i) => (
        <BlockLine key={i} block={b} idx={i} />
      ))}
    </div>
  )
}
