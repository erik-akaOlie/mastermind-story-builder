/**
 * Returns the sort/index key for a label.
 * Titles beginning with "The " are keyed from the word after it so they
 * sort and index alphabetically by their meaningful word, not "The".
 *
 * Examples:
 *   "The Sunsword"          → "Sunsword"
 *   "The Dark Powers' Bargain" → "Dark Powers' Bargain"
 *   "Castle Ravenloft"      → "Castle Ravenloft"
 */
export function sortKey(label = '') {
  return label.replace(/^The\s+/i, '').trim()
}

/**
 * Returns the single-character initial used in avatar / bead fallbacks.
 * Strips a leading "The " before taking the first character and preserves
 * the title's original casing — "strahd" -> "s", "Strahd" -> "S",
 * "STRAHD" -> "S" — so the fallback reads as the user typed it.
 */
export function labelInitial(label = '') {
  return sortKey(label).charAt(0) || '?'
}
