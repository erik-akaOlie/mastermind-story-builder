// ============================================================================
// FtuePreview — DEV-ONLY design-QA harness for the FTUE introduction
// ----------------------------------------------------------------------------
// Renders the REAL FtueIntro over the REAL BottomToolbar (real stores, real
// [data-ftue-target] measurement, real arrow geometry) on the canvas
// background color, with no auth and no Supabase — so the FTUE composition
// can be inspected and screenshotted at any viewport size without signing
// in or creating a workspace. Clicking the real toolbar buttons arms real
// tools, so the placement state is reachable too (Esc via the store reset
// button below).
//
// ISOLATION GUARANTEE: reachable only via the `#ftue-preview` hash route in
// main.jsx, which is gated on `import.meta.env.DEV`. Vite replaces that
// flag with the literal `false` in production builds, so the branch — and
// this lazily-imported module with it — is dead-code-eliminated from the
// shipped bundle entirely (same mechanism as the analytics chunk; verify
// with a dist grep for FTUE-PREVIEW-HARNESS). Not a route to protect: in
// production it does not exist.
// ============================================================================

import { useEffect, useState } from 'react'
import FtueIntro from '../components/FtueIntro.jsx'
import BottomToolbar from '../components/BottomToolbar.jsx'
import { useToolStore } from '../store/useToolStore'
import { DEFAULT_CANVAS_COLOR } from '../lib/canvasColor.js'

const MARKER = 'FTUE-PREVIEW-HARNESS'

export default function FtuePreview() {
  const activeTool = useToolStore((s) => s.activeTool)
  const setActiveTool = useToolStore((s) => s.setActiveTool)

  // Live viewport readout so every screenshot self-documents its size.
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div
      data-harness={MARKER}
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundColor: DEFAULT_CANVAS_COLOR }}
    >
      <FtueIntro visible />
      <BottomToolbar forceExpanded onUndo={() => {}} onRedo={() => {}} />
      {/* Harness chrome — top-right, outside the composition. */}
      <div className="fixed right-2 top-2 z-50 flex items-center gap-2 font-mono text-xs text-white/50">
        <span>{size.w}×{size.h}</span>
        <span>tool: {activeTool}</span>
        {activeTool !== 'pointer' && (
          <button
            className="rounded bg-white/10 px-2 py-1 text-white/70 hover:bg-white/20"
            onClick={() => setActiveTool('pointer')}
          >
            reset tool
          </button>
        )}
      </div>
    </div>
  )
}
