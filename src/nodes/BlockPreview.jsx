// ============================================================================
// BlockPreview — lightweight read-only renderer for Card View block JSON
// ----------------------------------------------------------------------------
// Renders a card's Card View block document as static HTML on the canvas card
// (ADR-0016 §9). It is deliberately NOT a BlockNote editor instance — mounting
// an editor per card would not scale to hundreds of cards. It only needs to
// cover the block types that appear in a Card View zone (paragraph, heading,
// lists, checklist, quote/Callout); Image Album and Connections live in the GM
// zone and never reach here.
//
// Inline content renders text plus [[Node]] links (as colored, non-interactive
// spans). Styling is intentionally small/glanceable — this is a preview, not the
// editing surface — but it faithfully reflects the block TYPE a user chose
// (heading hierarchy, numbered ordinals, checkbox state, Callout box) so a glance
// re-immerses the GM (Chunk F5c).
//
// NUMBERED LISTS — intentional preview approximation, NOT a correctness risk.
// This preview is read-only and is NOT the export path: the canonical block JSON
// keeps BlockNote's full list structure (nesting via `children`, the `start`
// prop, interruptions), and future Markdown export serializes THAT document, not
// this component. So numbering here is computed positionally from top-level
// render order — counting consecutive `numberedListItem`s, resetting when a
// non-numbered block interrupts (correct list semantics), and seeding from the
// run's first item's `start` prop when set. Accepted limits (preview only):
//   • nested numbered items aren't rendered (BlockPreview is flat — a glance);
//   • numbering resets on interruption (matches BlockNote default; a user-set
//     `start` on a resumed item is honored via the seeding above).
// ============================================================================

import { Square, CheckSquare, Images } from '@phosphor-icons/react'
import { useImageUrl } from '../lib/useImageUrl'

// Parse the Image Album block's `props.images` (a JSON string of {path,...} or
// legacy string entries). Mirrors ImageAlbumBlock's parse; preview-only.
function parseImages(raw) {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

// Media Gallery preview (F5e): first image as a small thumbnail + a count, per
// Erik's call. Lives in its own component so the useImageUrl hook is called
// unconditionally (rules of hooks). Only Card View galleries reach the preview,
// and those are opt-in, so the per-card signed-URL load stays bounded.
function GalleryPreview({ block }) {
  const images = parseImages(block?.props?.images)
  const url = useImageUrl(images[0] ?? null, 'thumb')
  const n = images.length
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="w-8 h-8 rounded-[0.25rem] overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center flex-shrink-0">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <Images size={14} weight="fill" className="text-gray-400" />
        )}
      </div>
      <span className="text-gray-500 text-xs">
        {n} image{n === 1 ? '' : 's'}
      </span>
    </div>
  )
}

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

// `number` is the computed ordinal for a numberedListItem (else null); see the
// numbering note in the file header for why it's positional.
function BlockLine({ block, idx, number }) {
  const inline = renderInline(block.content, `b${idx}`)

  switch (block?.type) {
    case 'heading': {
      // On the tiny card, WEIGHT (not size) carries the hierarchy (Erik, F5c):
      // H1 = 900, H2 = 700. Body is normal-weight gray-500, so the three levels
      // read distinctly at a glance without zooming.
      const weight = block.props?.level === 1 ? 'font-black' : 'font-bold'
      return <div className={`${weight} text-gray-700 text-xs leading-snug mt-1`}>{inline}</div>
    }
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
          <span className="text-gray-400 flex-shrink-0 tabular-nums">{number ?? 1}.</span>
          <span className="min-w-0">{inline}</span>
        </div>
      )
    case 'checkListItem': {
      const checked = !!block.props?.checked
      const Box = checked ? CheckSquare : Square
      return (
        <div className="flex items-start gap-2 text-xs text-gray-700 leading-snug">
          <Box
            size={14}
            weight={checked ? 'fill' : 'regular'}
            className="mt-0.5 flex-shrink-0 text-gray-400"
          />
          <span className={`min-w-0 ${checked ? 'line-through text-gray-400' : ''}`}>{inline}</span>
        </div>
      )
    }
    case 'quote':
      // Callout — full box (faint surface + solid square-left bar + padding),
      // upright text, via the shared .mm-callout class. The 2px bar (vs the
      // inspector's 4px) comes from the .mm-block-preview scope override.
      return <div className="mm-callout text-xs text-gray-700 leading-snug">{inline}</div>
    case 'imageAlbum':
      // Media Gallery — first-image thumbnail + count (F5e).
      return <GalleryPreview block={block} />
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

  // Positional numbering for numbered lists (see file header). `run` holds the
  // current ordinal while inside a consecutive run of numberedListItems, or null
  // when not in one.
  let run = null
  const numbers = visible.map((b) => {
    if (b?.type !== 'numberedListItem') {
      run = null
      return null
    }
    run = run === null ? (typeof b.props?.start === 'number' ? b.props.start : 1) : run + 1
    return run
  })

  return (
    <div className="mm-block-preview flex flex-col gap-1.5">
      {visible.map((b, i) => (
        <BlockLine key={i} block={b} idx={i} number={numbers[i]} />
      ))}
    </div>
  )
}
