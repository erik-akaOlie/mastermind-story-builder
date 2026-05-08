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
 * Returns the single uppercase initial used in avatar fallbacks.
 * Strips a leading "The " before taking the first character.
 */
export function labelInitial(label = '') {
  return sortKey(label).charAt(0).toUpperCase() || '?'
}
