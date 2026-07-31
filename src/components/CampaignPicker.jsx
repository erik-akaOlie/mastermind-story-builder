// ============================================================================
// CampaignPicker (file name retained as the user-facing surface for V1)
// ----------------------------------------------------------------------------
// Landing screen after sign-in. Shows existing workspaces as a gallery grid
// and lets the user open one, rename one, delete one, or create a new one.
//
// File name keeps "Campaign" because it's still the user-facing surface for
// the D&D-positioned product. When the surface itself gets a generic name,
// this file follows. See ADR-0012.
//
// Layout: responsive tile grid (cover thumbnail + name + description). Primary
// click anywhere on a tile opens that workspace; rename/delete live in a
// secondary "…" actions menu so the destructive path stays out of the way.
// Uses Phosphor icons + sky-600 CTA per CLAUDE.md conventions.
// ============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Plus,
  PencilSimple,
  Trash,
  WarningCircle,
  DotsThree,
  Image as ImageIcon,
  X,
} from '@phosphor-icons/react'
import { useWorkspace } from '../lib/WorkspaceContext.jsx'
import UserAvatar from './UserAvatar.jsx'
import WorkspaceThumbnail from './WorkspaceThumbnail.jsx'
import WorkspaceSortMenu from './WorkspaceSortMenu.jsx'
import { readSortId, writeSortId, sortWorkspaces } from '../lib/workspaceSort.js'
import { useIsNarrowViewport } from '../hooks/useIsNarrowViewport.js'
import { handArrowPathWavy, arrowheadPath } from '../lib/handDrawn.js'
import { UploadImageProvider, useUploadImage } from './UploadImageProvider.jsx'
import { workspaceCoverPipeline, deleteCardImage } from '../lib/imageStorage.js'
import {
  listWorkspacesWithActivity,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from '../lib/workspaces.js'

// System CTA blue (Tailwind sky-600), per CLAUDE.md's hard rule that all
// card-type-agnostic action buttons use this exact value. The Figma mockup
// renders this control in #3982c2; we use the system token for consistency
// with the rest of the app — swap here if the Figma blue is intentional.
const CTA_COLOR = '#0284C7'

// Closed-state width of the "New workspace" pill, in px. The control morphs
// from this fixed width to 100% when it opens (auto width can't transition).
// 8pt grid: 152 / 8 = 19.
const NEW_BTN_WIDTH = 152

// Public entry: wrap the picker in UploadImageProvider so per-tile cover
// uploads can open the shared Upload Image modal (mirrors Profile.jsx).
// `previewEmpty` is DEV-ONLY (honored only when import.meta.env.DEV, so it is
// statically false in production builds): the #empty-picker-preview harness
// route passes it to render the real empty-library state without an account
// that has zero workspaces. See main.jsx.
export default function CampaignPicker({ previewEmpty = false }) {
  return (
    <UploadImageProvider>
      <CampaignPickerInner previewEmpty={previewEmpty} />
    </UploadImageProvider>
  )
}

function CampaignPickerInner({ previewEmpty: previewEmptyProp = false }) {
  // Dev-only escape hatch — a production build can never enter preview mode.
  const previewEmpty = import.meta.env.DEV && previewEmptyProp
  const { setActiveWorkspaceId } = useWorkspace()
  const upload = useUploadImage()

  // MB-4: phone-narrow viewports get their own top-band layout (stacked sort,
  // in-place input morph, slide-down action row) + tighter page top padding.
  // Desktop keeps the original design untouched.
  const narrow = useIsNarrowViewport()

  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // "new workspace" form state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  // Narrow-band sort visibility (MB-4): opening the create flow hides the
  // sort control IMMEDIATELY (the user has declared "new workspace" intent —
  // the input sweeps across the full row). On cancel, the input retracts
  // first (300ms, matching the width transition) and only then does the sort
  // return, so the two never fight over the same space mid-animation.
  const [showSortNarrow, setShowSortNarrow] = useState(true)
  useEffect(() => {
    if (creating) {
      setShowSortNarrow(false)
      return
    }
    const t = setTimeout(() => setShowSortNarrow(true), 300)
    return () => clearTimeout(t)
  }, [creating])

  // inline rename state
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  // open actions menu (one at a time)
  const [menuOpenId, setMenuOpenId] = useState(null)

  // sort selection (client-side over the fetched rows; remembered in localStorage)
  const [sortId, setSortId] = useState(readSortId)
  function changeSort(id) {
    setSortId(id)
    writeSortId(id)
  }

  // ref to focus the name field the moment the create control opens
  const newNameRef = useRef(null)

  function openCreate() {
    setCreating(true)
    // The input is always mounted (just width-clipped while closed), so a
    // post-paint focus lands cleanly as the reveal animates open.
    requestAnimationFrame(() => newNameRef.current?.focus())
  }

  function cancelCreate() {
    setCreating(false)
    setNewName('')
  }

  const refresh = useCallback(async () => {
    setError(null)
    if (previewEmpty) {
      // Harness mode: skip the fetch and render the real zero-workspace state.
      setWorkspaces([])
      setLoading(false)
      return
    }
    try {
      const rows = await listWorkspacesWithActivity()
      setWorkspaces(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [previewEmpty])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    // HARNESS GUARD (2026-07-31): the #empty-picker-preview harness is
    // look-only BY CONSTRUCTION — the real persistence path is unreachable
    // in preview mode, not merely undocumented. Without this, a viewer with
    // a live session created REAL workspace rows the harness UI could never
    // show or navigate to (Erik's Android QA found exactly that).
    if (previewEmpty) {
      setError('Design-QA harness — workspace creation is disabled here. Use the real picker to create workspaces.')
      setNewName('')
      setCreating(false)
      return
    }
    setError(null)
    try {
      const { workspace } = await createWorkspace(newName)
      setNewName('')
      setCreating(false)
      await refresh()
      // Auto-enter the workspace you just created.
      setActiveWorkspaceId(workspace.id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRename(id) {
    if (!renameValue.trim()) {
      setRenamingId(null)
      return
    }
    setError(null)
    try {
      await updateWorkspace(id, { name: renameValue.trim() })
      setRenamingId(null)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id, name) {
    const ok = confirm(
      `Delete "${name}"? This permanently removes all cards, connections, and notes in this workspace.`
    )
    if (!ok) return
    setError(null)
    try {
      await deleteWorkspace(id)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  function startRename(c) {
    setMenuOpenId(null)
    setRenamingId(c.id)
    setRenameValue(c.name)
  }

  // Open the shared Upload Image modal in workspace-cover mode (16:9). The
  // modal handles all storage I/O via the injected pipeline, including
  // deleting the previous cover's variants on replace. We only patch the
  // cover_image_url column and refresh the list.
  function openCoverModal(c) {
    setMenuOpenId(null)
    upload.open({
      mode: 'workspace-cover',
      pipeline: workspaceCoverPipeline({ workspaceId: c.id }),
      existingImage: c.cover_image_url ?? undefined,
      onSave: async (newPath) => {
        try {
          await updateWorkspace(c.id, { cover_image_url: newPath })
          await refresh()
        } catch (err) {
          setError(err.message)
        }
      },
      onRemove: async () => {
        try {
          await updateWorkspace(c.id, { cover_image_url: null })
          await refresh()
        } catch (err) {
          setError(err.message)
        }
      },
    })
  }

  // One-click cover removal straight from the menu (no modal). Null the column
  // first so the tile falls back to its placeholder immediately, then
  // best-effort delete the storage variants (orphan cleanup reaps any leftover).
  async function removeCover(c) {
    setMenuOpenId(null)
    if (!c.cover_image_url) return
    setError(null)
    try {
      await updateWorkspace(c.id, { cover_image_url: null })
      await refresh()
      try {
        await deleteCardImage(c.cover_image_url)
      } catch (err) {
        console.error('Failed to delete old cover', err)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const isEmpty = !loading && workspaces.length === 0

  return (
    <div className={`min-h-screen bg-gray-50 ${narrow ? 'pt-6' : 'pt-12'} pb-12 px-4`}>
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">MasterMind</h1>
            <p className="text-sm text-gray-500 mt-1">Your story builder.</p>
          </div>
          <UserAvatar />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
            <WarningCircle size={16} weight="fill" className="flex-shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        {/* New-workspace control. DESKTOP branch (the narrow branch below has
            its own comment): a secondary-button frame (white fill, blue
            border) atop the grid that morphs by growing in width + height into
            the full-width "name your workspace" frame; the SAME frame persists,
            only its size and interior change. Input + Cancel + Create
            materialize inside once it's grown; Cancel fades the interior out
            first, then the frame collapses back to the button. A container-
            morph cousin of the search/breadcrumb reveal.

            The control lives in a fixed-height band (h-14, the OPEN height) so
            the frame can grow within it without ever shifting the grid down.
            Closed, the shorter button sits centered in the band, leaving a
            little more air above the grid; open, the frame fills the band,
            leaving less — matching the Figma spacing. */}
        {/* z-20 lifts the whole band (and the sort dropdown that overhangs into
            the grid) above the tile grid below it. */}
        {narrow ? (
          // MB-4 phone layout (Erik's design, 2026-07-05) — no fixed-height
          // band, no full-width sweep. The stacked sort control sits left and
          // STAYS visible while creating; the New-workspace pill sits right
          // and morphs IN PLACE into the name input; a Cancel/Create action
          // row slides open beneath the row, pushing the gallery down.
          <div className="relative z-20 mb-4">
            {/* items-end: the sort control bottom-aligns with the pill. */}
            <div className="flex items-end gap-4">
              {workspaces.length > 1 && showSortNarrow && (
                <WorkspaceSortMenu sortId={sortId} onChange={changeSort} stacked />
              )}

              <form
                id="new-workspace-form"
                onSubmit={handleCreate}
                className="flex-1 min-w-0 flex justify-end"
              >
                {/* The morphing frame: closed = "+ New workspace" pill; open =
                    the name input filling the same 40px bar. */}
                <div
                  className="relative h-10 overflow-hidden rounded-lg border bg-white shadow-sm"
                  style={{
                    width: creating ? '100%' : `${NEW_BTN_WIDTH}px`,
                    borderColor: CTA_COLOR,
                    transitionProperty: 'width',
                    transitionDuration: '300ms',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {/* Closed layer — "+ New workspace". Secondary treatment
                      normally; promoted to the PRIMARY treatment (sky fill,
                      white text — same as Create) when the library is empty,
                      so the one next action reads as the one next action. */}
                  <button
                    type="button"
                    onClick={openCreate}
                    data-empty-guide-target
                    tabIndex={creating ? -1 : 0}
                    aria-hidden={creating}
                    className={`absolute inset-0 flex items-center justify-center gap-1 rounded-lg ${
                      isEmpty ? 'hover:brightness-95' : 'hover:bg-sky-50'
                    }`}
                    style={{
                      color: isEmpty ? '#ffffff' : CTA_COLOR,
                      backgroundColor: isEmpty ? CTA_COLOR : undefined,
                      opacity: creating ? 0 : 1,
                      pointerEvents: creating ? 'none' : 'auto',
                      transition: 'opacity 150ms ease',
                      transitionDelay: creating ? '0ms' : '160ms',
                    }}
                  >
                    <Plus size={16} weight="bold" />
                    <span className="text-xs font-medium whitespace-nowrap">
                      New workspace
                    </span>
                  </button>

                  {/* Open layer — the name input. text-base (16px) so mobile
                      Safari doesn't auto-zoom into the focused field. */}
                  <div
                    className="absolute inset-0 flex items-center px-4"
                    style={{
                      opacity: creating ? 1 : 0,
                      pointerEvents: creating ? 'auto' : 'none',
                      transition: 'opacity 180ms ease',
                      transitionDelay: creating ? '160ms' : '0ms',
                    }}
                  >
                    <input
                      ref={newNameRef}
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') cancelCreate()
                      }}
                      placeholder="Name your workspace…"
                      aria-label="Workspace name"
                      tabIndex={creating ? 0 : -1}
                      className="w-full min-w-0 bg-transparent outline-none text-base font-light text-gray-900 placeholder-gray-500"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Action row — slides open beneath the input (CSS grid 0fr↔1fr,
                the HoverReveal pattern), pushing the gallery down. */}
            <div
              className="grid"
              style={{
                gridTemplateRows: creating ? '1fr' : '0fr',
                transition: 'grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <div className="overflow-hidden">
                <div className="flex items-center justify-end gap-4 pt-2">
                  <button
                    type="button"
                    onClick={cancelCreate}
                    tabIndex={creating ? 0 : -1}
                    className="text-base font-light text-gray-600 hover:text-gray-900 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="new-workspace-form"
                    tabIndex={creating ? 0 : -1}
                    className="flex items-center justify-center h-10 px-4 rounded-lg text-base font-bold text-white whitespace-nowrap transition-[filter] hover:brightness-95"
                    style={{ backgroundColor: CTA_COLOR }}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="relative z-20 h-14 mb-4">
          {/* Sort control — left side, baseline-aligned to the BASE of the
              New workspace button (its bottom edge). The closed button is a
              40px pill centered in the 56px band, so its base sits ~6px above
              the band bottom; bottom-1.5 + leading-none lands the sort text's
              baseline on that line. Hidden while creating (the expanding name
              frame sweeps across the row) and when there's nothing to sort. */}
          {workspaces.length > 1 && !creating && (
            <div className="absolute left-0 bottom-1.5">
              <WorkspaceSortMenu sortId={sortId} onChange={changeSort} />
            </div>
          )}

          <form
            onSubmit={handleCreate}
            className="absolute right-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-white shadow-sm"
            style={{
              width: creating ? '100%' : `${NEW_BTN_WIDTH}px`,
              height: creating ? '3.5rem' : '2.5rem', // 56 / 40
              borderColor: CTA_COLOR,
              transitionProperty: 'width, height',
              transitionDuration: '300ms',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
              // Open: grow immediately. Close: hold until the interior has faded.
              transitionDelay: creating ? '0ms' : '140ms',
            }}
          >
            {/* Closed layer — "+ New workspace". Secondary treatment normally;
                promoted to the PRIMARY treatment (sky fill, white text — same
                as Create) when the library is empty, so the one next action
                reads as the one next action. */}
            <button
              type="button"
              onClick={openCreate}
              data-empty-guide-target
              tabIndex={creating ? -1 : 0}
              aria-hidden={creating}
              className={`absolute inset-0 flex items-center justify-center gap-1 rounded-lg ${
                isEmpty ? 'hover:brightness-95' : 'hover:bg-sky-50'
              }`}
              style={{
                color: isEmpty ? '#ffffff' : CTA_COLOR,
                backgroundColor: isEmpty ? CTA_COLOR : undefined,
                opacity: creating ? 0 : 1,
                pointerEvents: creating ? 'none' : 'auto',
                transition: 'opacity 150ms ease',
                // Open: fade out fast. Close: fade back in after the frame shrinks.
                transitionDelay: creating ? '0ms' : '160ms',
              }}
            >
              <Plus size={16} weight="bold" />
              <span className="text-xs font-medium whitespace-nowrap">
                New workspace
              </span>
            </button>

            {/* Open layer — name field + Cancel + Create. */}
            <div
              className="absolute inset-0 flex items-center justify-end gap-6 pl-4 pr-2"
              style={{
                opacity: creating ? 1 : 0,
                pointerEvents: creating ? 'auto' : 'none',
                transition: 'opacity 180ms ease',
                // Open: materialize after the frame has grown. Close: fade out fast.
                transitionDelay: creating ? '160ms' : '0ms',
              }}
            >
              <input
                ref={newNameRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelCreate()
                }}
                placeholder="Name your workspace…"
                aria-label="Workspace name"
                tabIndex={creating ? 0 : -1}
                className="flex-1 min-w-0 bg-transparent outline-none text-base font-light text-gray-900 placeholder-gray-500 whitespace-nowrap"
              />
              <button
                type="button"
                onClick={cancelCreate}
                tabIndex={creating ? 0 : -1}
                className="shrink-0 text-base font-light text-gray-600 hover:text-gray-900 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                tabIndex={creating ? 0 : -1}
                className="shrink-0 flex items-center justify-center h-10 px-4 rounded-lg text-base font-bold text-white whitespace-nowrap transition-[filter] hover:brightness-95"
                style={{ backgroundColor: CTA_COLOR }}
              >
                Create
              </button>
            </div>
          </form>
        </div>
        )}

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortWorkspaces(workspaces, sortId).map((c) => (
              <WorkspaceTile
                key={c.id}
                workspace={c}
                isRenaming={renamingId === c.id}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                onRenameCommit={() => handleRename(c.id)}
                onRenameCancel={() => setRenamingId(null)}
                menuOpen={menuOpenId === c.id}
                onToggleMenu={() =>
                  setMenuOpenId((cur) => (cur === c.id ? null : c.id))
                }
                onCloseMenu={() => setMenuOpenId(null)}
                onOpen={() => setActiveWorkspaceId(c.id)}
                onStartRename={() => startRename(c)}
                onSetCover={() => openCoverModal(c)}
                onRemoveCover={() => removeCover(c)}
                onDelete={() => {
                  setMenuOpenId(null)
                  handleDelete(c.id, c.name)
                }}
              />
            ))}
          </div>
        )}

        {/* Empty-library guidance — the handwritten FTUE voice on the picker.
            Unmounted while the create flow is open: the arrow must never
            point at a control that has morphed into something else. */}
        {isEmpty && !creating && <EmptyLibraryGuide narrow={narrow} />}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// EmptyLibraryGuide — the zero-workspace state (Erik's mockup, 2026-07-30).
// ----------------------------------------------------------------------------
// A continuation of the FTUE's handwritten instructional language: one Caveat
// sentence, comfortably centered in the empty gallery area, with a hand-drawn
// arrow whose tail leaves the text and whose head points at the + New
// workspace control. The text and arrow are ONE COMPOSITION — the spec is the
// relationship (instruction → control), not pixel positions, so everything is
// computed from live measurements and recomputed on resize.
//
// Product requirements (Erik + review, 2026-07-30):
//  - Visual balance over mathematical centering: the message centers in the
//    AVAILABLE empty space with a slight upward optical bias, not in the
//    whole viewport.
//  - The arrow appears only when it clearly reinforces the instruction; in
//    constrained spaces the text stands alone (it is written to).
//  - Colors are the light-surface adaptation of the FTUE's white-on-canvas
//    strokes: text gray-400, arrow gray-300.
// ----------------------------------------------------------------------------

// Vertical room below which the guide stops trying to center and just sits.
const GUIDE_MIN_HEIGHT = 160
// Fraction of the available height reserved below the message — biases the
// optical center slightly ABOVE the mathematical center (the header band
// carries visual weight; true centering reads low).
const GUIDE_OPTICAL_BIAS = 0.12
// Breathing room at BOTH ends of the arrow — tail-to-text and head-to-button
// (Erik, 2026-07-30: the arrow bridges a relationship between two elements,
// so it must feel equally related to both; on a spacious layout, equalize by
// moving the head AWAY from the button, never the tail closer). The gap is a
// LADDER, not a constant: prefer the generous value, and on cramped
// viewports compress BOTH ends together before giving up the arrow — the
// balance invariant is equality, not 32px (Erik's Android landscape is
// 617×290 CSS px: the 32px gaps missed the top form by 2px and the right
// form by 7px; 24px fits comfortably).
const GUIDE_END_GAPS = [32, 24, 16]
// Minimum clear runs for an attachment form to read as a gesture. The rise
// minimum is deliberately SHALLOW (48, not the 96 first shipped): a
// landscape phone leaves only ~56px of rise, and the requirement is
// adapt-before-remove — a shallow sweep that clearly bridges text → button
// beats no arrow (Erik, Android landscape QA 2026-07-30). Below these the
// arrow truly has no room in any form (the only case the text stands alone).
const GUIDE_MIN_RISE = 48
const GUIDE_MIN_RUN_X = 48
// Available heights below this render the compact type scale (the narrow
// sizes) even on desktop-width layouts — short viewports (landscape phones,
// short desktop windows) can't fit the full-size text AND leave the arrow
// room to communicate. 8pt: 320 = 40×8.
const GUIDE_COMPACT_BELOW = 320

// Pure (exported for tests): the arrow's anchors from the two measured rects.
// Design rule (Erik, 2026-07-30): the arrow is instructional language, not
// decoration — when its preferred form no longer fits, ADAPT the presentation
// before removing the instruction. The tail is attached to the INSTRUCTION,
// not to any particular edge of it:
//   1. Preferred: tail off the text's RIGHT edge, sweeping up to the button.
//   2. Adapted:  tail off the text's TOP edge (biased toward the button's
//      side), rising to the button — for layouts where the button no longer
//      sits meaningfully to the right (e.g. phone widths).
//   3. Last resort (no vertical room in any form, or an anchor is
//      unmeasurable): null — the text stands alone; it's written to.
// Every form keeps both invariants: `startDir` points straight OUT of the
// text block, so the tail's tangent extended backward intersects the
// instruction (the arrow visibly emerges from the message); the head backs
// off the button by the same GUIDE_END_GAP as the tail, aimed at its center.
export function emptyGuideArrowGeometry(textRect, btnRect) {
  if (!textRect || !btnRect || btnRect.width === 0) return null
  const btnCx = btnRect.left + btnRect.width / 2
  const aim = { x: btnCx, y: btnRect.top + btnRect.height / 2 }

  // Outer loop: the gap ladder — each rung keeps BOTH ends equal; inner
  // order: preferred form first at each rung. A generous top-form arrow
  // beats a compressed right-form one, so the rung (visual quality) is the
  // outer axis, the form the inner.
  for (const gap of GUIDE_END_GAPS) {
    const tip = { x: btnCx, y: btnRect.bottom + gap }

    // Form 1 — right-edge attachment, departing horizontally out of the text.
    const rightTail = {
      x: textRect.right + gap,
      y: textRect.top + textRect.height * 0.35,
    }
    if (btnCx - rightTail.x >= GUIDE_MIN_RUN_X && rightTail.y - tip.y >= GUIDE_MIN_RISE) {
      return { tail: rightTail, tip, aim, startDir: { x: 1, y: 0 }, attach: 'right', gap }
    }

    // Form 2 — top-edge attachment, departing straight up out of the text,
    // from the side of the block nearer the button.
    const frac = btnCx >= textRect.left + textRect.width / 2 ? 0.65 : 0.35
    const topTail = {
      x: textRect.left + textRect.width * frac,
      y: textRect.top - gap,
    }
    if (topTail.y - tip.y >= GUIDE_MIN_RISE) {
      return { tail: topTail, tip, aim, startDir: { x: 0, y: -1 }, attach: 'top', gap }
    }
  }

  return null
}

function EmptyLibraryGuide({ narrow }) {
  const wrapRef = useRef(null)
  const textRef = useRef(null)
  const [avail, setAvail] = useState(null)
  const [arrow, setArrow] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const remeasure = () => setTick((n) => n + 1)
    window.addEventListener('resize', remeasure)
    // Cramped viewports can scroll the page; the arrow overlay is fixed, so
    // its anchors must follow the scrolled elements.
    window.addEventListener('scroll', remeasure, { passive: true })
    // Caveat loading changes the text block's metrics after first paint —
    // re-measure when the webfonts settle (plus a delayed second pass as
    // cheap insurance, mirroring FtueIntro).
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(remeasure)
    }
    const t = setTimeout(remeasure, 300)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure)
    }
  }, [])

  // Pass 1: how much vertical room the guide owns (its top edge → viewport
  // bottom, minus the page's pb-12). Layout effect so the height applies
  // before paint.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top
    setAvail(Math.max(GUIDE_MIN_HEIGHT, window.innerHeight - top - 48))
  }, [narrow, tick])

  // Pass 2 (after the measured height applies): compute the arrow from the
  // live text + button rects via the pure geometry/clarity-gate helper.
  useLayoutEffect(() => {
    if (avail == null) return
    const text = textRef.current?.getBoundingClientRect() ?? null
    const btn = document
      .querySelector('[data-empty-guide-target]')
      ?.getBoundingClientRect() ?? null
    setArrow(emptyGuideArrowGeometry(text, btn))
  }, [avail, narrow, tick])

  // Compact type scale: narrow viewports (width-driven) and short ones
  // (height-driven, measured available space) share the same stepped-down
  // sizes; the 2:1 hierarchy holds in every case.
  const compact = narrow || (avail != null && avail < GUIDE_COMPACT_BELOW)

  return (
    <>
      <div
        ref={wrapRef}
        className="flex items-center justify-center"
        style={{
          height: avail ?? 320,
          // border-box: padding eats into the height, lifting the flex
          // center by half the bias — the optical placement.
          paddingBottom: (avail ?? 320) * GUIDE_OPTICAL_BIAS,
        }}
      >
        {/* The line break is INTENTIONAL, never responsive (Erik, 2026-07-30):
            the action dominates ("Add a new workspace", 2× size) and the
            second line answers why ("to get started"). The 2:1 hierarchy
            holds at every breakpoint; only the absolute sizes step down —
            for narrow viewports (line 1 must fit 375px) AND for short ones
            (landscape phones / short windows: full-size text leaves the
            arrow no room to communicate — the compact scale frees it). */}
        <p
          ref={textRef}
          className="font-hand leading-hand text-center text-gray-400 select-none"
        >
          <span className="block" style={{ fontSize: compact ? 40 : 80 }}>
            Add a new workspace
          </span>
          <span className="block" style={{ fontSize: compact ? 20 : 40 }}>
            to get started
          </span>
        </p>
      </div>
      {arrow && (
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 w-full h-full z-10"
        >
          <g
            stroke="#d1d5db"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          >
            <path d={handArrowPathWavy(arrow.tail, arrow.tip, 40, arrow.aim, arrow.startDir)} />
            <path d={arrowheadPath(arrow.tail, arrow.tip, 40, 14, arrow.aim)} />
          </g>
        </svg>
      )}
    </>
  )
}

// ----------------------------------------------------------------------------
// A single workspace tile. Owns its own cover-URL resolution (per-tile hook)
// so a null cover falls back to a polished placeholder without affecting peers.
// ----------------------------------------------------------------------------
function WorkspaceTile({
  workspace: c,
  isRenaming,
  renameValue,
  setRenameValue,
  onRenameCommit,
  onRenameCancel,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onOpen,
  onStartRename,
  onSetCover,
  onRemoveCover,
  onDelete,
}) {
  // hasCover gates the "Set cover" vs "Change cover" / "Remove cover" menu
  // items (a snapshot is not a user-supplied cover). The thumbnail itself —
  // cover → snapshot → canvas color — is owned by WorkspaceThumbnail; rendered
  // in both the clickable and rename states so the tile doesn't jump on rename.
  const hasCover = !!c.cover_image_url
  const cover = <WorkspaceThumbnail workspace={c} className="aspect-video w-full" />

  return (
    <div className="group relative rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {isRenaming ? (
        // Rename mode: not a button (an input can't be nested in a button).
        <div>
          {cover}
          <div className="p-4">
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameCommit()
                if (e.key === 'Escape') onRenameCancel()
              }}
              onBlur={onRenameCommit}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
        </div>
      ) : (
        // Primary surface: click anywhere to open the workspace.
        <button
          onClick={onOpen}
          className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-inset"
        >
          {cover}
          <div className="p-4">
            <div className="text-sm font-medium text-gray-900 truncate">
              {c.name}
            </div>
            {c.description ? (
              <div className="text-xs text-gray-500 truncate mt-0.5">
                {c.description}
              </div>
            ) : (
              <div className="text-xs text-transparent truncate mt-0.5">·</div>
            )}
          </div>
        </button>
      )}

      {/* Secondary actions — always present (not hover-only), emphasized on hover. */}
      {!isRenaming && (
        <div className="absolute top-2 right-2">
          <button
            onClick={onToggleMenu}
            aria-label="Workspace actions"
            className="p-1.5 rounded-full bg-white/90 text-gray-500 shadow-sm opacity-70 group-hover:opacity-100 hover:text-gray-900 transition-opacity"
          >
            <DotsThree size={18} weight="bold" />
          </button>

          {menuOpen && (
            <>
              {/* Click-outside backdrop. */}
              <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
              <div className="absolute right-0 top-9 z-20 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                <button
                  onClick={onSetCover}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ImageIcon size={14} weight="bold" />
                  {hasCover ? 'Change cover' : 'Set cover'}
                </button>
                {hasCover && (
                  <button
                    onClick={onRemoveCover}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <X size={14} weight="bold" />
                    Remove cover
                  </button>
                )}
                <button
                  onClick={onStartRename}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <PencilSimple size={14} weight="bold" />
                  Rename
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash size={14} weight="bold" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
