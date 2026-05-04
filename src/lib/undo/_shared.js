// Universal helpers for the undo dispatcher. Things that aren't specific to
// any one action family — kept tiny on purpose. Family-specific helpers live
// in `_cardHelpers.js`, `_connectionHelpers.js`, `_listItemHelpers.js`, and
// `_textNodeHelpers.js`.

// Small structural deep-equal good enough for the React-shape values we
// snapshot: strings, nulls, arrays of strings, arrays of plain objects
// (e.g. media entries `{ path, alt, uploaded_at }`). Avoids JSON.stringify's
// key-order fragility on plain objects coming back from Supabase vs from
// upload helpers.
export function deepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!deepEqual(a[k], b[k])) return false
  }
  return true
}
