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

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useImageUrl } from '../lib/useImageUrl.js'
import { labelInitial } from '../utils/labelUtils.js'
import UserAvatar from './UserAvatar.jsx'
import { UploadImageProvider, useUploadImage } from './UploadImageProvider.jsx'
import { workspaceCoverPipeline, deleteCardImage } from '../lib/imageStorage.js'
import {
  listWorkspaces,
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
export default function CampaignPicker() {
  return (
    <UploadImageProvider>
      <CampaignPickerInner />
    </UploadImageProvider>
  )
}

function CampaignPickerInner() {
  const { setActiveWorkspaceId } = useWorkspace()
  const upload = useUploadImage()

  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // "new workspace" form state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  // inline rename state
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  // open actions menu (one at a time)
  const [menuOpenId, setMenuOpenId] = useState(null)

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
    try {
      const rows = await listWorkspaces()
      setWorkspaces(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
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

        {/* New-workspace control — a secondary-button frame (white fill, blue
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
        <div className="relative h-14 mb-4">
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
            {/* Closed layer — the "+ New workspace" secondary button. */}
            <button
              type="button"
              onClick={openCreate}
              tabIndex={creating ? -1 : 0}
              aria-hidden={creating}
              className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg hover:bg-sky-50"
              style={{
                color: CTA_COLOR,
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

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((c) => (
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

        {isEmpty && !creating && (
          <p className="text-center text-sm text-gray-500 mt-6">
            No workspaces yet. Create your first one to get started.
          </p>
        )}
      </div>
    </div>
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
  const coverUrl = useImageUrl(c.cover_image_url, { variant: 'thumb' })
  const hasCover = !!c.cover_image_url

  // Shared cover visual — used in both the clickable and rename states so the
  // tile doesn't visually jump when it flips into rename mode.
  const cover = (
    <div className="aspect-video w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="text-5xl font-semibold text-gray-300 select-none">
          {labelInitial(c.name)}
        </span>
      )}
    </div>
  )

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
