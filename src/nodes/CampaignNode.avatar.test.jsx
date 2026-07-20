// ============================================================================
// CampaignNode — avatar lightbox behavior (mobile QA fix, 2026-07-19)
// ----------------------------------------------------------------------------
// On touch-primary devices the header avatar must be INERT: no lightbox on
// tap, no event swallowing — a tap on the avatar behaves like a tap anywhere
// else on the card (single-tap select, double-tap Inspector). Root cause of
// the bug this pins: tapping a bead selects it on pointerdown, the bead
// morphs to a card mid-tap, and the browser hit-tests the click at finger-
// lift against the now-expanded card — landing on the avatar and opening the
// lightbox. Desktop (fine pointer) keeps the lightbox affordance unchanged.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CampaignNode from './CampaignNode'

// ---------------------------------------------------------------------------
// Mocks. CampaignNode is a React Flow custom node; render it standalone by
// stubbing RF's context hooks and the neighbors that need providers.
// ---------------------------------------------------------------------------
const lightboxOpen = vi.hoisted(() => vi.fn())

vi.mock('reactflow', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../components/Lightbox', () => ({
  useLightbox: () => ({ open: lightboxOpen }),
}))
vi.mock('../lib/useImageUrl', () => ({
  useImageUrl: (input) => (input ? 'blob:fake-avatar-url' : null),
}))
vi.mock('../lib/CanvasOpsContext.jsx', () => ({
  useCanvasOps: () => ({}),
}))
vi.mock('./QuickConnectButtons.jsx', () => ({ default: () => null }))
vi.mock('./BlockPreview', () => ({ default: () => null }))

// jsdom has no ResizeObserver; CampaignNode observes its own element for the
// morph machinery. A no-op stub is enough — these tests only exercise the
// avatar's event handlers.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// useTouchPrimary asks matchMedia('(hover: none) and (pointer: coarse)').
// Override matchMedia per suite; restore after so other suites are unaffected.
// (Same pattern as CanvasContextMenu.test.jsx.)
let originalMatchMedia
function mockMatchMedia(matcher) {
  window.matchMedia = (query) => ({
    matches: matcher(query),
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

beforeEach(() => {
  originalMatchMedia = window.matchMedia
  lightboxOpen.mockClear()
})
afterEach(() => { window.matchMedia = originalMatchMedia })

const DATA = {
  id: 'n1',
  label: 'Alpha',
  type: 'character',
  avatar: 'ws1/n1/avatar-123.full.webp',
  summary: '',
  storyNotes: [],
  hiddenLore: [],
  dmNotes: [],
  media: [],
  connectionDots: [],
}

function renderNode() {
  return render(<CampaignNode data={DATA} selected={false} xPos={0} yPos={0} />)
}

function avatarImg() {
  // Card layer + bead layer both render the avatar with the label as alt;
  // the lightbox handler lives only on the card layer's img (the first).
  return screen.getAllByAltText('Alpha')[0]
}

describe('CampaignNode avatar — desktop (fine pointer)', () => {
  beforeEach(() => mockMatchMedia(() => false))

  it('clicking the avatar opens the lightbox with the stored avatar value', () => {
    renderNode()
    fireEvent.click(avatarImg())
    expect(lightboxOpen).toHaveBeenCalledTimes(1)
    expect(lightboxOpen).toHaveBeenCalledWith(DATA.avatar)
  })

  it('keeps the zoom-in cursor affordance', () => {
    renderNode()
    expect(avatarImg().className).toContain('cursor-zoom-in')
  })
})

describe('CampaignNode avatar — touch-primary (phones/tablets)', () => {
  beforeEach(() => mockMatchMedia((q) => q.includes('hover: none')))

  it('tapping the avatar does NOT open the lightbox', () => {
    renderNode()
    fireEvent.click(avatarImg())
    expect(lightboxOpen).not.toHaveBeenCalled()
  })

  it('does not advertise a zoom-in cursor', () => {
    renderNode()
    expect(avatarImg().className).not.toContain('cursor-zoom-in')
  })

  it('does not swallow the press — pointerdown propagates to the node (RF selection path)', () => {
    const { container } = renderNode()
    const seen = vi.fn()
    container.firstChild.addEventListener('pointerdown', seen)
    fireEvent.pointerDown(avatarImg(), { bubbles: true })
    expect(seen).toHaveBeenCalled()
  })
})
