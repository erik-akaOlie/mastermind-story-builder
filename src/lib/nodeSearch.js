// ============================================================================
// nodeSearch — pure title matching for beta simple search
// ----------------------------------------------------------------------------
// Scope (approved 2026-07-07): search matches NODE TITLES ONLY, within the
// current workspace. Types are shown as context in result rows but are never
// matched. Body content / text blocks / filters are explicitly deferred.
//
// Two consumers, one scorer:
//   - The PREDICTION MENU shows query options — deduped titles ranked by the
//     scorer (predictions are possible search queries, NOT results).
//   - The SEARCH RESULTS drawer shows the full ranked entry list for the
//     submitted query (results are nodes, so duplicates of a shared title
//     each appear).
//
// Ranking tiers (higher wins; ties break to shorter title, then A→Z):
//   100 exact match
//    90 title starts with the query
//    80 a later word starts with the query
//    70 query appears anywhere in the title
//    60/50/40 typo tolerance — bounded edit distance (1 wrong/missing/extra/
//       swapped letter for queries of 4+ chars, 2 for 8+) against the title,
//       its words, and their query-length prefixes (so a typo'd INCOMPLETE
//       query still matches). Score drops 10 per typo.
//   Everything else is EXCLUDED — no "closest anyway" results.
//
// This is the whole relevance system, by design (Erik's scope guard):
// forgiving title search, not a search engine. Keep it contained.
// ============================================================================

// Lowercase, trim, collapse internal whitespace — one canonical form for
// every comparison so ranking never depends on typing whitespace/case.
export function normalizeTitle(s) {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// How many typos a query length earns. Short queries get none (a 3-letter
// query one edit away from a title is usually a different word, not a typo).
export function typoBudget(queryLength) {
  if (queryLength >= 8) return 2
  if (queryLength >= 4) return 1
  return 0
}

// Bounded edit distance (optimal string alignment: substitution, insertion,
// deletion, adjacent transposition). Returns Infinity as soon as the distance
// provably exceeds `max`, so the common non-match case exits early.
export function editDistanceAtMost(a, b, max) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return Infinity
  let prevPrev = null
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(
        prev[j] + 1,        // delete from a
        cur[j - 1] + 1,     // insert into a
        prev[j - 1] + cost, // substitute
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1) // swap adjacent
      }
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return Infinity
    prevPrev = prev
    prev = cur
  }
  return prev[b.length] <= max ? prev[b.length] : Infinity
}

// Score one title against one query. Returns a number (higher = better) or
// null when the title should be excluded from results entirely.
export function scoreTitle(title, query) {
  const t = normalizeTitle(title)
  const q = normalizeTitle(query)
  if (!t || !q) return null

  if (t === q) return 100
  if (t.startsWith(q)) return 90
  const words = t.split(' ')
  if (words.some((w) => w.startsWith(q))) return 80
  if (t.includes(q)) return 70

  const budget = typoBudget(q.length)
  if (budget === 0) return null
  // Candidates: whole title + whole words (completed queries with a typo),
  // plus their query-length prefixes (incomplete queries with a typo).
  const candidates = new Set([t, t.slice(0, q.length)])
  for (const w of words) {
    candidates.add(w)
    candidates.add(w.slice(0, q.length))
  }
  let best = Infinity
  for (const c of candidates) {
    const d = editDistanceAtMost(q, c, budget)
    if (d < best) best = d
    if (best === 1) break // can't beat 1 (0 would have matched a tier above)
  }
  return best <= budget ? 60 - 10 * best : null
}

// Rank entries ({ id, title, ... }) for a query. Excluded entries are
// dropped; the rest come back most-relevant first.
export function rankEntries(entries, query) {
  const scored = []
  for (const entry of entries || []) {
    const score = scoreTitle(entry?.title, query)
    if (score != null) scored.push({ entry, score })
  }
  scored.sort((a, b) =>
    b.score - a.score ||
    a.entry.title.length - b.entry.title.length ||
    a.entry.title.localeCompare(b.entry.title)
  )
  return scored.map((s) => s.entry)
}

export const PREDICTION_LIMIT = 6

// Query options for the prediction menu: the top-ranked titles, deduped on
// the normalized form (two nodes sharing a title yield ONE prediction —
// predictions are queries, not results). Returns display-form titles.
export function predictQueries(entries, query, limit = PREDICTION_LIMIT) {
  const seen = new Set()
  const out = []
  for (const entry of rankEntries(entries, query)) {
    const key = normalizeTitle(entry.title)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry.title)
    if (out.length >= limit) break
  }
  return out
}
