// ============================================================================
// QuickConnectButtons tests — the per-side icon mapping + accessible labels
// (icon swap 2026-07-29: outward-facing CARETS replaced the plus signs —
// Mark read plus as "add a node here"; carets mean "drag outward from this
// edge", deliberately NOT Arrow* so the relationship never reads as
// directional). Interaction behavior (dwell, drag, native listeners) is
// exercised via quickConnect.test.js + CampaignNode tests; this file pins
// presentation only.
// ============================================================================

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { vi } from 'vitest'

// Identifiable stubs so the test can assert WHICH caret each side renders.
vi.mock('@phosphor-icons/react', () => ({
  CaretUp:    (p) => <span data-icon="caret-up" data-size={p.size} />,
  CaretRight: (p) => <span data-icon="caret-right" data-size={p.size} />,
  CaretDown:  (p) => <span data-icon="caret-down" data-size={p.size} />,
  CaretLeft:  (p) => <span data-icon="caret-left" data-size={p.size} />,
}))

import QuickConnectButtons from './QuickConnectButtons.jsx'

afterEach(cleanup)

const renderButtons = () =>
  render(
    <QuickConnectButtons
      compensation={1}
      cardWidth={256}
      cardHeight={180}
      onBeginConnect={() => {}}
    />,
  )

describe('QuickConnectButtons iconography', () => {
  it('renders an outward-facing caret per side with the matching accessible label', () => {
    renderButtons()
    const expectations = [
      ['Connect upward', 'caret-up'],
      ['Connect right', 'caret-right'],
      ['Connect downward', 'caret-down'],
      ['Connect left', 'caret-left'],
    ]
    for (const [label, icon] of expectations) {
      const btn = screen.getByLabelText(label)
      expect(btn.querySelector(`[data-icon="${icon}"]`)).toBeTruthy()
    }
  })

  it('keeps the 24px button and scales the caret to 18/24 of it', () => {
    renderButtons()
    const btn = screen.getByLabelText('Connect upward')
    expect(btn.style.width).toBe('24px')
    expect(btn.style.height).toBe('24px')
    expect(btn.querySelector('[data-icon]').dataset.size).toBe('18')
  })
})
