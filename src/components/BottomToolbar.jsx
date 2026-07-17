// ============================================================================
// BottomToolbar — bottom-center tool tray (approved first cut, 2026-07-10;
// geometry corrected to the 1:1 Figma values after Erik's first QA pass)
// ----------------------------------------------------------------------------
// Desktop model (Figma 225-1970, file is 1:1 pixels):
//   - An INVISIBLE 464×112 hotspot sits bottom-center. It never eats clicks:
//     hover detection is a document-level mousemove hit-test, so marquee/pan
//     can still start from the empty parts of that region while collapsed.
//   - Collapsed: a 64×52 tab (12px top radius) sits center-bottom of the
//     hotspot, holding a 32×32 sky chip DISPLAY of the effective tool — not
//     a button; mousing into the hotspot is what opens the tray.
//   - Expanded: the tab grows into the full 464×112 tray (16px top radius):
//     Pointer · Hand · divider · Node · Text Block · Line, 64px buttons.
//     The sky chip SLIDES from the tab into the active tool's slot while
//     the other icons fade in.
//   - The chip shows the EFFECTIVE tool, so a held spacebar flips it live.
//   - Tooltips are custom (styled pill above the tray) — native `title`
//     tooltips proved unreliable (~70% trigger rate in Erik's QA).
//
// Not to be confused with CanvasToolbar.jsx — that's the shared shell for
// FLOATING contextual toolbars (text-block formatting, multi-select align,
// line style), which are anchored to canvas elements.
//
// Chunk 2 (2026-07-15): creation tools are live one-shots — clicking Node /
// Text Block / Line arms the tool (placement itself lives in
// useOneShotPlacement + LinePlacementOverlay; both revert to Pointer after
// placing). The toolbar needs no z-index change to stay clickable while a
// tool is armed: placement intercepts only canvas-targeted clicks
// (.react-flow__pane), so tray clicks always reach the tray — switching
// tools or clicking Pointer/Hand disarms.
//
// Chunk 3 (2026-07-16): mobile PORTRAIT variant (useMobilePortrait — touch-
// primary AND portrait AND ≤640px; conservative by Erik's rule). Always
// visible, always expanded, creation tools ONLY (Node · Text Block · Line —
// Pointer/Hand excluded; the MB-1 touch model needs no visible mode). No
// hover machinery, no tooltips. Tapping the armed tool again disarms it —
// the mobile stand-in for Esc; the armed Line button carries
// data-placement-cancel so LinePlacementOverlay lets that tap through
// mid-gesture (the ONLY chrome press that can end a half-drawn line on
// touch). Touch-primary but NOT phone-portrait (tablets, landscape) still
// renders nothing — landscape is out of scope for the first cut.
//
// Geometry (Erik, QA pass 3, 2026-07-10 — final): rest tab 48×44 holding a
// 32×32 replica of the tool chip (8px left/right/top borders, 4px bottom).
// Expanded tray: height 72 (56+16 per Erik), everything rescaled then
// re-snapped to the 8→4→2 grid rule (a pure proportional scale gives a
// non-8-divisible width): 40px buttons with 20px icons at y=16, 8px gaps
// within a group, 16px padding and 16px around the zero-width divider →
// 288×72 total (all 8-divisible). Slots x = 16/64/136/184/232; divider
// 1×32 at x=120.
//
// Selection is an instant on/off — the sky chip does NOT slide between
// slots when a different tool is picked (that read as the toolbar
// reorganizing). The chip only animates during the tab⇄tray morph.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { Cursor, Hand, Article, TextT, ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react'
import { useToolStore, effectiveTool } from '../store/useToolStore'
import { useUndoStore } from '../store/useUndoStore'
import { LineToolIcon } from './CanvasContextMenu'
import { useTouchPrimary } from '../hooks/useTouchPrimary'
import { useMobilePortrait } from '../hooks/useMobilePortrait'
import {
  RESERVED_INSPECTOR_BAND_PX,
  RESERVED_RAIL_BAND_PX,
} from '../utils/viewportFraming.js'

const HOTSPOT_W = 288
const HOTSPOT_H = 72
const TAB_W = 48
const TAB_H = 44

// When the Inspector is DOCKED, the toolbar recenters in the display area —
// the band between the altitude rail (left) and the docked Inspector
// (right), same constants as the camera's centering rule (viewportFraming).
// Closed / undocked (a floating modal reserves nothing) → true window
// center, per Erik's rule (2026-07-10): the toolbar follows the Inspector
// live, unlike the camera, which reserves the band even when closed.
const DOCKED_SHIFT_PX = (RESERVED_INSPECTOR_BAND_PX - RESERVED_RAIL_BAND_PX) / 2  // 216
const BTN = 40          // expanded tool button / chip size
const CHIP = 32         // collapsed chip size (a smaller replica of the button)
const SLOT_X = { pointer: 16, hand: 64, node: 136, text: 184, line: 232 }
const BTN_Y = 16        // buttons' top inside the expanded tray
const TOOLTIP_DELAY_MS = 300

// Mobile-portrait tray (Chunk 3) — tuning constants, revised after Erik's
// phone QA round 1 (2026-07-16): 56px buttons read TOO LARGE in hand →
// 48px tap targets (the platform minimum, which QA showed is right for
// this tray) with 24px icons (desktop's 50% icon-to-button ratio), and
// padding tightened 16→8 so the tray is sleeker and gives height back to
// the graph. QA round 1 also added Undo/Redo (approved scope amendment):
// desktop-style divider right of the creation tools, then Undo · Redo,
// disabled until usable. All values 8-grid.
const M_BTN = 40  // FINAL per Erik's on-device QA-2 (2026-07-16): 8px around
                  // the 24px icon. Deliberately below the 44px guideline —
                  // felt perfect in hand (tested by the product's actual
                  // design target), and the flush layout means a grazed tap
                  // lands on a neighbor, not dead space. Don't "fix" this
                  // back to 44/48 without a new on-device pass.
const M_ICON = 24
const M_DIVIDER_GAP = 8   // breathing room each side of the divider ONLY —
                          // buttons themselves sit flush (Erik, QA-2 tuning:
                          // the 24px icons centered in 48px targets already
                          // give 24px of visual icon-to-icon space)
const M_PAD = 8
const M_CREATE_TOOLS = ['node', 'text', 'line']
// pad + creation group (flush) + (gap · divider · gap) + undo/redo group + pad
const M_TRAY_W =
  M_PAD * 2 +
  M_BTN * 3 +
  (M_DIVIDER_GAP + 1 + M_DIVIDER_GAP) +
  M_BTN * 2                                              // 273 (fits a 320px SE)
const M_TRAY_H = M_BTN + M_PAD * 2                       // 64
// FeedbackChipBar raises the feedback strip this far off the bottom on
// phones so toasts / save warnings are never covered by the always-present
// tray (tray height + the strip's usual 16px margin).
export const MOBILE_TRAY_CLEARANCE_PX = M_TRAY_H + 16    // 80

const INACTIVE_ICON = '#9ca3af'  // gray-400 on the dark tray

function iconFor(tool, active, size = 20) {
  const color = active ? '#ffffff' : INACTIVE_ICON
  switch (tool) {
    case 'pointer': return <Cursor size={size} weight="fill" color={color} />
    case 'hand':    return <Hand size={size} weight="fill" color={color} />
    case 'node':    return <Article size={size} weight="fill" color={color} />
    case 'text':    return <TextT size={size} weight="bold" color={color} />
    case 'line':    return <LineToolIcon size={size} color={color} />
    default:        return null
  }
}

const LABELS = {
  pointer: 'Pointer — drag to select',
  hand:    'Hand — drag to pan',
  node:    'Add node',
  text:    'Add text block',
  line:    'Add line',
}

const TOOL_ORDER = ['pointer', 'hand', 'node', 'text', 'line']

// The phone-portrait tray: always visible, always expanded — creation tools
// (Node · Text Block · Line), a desktop-style divider, then Undo · Redo
// (QA round 1 scope amendment: phones have no Ctrl+Z, and undo is
// trust-related). Selection state is a plain filled/unfilled swap (sky-600
// chip on the armed tool, nothing highlighted at rest — internally the tool
// is Pointer). Tapping the armed tool again disarms it (the mobile Esc).
// The armed Line button is marked data-placement-cancel so a tap on it can
// end a half-drawn line (LinePlacementOverlay lets exactly that press
// through mid-gesture). Undo/Redo enablement reads the SAME undo store the
// keyboard path uses — no separate mobile history; disabled = dimmed icon +
// disabled attr (initial load: both off; first edit enables Undo; an undo
// enables Redo). safe-area padding keeps the tray clear of the iOS
// home-indicator band.
function MobileCreationTray({ activeTool, setActiveTool, onUndo, onRedo }) {
  const canUndo = useUndoStore((s) => s.past.length > 0)
  const canRedo = useUndoStore((s) => s.future.length > 0)

  const historyButton = (label, Icon, enabled, onAction) => (
    <button
      type="button"
      aria-label={label}
      disabled={!enabled}
      onClick={onAction}
      className="flex items-center justify-center rounded-lg disabled:opacity-40"
      style={{ width: M_BTN, height: M_BTN }}
    >
      <Icon size={M_ICON} weight="bold" color={INACTIVE_ICON} />
    </button>
  )

  return (
    <div
      className="fixed bottom-0 left-1/2 z-40 -translate-x-1/2 select-none bg-white/10 backdrop-blur-sm"
      style={{
        width: M_TRAY_W,
        borderRadius: '12px 12px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center" style={{ padding: M_PAD }}>
        {M_CREATE_TOOLS.map((tool) => {
          const active = activeTool === tool
          return (
            <button
              key={tool}
              type="button"
              aria-label={LABELS[tool]}
              aria-pressed={active}
              data-placement-cancel={active && tool === 'line' ? '' : undefined}
              onClick={() => setActiveTool(active ? 'pointer' : tool)}
              className={`flex items-center justify-center rounded-lg ${
                active ? 'bg-sky-600' : ''
              }`}
              style={{ width: M_BTN, height: M_BTN }}
            >
              {iconFor(tool, active, M_ICON)}
            </button>
          )
        })}
        {/* Divider — same 1×32 white/20 rule as the desktop tray; it alone
            keeps breathing room (buttons sit flush) */}
        <div
          className="bg-white/20"
          style={{ width: 1, height: 32, margin: `0 ${M_DIVIDER_GAP}px` }}
        />
        {historyButton('Undo', ArrowUUpLeft, canUndo, onUndo)}
        {historyButton('Redo', ArrowUUpRight, canRedo, onRedo)}
      </div>
    </div>
  )
}

export default function BottomToolbar({ inspectorDocked = false, onUndo, onRedo }) {
  const touchPrimary = useTouchPrimary()
  const mobilePortrait = useMobilePortrait()
  const [expanded, setExpanded] = useState(false)
  const [tooltip, setTooltip] = useState(null)  // { label, centerX } | null
  const hotspotRef = useRef(null)
  const tooltipTimerRef = useRef(null)

  const activeTool = useToolStore((s) => s.activeTool)
  const spacebarHeld = useToolStore((s) => s.spacebarHeld)
  const placementGestureActive = useToolStore((s) => s.placementGestureActive)
  const setActiveTool = useToolStore((s) => s.setActiveTool)
  // Mid-placement-gesture the spacebar is a no-op, so the chip must not
  // flip to Hand while a half-drawn line is on the cursor.
  const shownTool = effectiveTool(activeTool, spacebarHeld, placementGestureActive)

  // Hover detection WITHOUT a click-eating overlay: hit-test the hotspot
  // rect on document mousemove. The wrapper is pointer-events-none, so while
  // collapsed even the visible tab passes clicks through to the canvas (it's
  // a display, not a button); once expanded, the tray itself is a normal
  // interactive surface. A held primary button suppresses OPENING so a
  // marquee/pan drag passing through the hotspot doesn't pop the tray open.
  useEffect(() => {
    if (touchPrimary) return
    const onMove = (e) => {
      const el = hotspotRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const inside =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom
      setExpanded((prev) => {
        if (!prev && inside && e.buttons & 1) return prev  // mid-drag: don't pop open
        return inside
      })
    }
    const onLeaveWindow = () => setExpanded(false)
    document.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeaveWindow)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeaveWindow)
    }
  }, [touchPrimary])

  useEffect(() => {
    if (!expanded) setTooltip(null)
  }, [expanded])
  useEffect(() => () => clearTimeout(tooltipTimerRef.current), [])

  // The chip animates ONLY while the tab⇄tray morph is in flight — i.e. on
  // the render where `expanded` flipped. A tool switch while expanded moves
  // it instantly (Erik, QA pass 3: a sliding highlight reads as the toolbar
  // reorganizing rather than a selection change).
  const prevExpandedRef = useRef(expanded)
  const morphing = prevExpandedRef.current !== expanded
  useEffect(() => { prevExpandedRef.current = expanded }, [expanded])

  // Phone portrait → the always-expanded creation tray (Chunk 3). Other
  // touch-primary contexts (tablets, phone landscape) still get nothing —
  // landscape is out of scope for the first cut.
  if (mobilePortrait) {
    return (
      <MobileCreationTray
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onUndo={onUndo}
        onRedo={onRedo}
      />
    )
  }
  if (touchPrimary) return null

  const showTooltipFor = (tool) => {
    clearTimeout(tooltipTimerRef.current)
    tooltipTimerRef.current = setTimeout(() => {
      setTooltip({ label: LABELS[tool], centerX: SLOT_X[tool] + BTN / 2 })
    }, TOOLTIP_DELAY_MS)
  }
  const hideTooltip = () => {
    clearTimeout(tooltipTimerRef.current)
    setTooltip(null)
  }

  // Chip (tray-relative): centered in the tab when collapsed (8px top, 4px
  // bottom border), the active tool's slot when expanded. During the morph
  // the tray box and the chip transition together, so the chip reads as
  // sliding into its slot.
  const chip = expanded
    ? { left: SLOT_X[shownTool], top: BTN_Y, size: BTN }
    : { left: (TAB_W - CHIP) / 2, top: 8, size: CHIP }

  return (
    <div
      ref={hotspotRef}
      className="pointer-events-none fixed bottom-0 z-40 -translate-x-1/2 select-none transition-[left] duration-200 ease-out"
      style={{
        width: HOTSPOT_W,
        height: HOTSPOT_H,
        left: inspectorDocked ? `calc(50% - ${DOCKED_SHIFT_PX}px)` : '50%',
      }}
    >
      {/* Custom tooltip — above the tray, outside its overflow clip */}
      {tooltip && (
        <div
          className="absolute rounded bg-gray-900 px-2 py-1 text-xs whitespace-nowrap text-white"
          style={{ left: tooltip.centerX, bottom: HOTSPOT_H + 8, transform: 'translateX(-50%)' }}
        >
          {tooltip.label}
        </div>
      )}

      {/* Tab ⇄ tray (the only visible surface; interactive only when expanded) */}
      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 overflow-hidden bg-white/10 backdrop-blur-sm transition-all duration-200 ease-out ${
          expanded ? 'pointer-events-auto' : ''
        }`}
        style={{
          width: expanded ? HOTSPOT_W : TAB_W,
          height: expanded ? HOTSPOT_H : TAB_H,
          borderRadius: '12px 12px 0 0',
        }}
      >
        {/* Tool buttons + divider — fade in as the tray grows */}
        <div
          className={`absolute inset-0 transition-opacity duration-150 ${
            expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {TOOL_ORDER.map((tool) => {
            const active = shownTool === tool
            return (
              <button
                key={tool}
                type="button"
                aria-label={LABELS[tool]}
                aria-pressed={active}
                onClick={() => setActiveTool(tool)}
                onMouseEnter={() => showTooltipFor(tool)}
                onMouseLeave={hideTooltip}
                className={`absolute flex items-center justify-center rounded-lg transition-colors ${
                  active ? '' : 'hover:bg-white/10'
                }`}
                style={{ left: SLOT_X[tool], top: BTN_Y, width: BTN, height: BTN }}
              >
                {/* The floating chip carries the active tool's icon */}
                <span className={active ? 'opacity-0' : ''}>{iconFor(tool, active)}</span>
              </button>
            )
          })}
          <div
            className="absolute bg-white/20"
            style={{ left: 120, top: (HOTSPOT_H - 32) / 2, width: 1, height: 32 }}
          />
        </div>

        {/* Sky chip — display-only; pointer-events-none so the button
            underneath gets hover/clicks. Transitions ONLY while the
            tab⇄tray morph is in flight; a tool switch snaps instantly. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute flex items-center justify-center rounded-lg bg-sky-600 ${
            morphing ? 'transition-all duration-200 ease-out' : ''
          }`}
          style={{
            left: chip.left,
            top: chip.top,
            width: chip.size,
            height: chip.size,
          }}
        >
          <span
            className={`flex items-center justify-center ${
              morphing ? 'transition-transform duration-200 ease-out' : ''
            }`}
            style={{ transform: expanded ? 'scale(1)' : 'scale(0.8)' }}
          >
            {iconFor(shownTool, true)}
          </span>
        </span>
      </div>
    </div>
  )
}
