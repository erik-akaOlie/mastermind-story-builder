// ============================================================================
// Type Store
// ----------------------------------------------------------------------------
// Holds the user's card types in memory after hydration from Supabase.
//
// Two parallel lookups:
//   types:    key  -> { label, color, iconName }   (display metadata)
//   idByKey:  key  -> uuid                          (for inserting new nodes)
//
// Hydration runs once per app session in App.jsx's load effect (via
// ensureBuiltinTypes() then listNodeTypes()). New custom types get appended
// via addType() after a successful DB write inside CreateTypeModal.
//
// Note: we used to persist this store to localStorage, which led to custom
// types living in the browser only and breaking on cross-browser use. The
// store is now purely an in-memory cache of DB state.
// ============================================================================

import { create } from 'zustand'
import { getIcon } from '../nodes/iconRegistry'

const LEGACY_LOCALSTORAGE_KEY = 'dnd-node-types'

// Tidy up stale localStorage from the old persist-middleware era. Any custom
// types stored only in the browser were already broken (they couldn't hold
// cards), so dropping them is the honest move.
try {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY)
  }
} catch {
  // Private mode / quota-exceeded — ignore.
}

export const useTypeStore = create((set) => ({
  types: {},
  idByKey: {},

  // Replace the entire store from a fresh batch of DB rows. Called by App.jsx
  // after listNodeTypes() returns.
  hydrate: (rows) => {
    const types = {}
    const idByKey = {}
    for (const r of rows) {
      types[r.key] = { label: r.label, color: r.color, iconName: r.icon_name }
      idByKey[r.key] = r.id
    }
    set({ types, idByKey })
  },

  // Append a single newly-created type (post DB insert).
  addType: (row) =>
    set((state) => ({
      types: {
        ...state.types,
        [row.key]: { label: row.label, color: row.color, iconName: row.icon_name },
      },
      idByKey: { ...state.idByKey, [row.key]: row.id },
    })),
}))

export const useNodeTypes = () => {
  const types = useTypeStore((s) => s.types)
  return Object.fromEntries(
    Object.entries(types).map(([key, { label, color, iconName }]) => [
      key,
      { label, color, icon: getIcon(iconName) },
    ])
  )
}
