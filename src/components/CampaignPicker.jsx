// ============================================================================
// CampaignPicker
// ----------------------------------------------------------------------------
// Landing screen after sign-in. Lists existing campaigns and lets the user
// open one, rename one, delete one, or create a new one.
//
// Intentionally minimal visually — Erik will restyle this once the plumbing
// is proven. Uses Phosphor icons + sky-600 CTA per CLAUDE.md conventions.
// ============================================================================

import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  ArrowRight,
  PencilSimple,
  Trash,
  WarningCircle,
  Check,
  X,
} from '@phosphor-icons/react'
import { useCampaign } from '../lib/CampaignContext.jsx'
import UserAvatar from './UserAvatar.jsx'
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '../lib/campaigns.js'

export default function CampaignPicker() {
  const { setActiveCampaignId } = useCampaign()

  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // "new campaign" form state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  // inline rename state
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const rows = await listCampaigns()
      setCampaigns(rows)
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
      const { campaign } = await createCampaign(newName)
      setNewName('')
      setCreating(false)
      await refresh()
      // Auto-enter the campaign you just created.
      setActiveCampaignId(campaign.id)
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
      await updateCampaign(id, { name: renameValue.trim() })
      setRenamingId(null)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id, name) {
    const ok = confirm(
      `Delete "${name}"? This permanently removes all cards, connections, and notes in this campaign.`
    )
    if (!ok) return
    setError(null)
    try {
      await deleteCampaign(id)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="w-full max-w-xl mx-auto">
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Your campaigns</h2>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
              >
                <Plus size={14} weight="bold" />
                New campaign
              </button>
            )}
          </div>

          {creating && (
            <form onSubmit={handleCreate} className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Campaign name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Curse of Strahd, The Lost Mines..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false)
                    setNewName('')
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              Loading…
            </div>
          ) : campaigns.length === 0 && !creating ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-600 mb-4">
                No campaigns yet. Create your first one to get started.
              </p>
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700"
              >
                <Plus size={14} weight="bold" />
                New campaign
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {campaigns.map((c) => {
                const isRenaming = renamingId === c.id
                return (
                  <li
                    key={c.id}
                    className="group px-6 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      {isRenaming ? (
                        <input
                          autoFocus
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(c.id)
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          onBlur={() => handleRename(c.id)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-600"
                        />
                      ) : (
                        <button
                          onClick={() => setActiveCampaignId(c.id)}
                          className="text-left w-full"
                        >
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {c.name}
                          </div>
                          {c.description && (
                            <div className="text-xs text-gray-500 truncate">
                              {c.description}
                            </div>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isRenaming ? (
                        <>
                          <button
                            onClick={() => handleRename(c.id)}
                            className="p-1.5 text-gray-500 hover:text-gray-900"
                            title="Save"
                          >
                            <Check size={14} weight="bold" />
                          </button>
                          <button
                            onClick={() => setRenamingId(null)}
                            className="p-1.5 text-gray-500 hover:text-gray-900"
                            title="Cancel"
                          >
                            <X size={14} weight="bold" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setRenamingId(c.id)
                              setRenameValue(c.name)
                            }}
                            className="p-1.5 text-gray-500 hover:text-gray-900"
                            title="Rename"
                          >
                            <PencilSimple size={14} weight="bold" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="p-1.5 text-gray-500 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash size={14} weight="bold" />
                          </button>
                          <button
                            onClick={() => setActiveCampaignId(c.id)}
                            className="p-1.5 text-gray-500 hover:text-sky-700"
                            title="Open"
                          >
                            <ArrowRight size={14} weight="bold" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
