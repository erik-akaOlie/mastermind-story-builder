// ============================================================================
// workspaceSort — client-side sort options for the CampaignPicker.
// ----------------------------------------------------------------------------
// Sorting happens client-side over the already-fetched rows (no extra queries).
// The chosen option is remembered in localStorage. Labels are adaptive per
// field (A–Z / Z–A for names, Newest / Oldest for dates). "Last modified" reads
// last_activity_at, the real newest-edit timestamp from
// list_workspaces_with_activity() (migration 011).
// ============================================================================

import { sortKey } from '../utils/labelUtils.js'

// Three single-choice options — each carries its own fixed direction, so the
// user makes ONE choice (no separate direction modifier):
//   Alphabetical  → A→Z
//   Date created  → oldest → newest
//   Last modified → newest → oldest
export const SORT_OPTIONS = [
  { id: 'alphabetical', label: 'Alphabetical', field: 'name',             dir: 'asc'  },
  { id: 'created',      label: 'Date created',  field: 'created_at',       dir: 'asc'  },
  { id: 'modified',     label: 'Last modified', field: 'last_activity_at', dir: 'desc' },
]

export const DEFAULT_SORT_ID = 'modified'

const STORAGE_KEY = 'mastermind:workspace-sort'

export function getSortOption(sortId) {
  return SORT_OPTIONS.find((o) => o.id === sortId)
    ?? SORT_OPTIONS.find((o) => o.id === DEFAULT_SORT_ID)
}

export function readSortId() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return SORT_OPTIONS.some((o) => o.id === v) ? v : DEFAULT_SORT_ID
  } catch {
    return DEFAULT_SORT_ID
  }
}

export function writeSortId(id) {
  try { localStorage.setItem(STORAGE_KEY, id) } catch { /* ignore */ }
}

// Case-insensitive, "The "-insensitive name comparison (matches sortKey).
function compareName(a, b) {
  return sortKey(a?.name || '').localeCompare(sortKey(b?.name || ''), undefined, { sensitivity: 'base' })
}

function ts(value) {
  return value ? new Date(value).getTime() : 0
}

// Returns a new sorted array; never mutates the input. Ties fall back to name
// A–Z so ordering is always deterministic.
export function sortWorkspaces(rows, sortId) {
  const opt = getSortOption(sortId)
  const mul = opt.dir === 'asc' ? 1 : -1
  return [...(rows ?? [])].sort((a, b) => {
    const primary = opt.field === 'name'
      ? compareName(a, b)
      : ts(a[opt.field]) - ts(b[opt.field])
    if (primary !== 0) return primary * mul
    return compareName(a, b) // stable tiebreaker, direction-independent
  })
}
