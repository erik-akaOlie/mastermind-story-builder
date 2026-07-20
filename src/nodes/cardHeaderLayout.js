// ============================================================================
// cardHeaderLayout — deterministic card-header layout math (pure, unit-tested)
// ----------------------------------------------------------------------------
// Extracted from CampaignNode's useMemo (2026-07-20) so the layout decision is
// a single pure function with tests, and so the RENDER can consume the
// converged avatar size directly.
//
// Why the avatar size is returned (the bistability fix): the rendered avatar's
// width used to come from a ResizeObserver measuring the header's height —
// which depends on how many lines the title wraps into, which depends on the
// horizontal room left beside the avatar, which depends on the avatar's width.
// That cycle has TWO self-consistent solutions for many titles (e.g.
// "1- Evergreen Candle Co."): the intended one (title in N lines, medium
// avatar, longest word fits) and a degenerate one (avatar one line-height
// wider, title in N+1 lines, longest word CLIPPED). Which one the DOM settled
// into depended on transition history (bead↔card morphs, zoom font changes),
// so the same card could render at different sizes after ordinary navigation.
//
// The fix: this function simulates the converged layout deterministically
// (as before) and now ALSO returns `avatarBox` — the converged header height.
// CampaignNode renders the avatar's WIDTH from `avatarBox` instead of the
// measured height, so the text column's width no longer depends on anything
// the text itself influenced. One equation system, one solution, one size.
// (The avatar's rendered HEIGHT still tracks the measured header so the
// circle always covers the header exactly; height has no feedback path.)
//
// Layout constants (mirror the header JSX in CampaignNode):
//   BASE_CARD       — base card width 256 (w-64)
//   PAD_OUTER       — outer flex gap 8 (gap-2 on the header container)
//   PR_2            — title div right padding 8 (pr-2)
//   INNER_GAP       — title div inner gap 8 (gap-2 between title span and icon)
//   PY_4            — header vertical padding 32 (py-4)
//   RIGHT_BREATHING — 16 (1rem clear between text and card edge)
// ============================================================================

export const BASE_CARD       = 256
export const PAD_OUTER       = 8
export const PR_2            = 8
export const INNER_GAP       = 8
export const PY_4            = 32
export const RIGHT_BREATHING = 16

/**
 * Compute the converged header layout for a card title.
 *
 * @param {object} args
 * @param {string} args.label     the card title ('' / null → base layout)
 * @param {number} args.fontPx    title font size in px (already zoom-compensated)
 * @param {number} args.iconSize  type-icon size in px
 * @param {boolean} args.hasIcon  whether the type has an icon at all
 * @param {(text: string) => number | null} args.measure
 *   text-width measurer for the title font (canvas measureText in the app,
 *   a fake in tests). Pass null when no measurer is available (e.g. jsdom) —
 *   the base layout is returned.
 * @returns {{ iconHidden: boolean, cardWidth: number, avatarBox: number }}
 *   `avatarBox` is the converged header height = the avatar's rendered width.
 */
export function computeHeaderLayout({ label, fontPx, iconSize, hasIcon, measure }) {
  // Seed avatar: one line of text (or the icon, whichever is taller) + padding.
  // Also the fallback `avatarBox` for the early-return paths, so the render
  // always gets a sane avatar width even without a measurer or label.
  const seedAvatar = PY_4 + Math.max(fontPx, hasIcon ? iconSize : fontPx)
  const base = { iconHidden: false, cardWidth: BASE_CARD, avatarBox: seedAvatar }

  if (!label || typeof measure !== 'function') return base

  const words = label.split(/\s+/).filter(Boolean)
  if (words.length === 0) return base

  // Per-word widths (computed once) drive a real greedy word-wrap below.
  // An earlier version used `ceil(totalTextWidth / span)` which is a
  // continuous approximation; greedy wrap can produce MORE lines than that
  // estimate when adjacent words awkwardly overflow by a small margin
  // (e.g., "Strahd von" at 210px just barely doesn't fit a 208px span).
  // Underestimating lines underestimates avatar height, which shrinks the
  // computed span, which lets the longest word still overflow. Greedy
  // matches the browser's actual rendering decision.
  const wordWidths = words.map((w) => measure(w))
  const spaceWidth = measure(' ')
  const longestWordWidth = wordWidths.reduce((m, w) => (w > m ? w : m), 0)

  function greedyLines(span) {
    if (span <= 0) return Infinity
    let lines = 1
    let lineW = 0
    for (const w of wordWidths) {
      const next = lineW === 0 ? w : lineW + spaceWidth + w
      if (next > span && lineW > 0) {
        lines++
        lineW = w
      } else {
        lineW = next
      }
    }
    return lines
  }

  // The minimum span the title needs: longest word fits with `RIGHT_BREATHING`
  // total clear between rightmost text pixel and card's right edge. PR_2
  // already contributes 8px, so we need (RIGHT_BREATHING - PR_2) extra inside
  // the span.
  const minSpan = longestWordWidth + Math.max(0, RIGHT_BREATHING - PR_2)

  // Iterate: at the current cardWidth + iconHidden, compute span via the
  // greedy line counter → avatar height → required cardWidth. Loop until
  // stable. Converges in a handful of passes for any real title.
  let cardWidth  = BASE_CARD
  let iconHidden = false
  let avatar     = seedAvatar

  for (let i = 0; i < 8; i++) {
    const iconStuff = hasIcon && !iconHidden ? (INNER_GAP + iconSize) : 0
    const fixedHorz = avatar + PAD_OUTER + iconStuff + PR_2
    const span      = cardWidth - fixedHorz

    // If a visible icon would force the longest word to overflow, hide it
    // and re-evaluate next pass.
    if (hasIcon && !iconHidden && span < longestWordWidth) {
      iconHidden = true
      continue
    }

    const lines     = greedyLines(span)
    const newAvatar = PY_4 + Math.max(lines * fontPx, hasIcon && !iconHidden ? iconSize : fontPx)

    // Required cardWidth so span ≥ minSpan with the new avatar.
    // The (newAvatar - avatar) term re-projects fixedHorz to the new avatar,
    // so we don't need a second pass just to apply the bump.
    const requiredCard = Math.max(BASE_CARD, fixedHorz + minSpan + (newAvatar - avatar))

    if (newAvatar === avatar && requiredCard === cardWidth) break
    avatar    = newAvatar
    cardWidth = requiredCard
  }

  return { iconHidden, cardWidth, avatarBox: avatar }
}
