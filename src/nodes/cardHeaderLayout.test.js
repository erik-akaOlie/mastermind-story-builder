// ============================================================================
// cardHeaderLayout tests — the no-clip and single-fixed-point guarantees
// ----------------------------------------------------------------------------
// The regression these pin down (2026-07-20): the rendered avatar width used
// to come from measuring the header's own height, closing a feedback loop
// (avatar width → title span → line count → header height → avatar width)
// that had TWO self-consistent solutions for titles like
// "1- Evergreen Candle Co." — one correct, one with an extra wrap line and
// the longest word clipped. Zoom/hover/morph history decided which one the
// DOM landed in, so the same card rendered at different sizes.
//
// The fix routes the avatar's rendered width through computeHeaderLayout's
// converged `avatarBox`, so these tests assert the two properties that make
// the bad state impossible:
//   1. No-clip: the title span implied by (cardWidth, avatarBox, iconHidden)
//      always fits the longest word + breathing room.
//   2. Self-consistency: greedy-wrapping the title at that span yields a
//      header height EQUAL to avatarBox — i.e. the geometry the card was
//      sized for is the geometry it will actually render. One fixed point.
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  computeHeaderLayout,
  BASE_CARD, PAD_OUTER, PR_2, INNER_GAP, PY_4, RIGHT_BREATHING,
} from './cardHeaderLayout.js'

// Fake text measurer: fixed-width glyphs at 0.6em — same ballpark as Inter
// semibold. Deterministic, so the tests exercise the math, not font loading.
const makeMeasure = (fontPx) => (text) => text.length * 0.6 * fontPx

// The horizontal room the title span actually gets under a layout result —
// mirrors the header JSX: card − (avatar + outer gap + optional icon + pr-2).
function spanOf(result, iconSize, hasIcon) {
  const iconStuff = hasIcon && !result.iconHidden ? INNER_GAP + iconSize : 0
  return result.cardWidth - (result.avatarBox + PAD_OUTER + iconStuff + PR_2)
}

// Independent greedy word-wrap (re-implemented here on purpose, so the test
// doesn't trust the implementation's own line counter).
function wrapLines(label, span, measure) {
  const words = label.split(/\s+/).filter(Boolean)
  const space = measure(' ')
  let lines = 1
  let lineW = 0
  for (const w of words) {
    const width = measure(w)
    const next = lineW === 0 ? width : lineW + space + width
    if (next > span && lineW > 0) {
      lines++
      lineW = width
    } else {
      lineW = next
    }
  }
  return lines
}

function assertNoClipAndSelfConsistent({ label, fontPx, iconSize, hasIcon }) {
  const measure = makeMeasure(fontPx)
  const result = computeHeaderLayout({ label, fontPx, iconSize, hasIcon, measure })
  const span = spanOf(result, iconSize, hasIcon)

  const longestWord = Math.max(
    ...label.split(/\s+/).filter(Boolean).map((w) => measure(w))
  )

  // 1. No-clip: longest word + breathing fits in the span. The 1e-6 epsilon
  //    absorbs float summation-order noise between this independent
  //    recomputation and the implementation (observed diff ~3e-14); any real
  //    clip is whole pixels.
  expect(span).toBeGreaterThanOrEqual(longestWord + (RIGHT_BREATHING - PR_2) - 1e-6)

  // 2. Self-consistency: the header height produced by actually wrapping the
  //    title at this span equals the avatarBox the card was sized around.
  const lines = wrapLines(label, span, measure)
  const iconVisible = hasIcon && !result.iconHidden
  const impliedHeader = PY_4 + Math.max(lines * fontPx, iconVisible ? iconSize : fontPx)
  expect(result.avatarBox).toBe(impliedHeader)

  return result
}

describe('computeHeaderLayout', () => {
  it('base layout when label is empty or no measurer is available', () => {
    const empty = computeHeaderLayout({ label: '', fontPx: 16, iconSize: 20, hasIcon: true, measure: makeMeasure(16) })
    expect(empty).toEqual({ iconHidden: false, cardWidth: BASE_CARD, avatarBox: PY_4 + 20 })

    const noCtx = computeHeaderLayout({ label: 'Strahd', fontPx: 16, iconSize: 20, hasIcon: true, measure: null })
    expect(noCtx).toEqual({ iconHidden: false, cardWidth: BASE_CARD, avatarBox: PY_4 + 20 })

    const noIcon = computeHeaderLayout({ label: '', fontPx: 16, iconSize: 20, hasIcon: false, measure: makeMeasure(16) })
    expect(noIcon.avatarBox).toBe(PY_4 + 16)
  })

  it('a short title at zoom 1 keeps the base card width', () => {
    const result = assertNoClipAndSelfConsistent({ label: 'Bob', fontPx: 16, iconSize: 20, hasIcon: true })
    expect(result.cardWidth).toBe(BASE_CARD)
    expect(result.iconHidden).toBe(false)
  })

  it('REGRESSION: "1- Evergreen Candle Co." at bead-expand font size — no clipped word, one fixed point', () => {
    // fontPx ≈ threshold-compensated title size observed in the 2026-07-20
    // production screenshot where "Evergreen" clipped.
    const result = assertNoClipAndSelfConsistent({
      label: '1- Evergreen Candle Co.',
      fontPx: 24.5,
      iconSize: 31,
      hasIcon: true,
    })
    // The card must have widened beyond base to make room.
    expect(result.cardWidth).toBeGreaterThan(BASE_CARD)
  })

  it('hides the icon (and still fits) when one long word needs the full width', () => {
    const result = assertNoClipAndSelfConsistent({
      label: 'Constantinople',
      fontPx: 80, // 5×-capped compensation at extreme zoom-out
      iconSize: 100,
      hasIcon: true,
    })
    expect(result.iconHidden).toBe(true)
  })

  it('holds the no-clip + single-fixed-point invariants across a grid of titles and zoom font sizes', () => {
    const labels = [
      'Evergreen Candle Co.',
      '1- Evergreen Candle Co.',
      'Strahd von Zarovich',
      'The Amber Temple of Neverwinter',
      'X',
      'Antidisestablishmentarianism',
      'a b c d e f g h i j k l m n o p',
    ]
    const fonts = [16, 20, 24.5, 32, 48, 64, 80]
    for (const label of labels) {
      for (const fontPx of fonts) {
        assertNoClipAndSelfConsistent({
          label,
          fontPx,
          iconSize: Math.round(fontPx * 1.25),
          hasIcon: true,
        })
        assertNoClipAndSelfConsistent({
          label,
          fontPx,
          iconSize: Math.round(fontPx * 1.25),
          hasIcon: false,
        })
      }
    }
  })

  it('is deterministic: identical inputs give identical outputs (no history dependence)', () => {
    const args = { label: '1- Evergreen Candle Co.', fontPx: 24.5, iconSize: 31, hasIcon: true, measure: makeMeasure(24.5) }
    const a = computeHeaderLayout(args)
    const b = computeHeaderLayout(args)
    expect(a).toEqual(b)
  })
})
