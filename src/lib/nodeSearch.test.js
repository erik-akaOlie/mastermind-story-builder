// ============================================================================
// nodeSearch.test — title scorer/ranker for beta simple search
// ----------------------------------------------------------------------------
// These tests ARE the containment for the typo-leniency scope (Erik's guard:
// forgiving title search, not a search engine). If a change makes one of the
// exclusion cases pass as a match, that's scope creep, not an improvement.
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  normalizeTitle,
  typoBudget,
  editDistanceAtMost,
  scoreTitle,
  rankEntries,
  predictQueries,
  PREDICTION_LIMIT,
} from './nodeSearch.js'

const e = (id, title, extra = {}) => ({ id, title, ...extra })

describe('normalizeTitle', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeTitle('  Strahd   von  Zarovich ')).toBe('strahd von zarovich')
  })
  it('handles null/undefined', () => {
    expect(normalizeTitle(null)).toBe('')
    expect(normalizeTitle(undefined)).toBe('')
  })
})

describe('typoBudget', () => {
  it('gives no leniency to short queries', () => {
    expect(typoBudget(1)).toBe(0)
    expect(typoBudget(3)).toBe(0)
  })
  it('gives 1 typo at 4+ chars, 2 at 8+', () => {
    expect(typoBudget(4)).toBe(1)
    expect(typoBudget(7)).toBe(1)
    expect(typoBudget(8)).toBe(2)
  })
})

describe('editDistanceAtMost', () => {
  it('is 0 for equal strings', () => {
    expect(editDistanceAtMost('abc', 'abc', 2)).toBe(0)
  })
  it('counts substitutions, insertions, deletions', () => {
    expect(editDistanceAtMost('cat', 'cut', 2)).toBe(1)   // substitution
    expect(editDistanceAtMost('cat', 'cart', 2)).toBe(1)  // insertion
    expect(editDistanceAtMost('cart', 'cat', 2)).toBe(1)  // deletion
  })
  it('counts an adjacent swap as ONE edit', () => {
    expect(editDistanceAtMost('strhad', 'strahd', 1)).toBe(1)
  })
  it('returns Infinity past the bound', () => {
    expect(editDistanceAtMost('abcdef', 'zzzzzz', 2)).toBe(Infinity)
    expect(editDistanceAtMost('ab', 'abcdef', 2)).toBe(Infinity) // length gap > max
  })
})

describe('scoreTitle tiers', () => {
  it('exact match outranks everything', () => {
    expect(scoreTitle('Strahd', 'strahd')).toBe(100)
  })
  it('title prefix beats word prefix beats substring', () => {
    const prefix    = scoreTitle('Strahd von Zarovich', 'stra')
    const wordStart = scoreTitle('Castle Ravenloft', 'raven')
    const substring = scoreTitle('Blinsky Toys', 'insky')
    expect(prefix).toBe(90)
    expect(wordStart).toBe(80)
    expect(substring).toBe(70)
    expect(prefix).toBeGreaterThan(wordStart)
    expect(wordStart).toBeGreaterThan(substring)
  })
  it('tolerates one typo on a 4+ char query (swap, wrong, missing letter)', () => {
    expect(scoreTitle('Strahd', 'strhad')).toBe(50)   // swapped letters
    expect(scoreTitle('Moxley Manor', 'moxly')).toBe(50)  // missing letter in incomplete query
    expect(scoreTitle('Ireena', 'irena')).toBe(50)    // missing letter
  })
  it('tolerates two typos only on 8+ char queries', () => {
    expect(scoreTitle('Ravenloft', 'ravnlofte')).toBe(40)
    expect(scoreTitle('Manor', 'mnaro')).toBeNull()   // 5-char query, 2 edits → out
  })
  it('gives short queries no typo leniency', () => {
    expect(scoreTitle('Rictavio', 'rik')).toBeNull()
  })
  it('excludes unrelated titles entirely', () => {
    expect(scoreTitle('Strahd von Zarovich', 'silver key')).toBeNull()
    expect(scoreTitle('Madam Eva', 'zzzz')).toBeNull()
  })
  it('excludes empty titles and empty queries', () => {
    expect(scoreTitle('', 'strahd')).toBeNull()
    expect(scoreTitle('Strahd', '  ')).toBeNull()
  })
  it('is case- and whitespace-insensitive', () => {
    expect(scoreTitle('  STRAHD  von Zarovich', 'strahd VON')).toBe(90)
  })
})

describe('rankEntries', () => {
  const entries = [
    e('1', 'Vallaki'),
    e('2', 'Vasili von Holtz'),
    e('3', 'Castle Ravenloft'),
    e('4', 'Strahd von Zarovich'),
    e('5', 'Vampire Spawn'),
  ]

  it('ranks by tier and excludes non-matches', () => {
    const ids = rankEntries(entries, 'va').map((x) => x.id)
    // All three are tier-90 prefix matches; the tie breaks to shorter titles:
    // Vallaki (7) < Vampire Spawn (13) < Vasili von Holtz (16).
    expect(ids).toEqual(['1', '5', '2'])
  })

  it('breaks tier ties by shorter title, then alphabetically', () => {
    const tied = [e('a', 'Vallakovich Manor'), e('b', 'Vallaki')]
    expect(rankEntries(tied, 'vall').map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('returns [] for a query nothing matches', () => {
    expect(rankEntries(entries, 'qqqq')).toEqual([])
  })

  it('keeps BOTH nodes when two share a title (results are nodes)', () => {
    const dup = [e('x', 'Guard'), e('y', 'Guard')]
    expect(rankEntries(dup, 'guard')).toHaveLength(2)
  })

  it('carries entry fields through untouched', () => {
    const rich = [e('1', 'Strahd', { typeKey: 'character', avatar: 'p.webp' })]
    expect(rankEntries(rich, 'strahd')[0]).toEqual(rich[0])
  })
})

describe('predictQueries', () => {
  it('dedupes shared titles (predictions are queries, not results)', () => {
    const dup = [e('x', 'Guard'), e('y', 'Guard'), e('z', 'Guardian Portrait')]
    expect(predictQueries(dup, 'guar')).toEqual(['Guard', 'Guardian Portrait'])
  })

  it('caps at the prediction limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => e(String(i), `Wolf ${i}`))
    expect(predictQueries(many, 'wolf')).toHaveLength(PREDICTION_LIMIT)
  })

  it('returns display-form titles, not normalized ones', () => {
    expect(predictQueries([e('1', 'Madam Eva')], 'madam')).toEqual(['Madam Eva'])
  })
})
