// ============================================================================
// QuickConnectButtons — the four per-side connection-creation buttons
// ----------------------------------------------------------------------------
// Rendered as children of CampaignNode's root div, absolutely positioned just
// outside each card edge. Being DOM children matters: the browser doesn't
// fire mouseleave on the card while the cursor is over a child element, even
// one positioned outside the card's box — so the "hover area expands to
// include the buttons" requirement comes free from DOM containment.
//
// NATIVE pointerdown listeners, not React synthetic ones: these buttons only
// ever render on a SELECTED node, which is exactly the case where RF v11's
// NodeWrapper breaks React's synthetic event delegation (see the NativeButton
// note in TextNode.jsx — same footgun, same workaround). stopPropagation
// keeps RF from treating the press as a node interaction, and a native click
// suppressor keeps a no-drag press from bubbling into onNodeClick (which
// would repoint an open Inspector).
//
// Sizing follows the connection-dot convention: flow-space values multiplied
// by `compensation` (1/zoom capped at 5 when zoomed out, 1 otherwise) so the
// buttons never render smaller than their base size on screen.
// ============================================================================

import { useEffect, useRef } from 'react'
import { Plus } from '@phosphor-icons/react'

const BUTTON_PX = 24       // ÷8 ✓ — base on-screen diameter
const GAP_PX    = 8        // ÷8 ✓ — clear space between card edge and button
const CTA_COLOR = '#0284C7' // system CTA (sky-600) — type-agnostic action

const SIDES = ['top', 'right', 'bottom', 'left']

function sidePosition(side, size, gap, cardWidth, cardHeight) {
  const cx = cardWidth / 2 - size / 2
  const cy = cardHeight / 2 - size / 2
  switch (side) {
    case 'top':    return { left: cx, top: -(gap + size) }
    case 'bottom': return { left: cx, top: cardHeight + gap }
    case 'left':   return { left: -(gap + size), top: cy }
    case 'right':  return { left: cardWidth + gap, top: cy }
    default:       return { left: cx, top: cy }
  }
}

function SideButton({ side, size, gap, cardWidth, cardHeight, onBeginConnect }) {
  const ref = useRef(null)
  const beginRef = useRef(onBeginConnect)
  beginRef.current = onBeginConnect

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onPointerDown = (e) => {
      // Press-and-hold starts the connection drag. preventDefault keeps the
      // browser from starting text selection / focus shifts; stopPropagation
      // keeps RF's node listeners (drag/select) out of it.
      e.preventDefault()
      e.stopPropagation()
      beginRef.current?.(e)
    }
    const onClick = (e) => {
      // A press with no drag still emits a click that would bubble to RF's
      // node handlers (selection toggles, Inspector repoint). Swallow it.
      e.preventDefault()
      e.stopPropagation()
    }
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('click', onClick)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('click', onClick)
    }
  }, [])

  const pos = sidePosition(side, size, gap, cardWidth, cardHeight)
  return (
    <button
      ref={ref}
      // nodrag/nopan: RF's supported opt-outs so a press on the button never
      // starts a node drag or canvas pan.
      className="nodrag nopan quick-connect-btn"
      title="Drag to connect"
      style={{
        position: 'absolute',
        left:   pos.left,
        top:    pos.top,
        width:  size,
        height: size,
        borderRadius: '50%',
        backgroundColor: CTA_COLOR,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'crosshair',
        zIndex: 11, // one above the connection dots (10)
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        // pointer-events deliberately NOT set: inherit from the node wrapper
        // so .is-panning (spacebar pan) makes the buttons inert with the
        // rest of the card.
      }}
    >
      {/* Icon scales with the button (16/24 of the diameter — base 16px). */}
      <Plus size={size * (16 / 24)} weight="bold" />
    </button>
  )
}

export default function QuickConnectButtons({ compensation, cardWidth, cardHeight, onBeginConnect }) {
  const size = BUTTON_PX * compensation
  const gap  = GAP_PX * compensation
  return (
    <>
      {SIDES.map((side) => (
        <SideButton
          key={side}
          side={side}
          size={size}
          gap={gap}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          onBeginConnect={onBeginConnect}
        />
      ))}
    </>
  )
}
