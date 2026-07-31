// ============================================================================
// CampaignPicker tests — the empty-library state (launch queue, 2026-07-30)
// ----------------------------------------------------------------------------
// Pins the zero-workspace presentation: the + New workspace control promotes
// to the PRIMARY treatment (sky fill, white text), the handwritten Caveat
// instruction renders in the gallery area, and the whole guide unmounts while
// the create flow is open (the arrow must never point at a control that has
// morphed into something else). The arrow's geometry + clarity gate is a pure
// exported helper, tested directly (jsdom rects are all zeros, so the DOM
// path can't exercise it).
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CampaignPicker, { emptyGuideArrowGeometry } from './CampaignPicker.jsx'

const GUIDE_LINE_1 = 'Add a new workspace'
const GUIDE_LINE_2 = 'to get started'
const CTA_BG = 'rgb(2, 132, 199)' // sky-600, the system CTA color

const { mockList, narrowState, workspaceCtx } = vi.hoisted(() => ({
  mockList: vi.fn(),
  narrowState: { value: false },
  workspaceCtx: {
    setActiveWorkspaceId: () => {},
    workspaceNotice: null,
    clearWorkspaceNotice: () => {},
  },
}))

vi.mock('../lib/workspaces.js', () => ({
  listWorkspacesWithActivity: mockList,
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
}))
vi.mock('../lib/WorkspaceContext.jsx', () => ({
  useWorkspace: () => workspaceCtx,
}))
vi.mock('../lib/imageStorage.js', () => ({
  workspaceCoverPipeline: vi.fn(),
  deleteCardImage: vi.fn(),
}))
vi.mock('./UserAvatar.jsx', () => ({ default: () => null }))
vi.mock('./WorkspaceThumbnail.jsx', () => ({ default: () => null }))
vi.mock('./UploadImageProvider.jsx', () => ({
  UploadImageProvider: ({ children }) => children,
  useUploadImage: () => ({ open: vi.fn() }),
}))
vi.mock('../hooks/useIsNarrowViewport.js', () => ({
  useIsNarrowViewport: () => narrowState.value,
}))

const WORKSPACE_ROW = {
  id: 'w1',
  name: 'Curse of Strahd',
  description: '',
  cover_image_url: null,
  snapshot_path: null,
  created_at: '2026-01-01T00:00:00Z',
  last_activity_at: '2026-07-01T00:00:00Z',
}

// The closed-layer control; both layout branches label it "New workspace".
function newWorkspaceButton() {
  return screen
    .getAllByRole('button', { name: /new workspace/i, hidden: true })
    .find((b) => b.hasAttribute('data-empty-guide-target'))
}

describe('CampaignPicker — empty-library state', () => {
  beforeEach(() => {
    mockList.mockReset()
    narrowState.value = false
  })

  it('renders the two-line handwritten guide and promotes the button to primary at zero workspaces', async () => {
    mockList.mockResolvedValue([])
    render(<CampaignPicker />)

    // The line break is intentional, never responsive: the action dominates
    // at 2× the supporting line.
    const line1 = await screen.findByText(GUIDE_LINE_1)
    const line2 = screen.getByText(GUIDE_LINE_2)
    expect(line1).toHaveStyle({ fontSize: '80px' })
    expect(line2).toHaveStyle({ fontSize: '40px' })
    // Each line is its own block (the break can't collapse), inside the
    // Caveat brand-voice wrapper.
    expect(line1.className).toContain('block')
    expect(line2.className).toContain('block')
    const wrapper = line1.closest('p')
    expect(wrapper.className).toContain('font-hand')
    expect(wrapper.className).toContain('leading-hand')

    const btn = newWorkspaceButton()
    expect(btn).toBeTruthy()
    expect(btn).toHaveStyle({ backgroundColor: CTA_BG, color: 'rgb(255, 255, 255)' })
  })

  it('keeps the secondary treatment and no guide when workspaces exist', async () => {
    mockList.mockResolvedValue([WORKSPACE_ROW])
    render(<CampaignPicker />)

    expect(await screen.findByText('Curse of Strahd')).toBeInTheDocument()
    expect(screen.queryByText(GUIDE_LINE_1)).not.toBeInTheDocument()

    const btn = newWorkspaceButton()
    expect(btn).not.toHaveStyle({ backgroundColor: CTA_BG })
    expect(btn).toHaveStyle({ color: CTA_BG })
  })

  it('unmounts the guide while the create flow is open and restores it on cancel', async () => {
    mockList.mockResolvedValue([])
    render(<CampaignPicker />)
    await screen.findByText(GUIDE_LINE_1)

    fireEvent.click(newWorkspaceButton())
    expect(screen.queryByText(GUIDE_LINE_1)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText(GUIDE_LINE_1)).toBeInTheDocument()
  })

  it('steps down to the compact type scale on short viewports, even at desktop widths', async () => {
    // Landscape phone / short desktop window: available height below 320 →
    // the compact (narrow) sizes render so the arrow has room to
    // communicate. jsdom rects are zero, so avail = innerHeight − 0 − 48.
    const original = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true })
    try {
      mockList.mockResolvedValue([])
      render(<CampaignPicker />)
      const line1 = await screen.findByText(GUIDE_LINE_1)
      expect(line1).toHaveStyle({ fontSize: '40px' })
      expect(screen.getByText(GUIDE_LINE_2)).toHaveStyle({ fontSize: '20px' })
    } finally {
      if (original) Object.defineProperty(window, 'innerHeight', original)
    }
  })

  it('renders the narrow-layout guide at stepped-down sizes with the 2:1 hierarchy intact', async () => {
    narrowState.value = true
    mockList.mockResolvedValue([])
    render(<CampaignPicker />)

    const line1 = await screen.findByText(GUIDE_LINE_1)
    expect(line1).toHaveStyle({ fontSize: '40px' })
    expect(screen.getByText(GUIDE_LINE_2)).toHaveStyle({ fontSize: '20px' })
    // The narrow branch's closed-layer button is also the arrow target +
    // primary at empty.
    const btn = newWorkspaceButton()
    expect(btn).toBeTruthy()
    expect(btn).toHaveStyle({ backgroundColor: CTA_BG })
  })
})

describe('CampaignPicker — invalid-workspace recovery notice', () => {
  beforeEach(() => {
    mockList.mockReset()
    narrowState.value = false
    workspaceCtx.workspaceNotice = null
    workspaceCtx.clearWorkspaceNotice = vi.fn()
  })

  it('renders the notice in the error (red) treatment with a dismiss ×', async () => {
    workspaceCtx.workspaceNotice =
      'The workspace you were trying to reach is no longer available, so we’ve returned you to your library.'
    mockList.mockResolvedValue([WORKSPACE_ROW])
    render(<CampaignPicker />)

    const notice = await screen.findByText(/no longer available/)
    // Error family styling (matches the picker's existing error banner).
    expect(notice.closest('div').className).toContain('bg-red-50')

    fireEvent.click(screen.getByRole('button', { name: /dismiss notice/i }))
    expect(workspaceCtx.clearWorkspaceNotice).toHaveBeenCalled()
  })

  it('renders no banner when there is no notice', async () => {
    mockList.mockResolvedValue([WORKSPACE_ROW])
    render(<CampaignPicker />)
    await screen.findByText('Curse of Strahd')
    expect(screen.queryByRole('button', { name: /dismiss notice/i })).not.toBeInTheDocument()
  })
})

describe('CampaignPicker — preview-harness guard', () => {
  beforeEach(() => {
    mockList.mockReset()
    narrowState.value = false
  })

  it('previewEmpty mode NEVER calls the real creation path, even with a live session', async () => {
    const { createWorkspace } = await import('../lib/workspaces.js')
    render(<CampaignPicker previewEmpty />)
    await screen.findByText(GUIDE_LINE_1)

    fireEvent.click(newWorkspaceButton())
    const input = screen.getByLabelText('Workspace name')
    fireEvent.change(input, { target: { value: 'Sneaky Real Row' } })
    fireEvent.submit(input.closest('form'))

    // Structural guard: the persistence call is unreachable in preview mode
    // (Erik's Android QA created real backend rows through the harness).
    expect(createWorkspace).not.toHaveBeenCalled()
    // The harness says so instead of silently swallowing the attempt.
    expect(screen.getByText(/workspace creation is disabled/i)).toBeInTheDocument()
  })
})

describe('emptyGuideArrowGeometry — adaptive attachment (pure)', () => {
  // Rect helper in the DOMRect shape the component reads.
  const rect = (left, top, width, height) => ({
    left, top, width, height,
    right: left + width,
    bottom: top + height,
  })

  it('prefers the right-edge form when the button sits clearly to the right', () => {
    const text = rect(400, 378, 480, 102) // two-line block, desktop-ish
    const btn = rect(1065, 145, 150, 38)
    const g = emptyGuideArrowGeometry(text, btn)
    expect(g.attach).toBe('right')
    // BALANCE: both ends back off by the same 32px gap.
    expect(g.tail.x).toBe(text.right + 32)
    expect(g.tip.y).toBe(btn.bottom + 32)
    expect(g.tail.y).toBeCloseTo(text.top + text.height * 0.35)
    expect(g.tip.x).toBe(btn.left + btn.width / 2)
    expect(g.aim).toEqual({ x: btn.left + btn.width / 2, y: btn.top + btn.height / 2 })
    // TANGENT: the departure points straight OUT of the text block, so the
    // tail extended backward intersects the instruction.
    expect(g.startDir).toEqual({ x: 1, y: 0 })
  })

  it('adapts to the top-edge form instead of disappearing when the right form no longer fits', () => {
    // Phone-narrow rects (measured at 375×812 during browser QA): the button
    // center sits LEFT of the text's right edge — the old behavior hid the
    // arrow here; the design rule is adapt-before-remove.
    const text = rect(16, 419, 343, 68)
    const btn = rect(208, 145, 150, 38)
    const g = emptyGuideArrowGeometry(text, btn)
    expect(g).not.toBeNull()
    expect(g.attach).toBe('top')
    // Tail leaves the TOP edge, biased toward the button's side (button
    // center 283 ≥ text center 187 → the 65% point), same 32px gap.
    expect(g.tail.x).toBeCloseTo(text.left + text.width * 0.65)
    expect(g.tail.y).toBe(text.top - 32)
    expect(g.startDir).toEqual({ x: 0, y: -1 })
    expect(g.tip.y).toBe(btn.bottom + 32)
  })

  it('keeps a shallow right-form arrow on short-wide viewports (landscape phones)', () => {
    // Rects measured at 915×412 during browser QA (compact type applied):
    // only ~56px of rise is available — the arrow must still draw
    // (adapt-before-remove; Erik's Android landscape QA 2026-07-30).
    const text = rect(314, 253, 287, 51)
    const btn = rect(741, 145, 150, 38)
    const g = emptyGuideArrowGeometry(text, btn)
    expect(g).not.toBeNull()
    expect(g.attach).toBe('right')
    expect(g.tail.y - g.tip.y).toBeGreaterThanOrEqual(48)
    expect(g.tail.x).toBe(text.right + 32)
    expect(g.tip.y).toBe(btn.bottom + 32)
  })

  it('compresses both end gaps together on cramped viewports instead of dropping the arrow', () => {
    // Erik's Android landscape, 617×290 CSS px — exact rects from the
    // on-device debug strip (2026-07-30). At the 32px rung the right form
    // missed by 7px and the top form by 2px; the ladder steps to 24 and the
    // right form fits. The balance invariant (equal gaps) holds at every
    // rung.
    const text = rect(165, 130, 287, 51)
    const btn = rect(450, 30, 150, 38)
    const g = emptyGuideArrowGeometry(text, btn)
    expect(g).not.toBeNull()
    expect(g.attach).toBe('right')
    expect(g.gap).toBe(24)
    expect(g.tail.x).toBe(text.right + 24)
    expect(g.tip.y).toBe(btn.bottom + 24)
  })

  it('keeps the generous 32px gaps whenever they fit', () => {
    const text = rect(400, 378, 480, 102)
    const btn = rect(1065, 145, 150, 38)
    expect(emptyGuideArrowGeometry(text, btn).gap).toBe(32)
  })

  it('biases the top-edge tail toward the button when the button is left of center', () => {
    const text = rect(300, 419, 343, 68)
    const btn = rect(100, 145, 150, 38) // center 175 < text center 471
    const g = emptyGuideArrowGeometry(text, btn)
    expect(g.attach).toBe('top')
    expect(g.tail.x).toBeCloseTo(text.left + text.width * 0.35)
  })

  it('returns null only as a last resort: unmeasurable anchors or no vertical room in any form', () => {
    const text = rect(16, 419, 343, 68)
    expect(emptyGuideArrowGeometry(null, rect(1065, 145, 150, 38))).toBeNull()
    expect(emptyGuideArrowGeometry(text, null)).toBeNull()
    expect(emptyGuideArrowGeometry(text, rect(0, 0, 0, 0))).toBeNull()
    // Button hugging the text from above: even at the tightest gap rung
    // (16px) the top-form rise is 9px → truly no room in any form.
    expect(emptyGuideArrowGeometry(text, rect(208, 340, 150, 38))).toBeNull()
    // And the OLD "cramped" case (rise 49 at the 16px rung) now correctly
    // yields a compressed top-form arrow instead of null.
    expect(emptyGuideArrowGeometry(text, rect(208, 300, 150, 38))?.attach).toBe('top')
  })
})
