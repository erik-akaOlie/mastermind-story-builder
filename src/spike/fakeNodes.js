// ─────────────────────────────────────────────────────────────────────────
// SPIKE-ONLY throwaway data. Not wired to Supabase. Used by both the
// BlockNote and Tiptap prototypes for [[Node]] autocomplete and the
// Connections/Image Album block stubs.
// Safe to delete with the rest of src/spike/.
// ─────────────────────────────────────────────────────────────────────────

export const FAKE_NODES = [
  { id: 'n-strahd',   label: 'Strahd von Zarovich', type: 'character' },
  { id: 'n-ireena',   label: 'Ireena Kolyana',      type: 'character' },
  { id: 'n-madameva', label: 'Madam Eva',           type: 'character' },
  { id: 'n-vistani',  label: 'The Vistani',         type: 'faction'   },
  { id: 'n-barovia',  label: 'Barovia',             type: 'location'  },
  { id: 'n-staff',    label: 'Staff of Power',       type: 'item'      },
  { id: 'n-castle',   label: 'Castle Ravenloft',     type: 'location'  },
]

export function searchNodes(query) {
  const q = (query || '').toLowerCase()
  return FAKE_NODES.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 6)
}

// Fake "existing connections" for the Connections block stub.
export const FAKE_CONNECTIONS = [
  { id: 'c1', targetId: 'n-ireena',  label: 'Ireena Kolyana' },
  { id: 'c2', targetId: 'n-vistani', label: 'The Vistani' },
]

// Fake image set for the Image Album block stub (solid-color data URIs so the
// spike needs no network or storage).
export const FAKE_IMAGES = [
  'https://placehold.co/120x90/7C3AED/fff?text=1',
  'https://placehold.co/120x90/16A34A/fff?text=2',
  'https://placehold.co/120x90/EA580C/fff?text=3',
]
