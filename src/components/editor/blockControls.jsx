// ============================================================================
// blockControls — MasterMind's custom block-editing affordances (Chunk F5a)
// ----------------------------------------------------------------------------
// BlockControlMenu — the menu that opens from the 6-dot drag handle, reorganized
// to satisfy the F5 objective (make editing affordances discoverable +
// understandable) and Erik's calls:  Turn into ▶  /  Duplicate  /  Delete.
// "Turn into" is the discoverability win: changing a block's type used to live
// only in the slash menu / floating toolbar; now it's on the handle you're
// already grabbing. The submenu lists BLOCK_TYPES (blockTypes.js).
//
// COLOR REMOVED (F5a): per-block color is gone from the 6-dot menu (we simply
// don't render BlockColorsItem here) and from the floating toolbar (hidden via
// CSS — inspectorEditor.css rule 10 — NOT a custom FormattingToolbarController,
// which is a suspected cause of the F5a editor crash). Rationale: users don't
// clearly need raw color yet, and user-stamped colors save into the document and
// won't adapt to a future dark mode. To RESTORE color: re-add a <BlockColorsItem>
// here, and delete CSS rule 10.
//
// We drive everything off the live `editor` + the hovered `block` rather than
// BlockNote's internal item context: the block comes from the side-menu
// extension state (the same reliable source F4 uses), and the editor is closed
// over from ZoneEditor. The menu UI is built from BlockNote's components context
// (Components.Generic.Menu.*), whose `sub` / `subTrigger` flags are BlockNote's
// own first-class nested-menu primitives — the same ones its color submenu uses.
// ============================================================================

import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { DragHandleMenu, useComponentsContext, useExtensionState } from '@blocknote/react'
import { SideMenuExtension } from '@blocknote/core'
import { BLOCK_TYPES } from './blockTypes.js'

// ── ControlTooltip — viewport-aware hover tooltip for the side-menu controls ──
// (F5a) BlockNote gives the +/6-dot buttons only an aria-label (no visible
// tooltip). We add one, but with two hard requirements learned the hard way:
//   • It must NEVER crash the editor — so NO Mantine component / no React context.
//     Just a plain React portal to <body>.
//   • It must NEVER be clipped by the window edge — so it's positioned with fixed
//     coords measured from the control and FLIPS above the control when there
//     isn't room below (a pure-CSS bubble couldn't do this and got cut off).
const TIP_DELAY_MS = 300
const TIP_GAP = 8 // px between the control and the bubble (8pt grid)
const TIP_MARGIN = 8 // min px the bubble keeps from any viewport edge

export function ControlTooltip({ label, children }) {
  const wrapRef = useRef(null)
  const timerRef = useRef(null)
  const [anchor, setAnchor] = useState(null) // { left, top, bottom } | null

  const hide = useCallback(() => {
    clearTimeout(timerRef.current)
    setAnchor(null)
  }, [])
  const show = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (r) setAnchor({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })
    }, TIP_DELAY_MS)
  }, [])
  // Clear a pending timer if the control unmounts mid-hover (BlockNote re-renders
  // the side menu as the pointer moves between blocks).
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <span
      ref={wrapRef}
      className="mm-tip"
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide} // dismiss on click/drag start
    >
      {children}
      {anchor && createPortal(<TipBubble anchor={anchor} label={label} />, document.body)}
    </span>
  )
}

function TipBubble({ anchor, label }) {
  const ref = useRef(null)
  // Render hidden first so we can measure the bubble, then place it before paint.
  const [style, setStyle] = useState({ left: 0, top: 0, visibility: 'hidden' })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    // Default: horizontally CENTERED on the control, just below it.
    const centerX = (anchor.left + anchor.right) / 2
    let top = anchor.bottom + TIP_GAP
    // Flip to centered ABOVE when there isn't room below the fold.
    if (top + height > window.innerHeight - TIP_MARGIN) {
      top = anchor.top - TIP_GAP - height
    }
    top = Math.max(TIP_MARGIN, Math.min(top, window.innerHeight - TIP_MARGIN - height))
    // Center, then shift left/right only as needed to stay within the window.
    let left = centerX - width / 2
    left = Math.max(TIP_MARGIN, Math.min(left, window.innerWidth - TIP_MARGIN - width))
    setStyle({ left, top, visibility: 'visible' })
  }, [anchor])
  return (
    <div ref={ref} role="tooltip" className="mm-tip__bubble" style={{ position: 'fixed', ...style }}>
      {label}
    </div>
  )
}

// ── 6-dot drag-handle menu: Turn into ▶ / Duplicate / Delete ─────────────────
export function BlockControlMenu({ editor }) {
  const Components = useComponentsContext()
  // The block the handle belongs to, straight from BlockNote's side-menu state.
  const block = useExtensionState(SideMenuExtension, { selector: (s) => s?.block })
  if (!Components || !block) return null

  const { Menu } = Components.Generic

  return (
    <DragHandleMenu>
      {/* Turn into ▶ — convert the current block to another type in place. */}
      <Menu.Root sub>
        <Menu.Trigger sub>
          <Menu.Item subTrigger>Turn into</Menu.Item>
        </Menu.Trigger>
        <Menu.Dropdown sub className="mm-menu-scroll">
          {BLOCK_TYPES.map((bt) => {
            const Icon = bt.icon
            return (
              <Menu.Item
                key={bt.key}
                icon={<Icon size={16} />}
                onClick={() => editor.updateBlock(block, { type: bt.type, props: bt.props })}
              >
                {bt.label}
              </Menu.Item>
            )
          })}
        </Menu.Dropdown>
      </Menu.Root>

      {/* Duplicate — insert a copy directly below. */}
      <Menu.Item
        onClick={() =>
          editor.insertBlocks(
            [{ type: block.type, props: block.props, content: block.content }],
            block,
            'after',
          )
        }
      >
        Duplicate
      </Menu.Item>

      {/* Delete — destructive: text + highlight turn light red on hover
          (.mm-danger-item, inspectorEditor.css rule 8). */}
      <Menu.Item className="mm-danger-item" onClick={() => editor.removeBlocks([block])}>
        Delete
      </Menu.Item>
    </DragHandleMenu>
  )
}
