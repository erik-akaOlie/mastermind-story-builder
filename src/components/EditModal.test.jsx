// Tests for EditModal — currently a 792-line component that owns title, type,
// summary, three bullet sections, media, connections, auto-save, and morph
// animation. These tests pin down the existing behavior so the refactor
// (extracting BulletSection, MediaSection, ConnectionsSection, EditModalHeader,
// useAutoSave, useMorphAnimation) can't silently regress anything.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditModal from './EditModal'

// ── Module mocks ─────────────────────────────────────────────────────────────
// Stub out the modules EditModal reaches into, so we're testing EditModal's
// own behavior — not our auth, Storage uploads, Supabase RPCs, etc.

vi.mock('../lib/useImageUrl', () => ({
  useImageUrl: () => 'mock://image.jpg',
}))
const uploadCardImageMock = vi.fn().mockResolvedValue('mock/path.webp')
vi.mock('../lib/imageStorage', () => ({
  uploadCardImage: (...args) => uploadCardImageMock(...args),
}))
vi.mock('../lib/CampaignContext.jsx', () => ({
  useCampaign: () => ({ activeCampaignId: 'mock-campaign-id' }),
}))
vi.mock('../store/useTypeStore', () => ({
  useNodeTypes: () => ({
    character: { label: 'Character', color: '#0EA5E9', icon: () => null },
    location:  { label: 'Location',  color: '#10B981', icon: () => null },
    item:      { label: 'Item',      color: '#F97316', icon: () => null },
    faction:   { label: 'Faction',   color: '#3B82F6', icon: () => null },
    story:     { label: 'Story',     color: '#6B7280', icon: () => null },
  }),
}))
vi.mock('./Lightbox', () => ({
  useLightbox: () => ({ open: vi.fn() }),
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

// Phase-4 hook into the undo store so we can assert recordAction is NOT
// called during typing (auto-save handles persistence; undo entries are
// emitted only on modal close) and IS called once per changed field on close.
const recordActionMock = vi.fn()
vi.mock('../store/useUndoStore', () => ({
  useUndoStore: { getState: () => ({ recordAction: recordActionMock }) },
}))

// ── Test fixtures ────────────────────────────────────────────────────────────

const sampleNode = {
  id: 'node-strahd',
  data: {
    label:      'Strahd von Zarovich',
    type:       'character',
    summary:    'Vampire lord of Barovia',
    avatar:     null,
    storyNotes: ['Born ~1346', 'Cursed in 1346'],
    hiddenLore: ['Truly believes Tatyana is reincarnating'],
    dmNotes:    ['Voice: slow, deliberate'],
    media:      [],
  },
}

const renderModal = (overrides = {}) => {
  const props = {
    node:           sampleNode,
    connectedNodes: [],
    allOtherNodes:  [],
    originRect:     null,
    onUpdate:       vi.fn(),
    onClose:        vi.fn(),
    ...overrides,
  }
  return { ...render(<EditModal {...props} />), props }
}

// EditModal auto-saves on a 400ms debounce — tests that exercise the save
// path use fake timers and `flushSave()` to advance past the debounce.
const flushSave = () => act(() => { vi.advanceTimersByTime(400) })

// ── Tests ────────────────────────────────────────────────────────────────────

describe('EditModal — open + populate', () => {
  it('populates title, summary, and all three bullet sections from node.data', () => {
    renderModal()

    expect(screen.getByDisplayValue('Strahd von Zarovich')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Vampire lord of Barovia')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Born ~1346')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Cursed in 1346')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Truly believes Tatyana is reincarnating')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Voice: slow, deliberate')).toBeInTheDocument()
  })
})

describe('EditModal — auto-save', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('debounces title edits and calls onUpdate with the new label after 400ms', () => {
    const { props } = renderModal()
    const titleInput = screen.getByDisplayValue('Strahd von Zarovich')

    // Initial mount fires one save after the 400ms debounce — drain it.
    flushSave()
    props.onUpdate.mockClear()

    // Edit synchronously via fireEvent (user-event needs real timers).
    fireEvent.change(titleInput, { target: { value: 'Strahd the Damned' } })

    // Before the debounce expires, no save.
    expect(props.onUpdate).not.toHaveBeenCalled()

    flushSave()

    expect(props.onUpdate).toHaveBeenCalledTimes(1)
    expect(props.onUpdate).toHaveBeenCalledWith(
      'node-strahd',
      expect.objectContaining({ label: 'Strahd the Damned' }),
      expect.any(Object),
    )
  })

  it('saves type changes when the user picks a new type from the dropdown', () => {
    const { props } = renderModal()
    flushSave()
    props.onUpdate.mockClear()

    // Open the type picker
    fireEvent.click(screen.getByText('Character'))
    // Pick Location
    fireEvent.click(screen.getByText('Location'))

    flushSave()

    expect(props.onUpdate).toHaveBeenCalledWith(
      'node-strahd',
      expect.objectContaining({ type: 'location' }),
      expect.any(Object),
    )
  })

  it('saves new bullets added via the "+ Add note" button', () => {
    const { props } = renderModal()
    flushSave()
    props.onUpdate.mockClear()

    // Story Notes bullets are uniquely identifiable by their placeholder.
    const storyBullets = () => screen.getAllByPlaceholderText(/narrative beat/i)
    expect(storyBullets()).toHaveLength(2)

    // "Add note" appears in both Story Notes and DM Notes — Story Notes is
    // rendered first, so the first match is the right one.
    fireEvent.click(screen.getAllByRole('button', { name: /\+\s*add note/i })[0])

    expect(storyBullets()).toHaveLength(3)

    // Type into the newly-appended bullet (last one in the section).
    const newBullet = storyBullets().at(-1)
    fireEvent.change(newBullet, { target: { value: 'New beat' } })

    flushSave()

    const lastCall = props.onUpdate.mock.calls.at(-1)
    expect(lastCall[1].storyNotes).toContain('New beat')
    expect(lastCall[1].storyNotes).toContain('Born ~1346') // existing preserved
  })

  it('saves bullet removal when the user clicks the × on a bullet', () => {
    const { props } = renderModal()
    flushSave()
    props.onUpdate.mockClear()

    // Find the × buttons that sit next to story note textareas.
    // Each bullet row is <li> with the [×] as the last button.
    const targetBullet = screen.getByDisplayValue('Born ~1346').closest('li')
    const removeBtn = Array.from(targetBullet.querySelectorAll('button')).at(-1)
    fireEvent.click(removeBtn)

    flushSave()

    const lastCall = props.onUpdate.mock.calls.at(-1)
    expect(lastCall[1].storyNotes).not.toContain('Born ~1346')
    expect(lastCall[1].storyNotes).toContain('Cursed in 1346')
  })
})

describe('EditModal — connections', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const otherNode = {
    id: 'node-ireena',
    data: { label: 'Ireena Kolyana', type: 'character' },
  }

  it('shows pre-existing connections as chips', () => {
    renderModal({
      connectedNodes: [{ edgeId: 'edge-1', nodeId: 'node-ireena', label: 'Ireena Kolyana', type: 'character' }],
    })
    expect(screen.getByText('Ireena Kolyana')).toBeInTheDocument()
  })

  it('adds a connection — onUpdate gets addConnections with a client-assigned id', () => {
    const { props } = renderModal({
      connectedNodes: [],
      allOtherNodes: [otherNode],
    })
    flushSave()
    props.onUpdate.mockClear()

    fireEvent.click(screen.getByText('Add connection'))
    fireEvent.click(screen.getByText('Ireena Kolyana'))

    flushSave()

    const lastCall = props.onUpdate.mock.calls.at(-1)
    expect(lastCall[2].addConnections).toEqual([
      { id: expect.any(String), nodeId: 'node-ireena' },
    ])
    expect(lastCall[2].addConnections[0].id).not.toBe('')
  })

  it('removes a connection — onUpdate gets removeConnections carrying the original edge id', () => {
    const { props } = renderModal({
      connectedNodes: [{ edgeId: 'edge-1', nodeId: 'node-ireena', label: 'Ireena Kolyana', type: 'character' }],
    })
    flushSave()
    props.onUpdate.mockClear()

    const chip = screen.getByText('Ireena Kolyana').closest('div')
    const removeBtn = chip.querySelector('button')
    fireEvent.click(removeBtn)

    flushSave()

    const lastCall = props.onUpdate.mock.calls.at(-1)
    expect(lastCall[2].removeConnections).toEqual([
      { id: 'edge-1', nodeId: 'node-ireena' },
    ])
  })
})

describe('EditModal — close behavior', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('flushes a pending save and calls onClose when the user presses Escape', () => {
    const { props } = renderModal()
    flushSave()
    props.onUpdate.mockClear()

    // Make a change but DON'T advance past the debounce yet.
    fireEvent.change(screen.getByDisplayValue('Strahd von Zarovich'), {
      target: { value: 'Strahd the Damned' },
    })

    // Press Esc — handleClose should flush the pending save synchronously,
    // then schedule onClose after the morph animation (260ms).
    fireEvent.keyDown(window, { key: 'Escape' })

    // Pending save was flushed by handleClose itself, before the debounce.
    expect(props.onUpdate).toHaveBeenCalledWith(
      'node-strahd',
      expect.objectContaining({ label: 'Strahd the Damned' }),
      expect.any(Object),
    )

    // onClose fires after the close animation delay.
    act(() => { vi.advanceTimersByTime(260) })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('EditModal — undo entries (phase 4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    recordActionMock.mockClear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('does NOT recordAction while the user is typing (auto-save handles persistence; undo entries are session-bounded)', () => {
    renderModal()
    flushSave()

    // Several keystrokes + debounce flushes — no recordAction should fire.
    const titleInput = screen.getByDisplayValue('Strahd von Zarovich')
    fireEvent.change(titleInput, { target: { value: 'Strahd v2' } })
    flushSave()
    fireEvent.change(titleInput, { target: { value: 'Strahd v3' } })
    flushSave()
    fireEvent.change(titleInput, { target: { value: 'Strahd v4' } })
    flushSave()

    expect(recordActionMock).not.toHaveBeenCalled()
  })

  it('emits exactly one editCardField action per changed field on modal close', () => {
    renderModal()
    flushSave()
    recordActionMock.mockClear()

    // Edit BOTH title and summary, then close.
    fireEvent.change(screen.getByDisplayValue('Strahd von Zarovich'), {
      target: { value: 'Strahd the Damned' },
    })
    fireEvent.change(screen.getByDisplayValue('Vampire lord of Barovia'), {
      target: { value: 'Lord of Castle Ravenloft' },
    })

    fireEvent.keyDown(window, { key: 'Escape' })

    // Two entries — one per field that drifted from snapshot.
    expect(recordActionMock).toHaveBeenCalledTimes(2)

    const calls = recordActionMock.mock.calls.map((c) => c[0])
    const fields = calls.map((e) => e.field).sort()
    expect(fields).toEqual(['label', 'summary'])

    const labelEntry = calls.find((e) => e.field === 'label')
    expect(labelEntry).toMatchObject({
      type: 'editCardField',
      cardId: 'node-strahd',
      before: 'Strahd von Zarovich',
      after:  'Strahd the Damned',
    })

    const summaryEntry = calls.find((e) => e.field === 'summary')
    expect(summaryEntry).toMatchObject({
      type: 'editCardField',
      cardId: 'node-strahd',
      before: 'Vampire lord of Barovia',
      after:  'Lord of Castle Ravenloft',
    })
  })

  it('emits no editCardField action on close when nothing changed', () => {
    renderModal()
    flushSave()
    recordActionMock.mockClear()

    // Open and close without touching anything.
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(recordActionMock).not.toHaveBeenCalled()
  })

  it('records before:"" (raw, not "Untitled") when the user types into a freshly-created empty card', () => {
    // Regression: an earlier version persisted `title.trim() || "Untitled"`,
    // so the snapshot captured "Untitled" while createCard.dbRow.label stayed
    // "". Redo-create restored "" and redo-edit then refused (`before` !==
    // current). The fix: persist the raw label and let CampaignNode handle
    // the display-time fallback.
    const emptyCard = {
      ...sampleNode,
      data: { ...sampleNode.data, label: '' },
    }
    renderModal({ node: emptyCard })
    flushSave()
    recordActionMock.mockClear()

    // Find title input by placeholder ("Untitled" is the input placeholder).
    const titleInput = screen.getByPlaceholderText('Untitled')
    fireEvent.change(titleInput, { target: { value: 'My Title' } })
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(recordActionMock).toHaveBeenCalledTimes(1)
    const entry = recordActionMock.mock.calls[0][0]
    expect(entry).toMatchObject({
      type: 'editCardField',
      field: 'label',
      before: '',           // raw — used to be 'Untitled'
      after:  'My Title',
    })
  })

  it('emits field edits and connection events in chronological order on close (phase 7a)', () => {
    // Erik's reported issue: edit a bullet, then add a connection, then close.
    // Expectation: undo step #1 removes the connection (most recent action),
    // step #2 reverts the bullets. Stack push order must be [field, connection].
    const otherNode = {
      id: 'node-ireena',
      data: { label: 'Ireena Kolyana', type: 'character' },
    }
    renderModal({ allOtherNodes: [otherNode] })
    flushSave()
    recordActionMock.mockClear()

    // 1) Edit a bullet (storyNotes). Use fake timers' Date.now() so each
    //    action gets a distinct timestamp.
    fireEvent.click(screen.getAllByRole('button', { name: /\+\s*add note/i })[0])
    const newBullet = screen.getAllByPlaceholderText(/narrative beat/i).at(-1)
    fireEvent.change(newBullet, { target: { value: 'New beat' } })

    act(() => { vi.advanceTimersByTime(50) })

    // 2) Add a connection.
    fireEvent.click(screen.getByText('Add connection'))
    fireEvent.click(screen.getByText('Ireena Kolyana'))

    fireEvent.keyDown(window, { key: 'Escape' })

    // Two recordActions: editCardField storyNotes (older) then addConnection (newer).
    expect(recordActionMock).toHaveBeenCalledTimes(2)
    expect(recordActionMock.mock.calls[0][0]).toMatchObject({
      type: 'editCardField',
      field: 'storyNotes',
    })
    expect(recordActionMock.mock.calls[1][0]).toMatchObject({
      type: 'addConnection',
      sourceNodeId: 'node-strahd',
      targetNodeId: 'node-ireena',
    })
    // Each addConnection entry carries a connectionId (client-assigned UUID).
    expect(recordActionMock.mock.calls[1][0].connectionId).toEqual(expect.any(String))
  })

  it('emits multiple field edits in chronological order by last-dirty time (most recent on top)', () => {
    renderModal()
    flushSave()
    recordActionMock.mockClear()

    // 1) Touch summary first.
    fireEvent.change(screen.getByDisplayValue('Vampire lord of Barovia'), {
      target: { value: 'Lord of Barovia' },
    })
    act(() => { vi.advanceTimersByTime(50) })

    // 2) Touch title second — its last-dirty is later.
    fireEvent.change(screen.getByDisplayValue('Strahd von Zarovich'), {
      target: { value: 'Strahd v2' },
    })

    fireEvent.keyDown(window, { key: 'Escape' })

    // Push order: summary first (older lastAt), label second.
    // Stack top = label (most recent action).
    expect(recordActionMock).toHaveBeenCalledTimes(2)
    expect(recordActionMock.mock.calls[0][0]).toMatchObject({
      type: 'editCardField', field: 'summary',
    })
    expect(recordActionMock.mock.calls[1][0]).toMatchObject({
      type: 'editCardField', field: 'label',
    })
  })

  it('logs every connection click — add then remove in same session yields two undo entries', () => {
    // Trust-preserving choice: every click is its own undo step. Even if the
    // user adds then removes within a session (net no change), they still get
    // two stack entries — undo once restores intermediate state, twice cancels.
    const otherNode = {
      id: 'node-ireena',
      data: { label: 'Ireena Kolyana', type: 'character' },
    }
    renderModal({ allOtherNodes: [otherNode] })
    flushSave()
    recordActionMock.mockClear()

    fireEvent.click(screen.getByText('Add connection'))
    fireEvent.click(screen.getByText('Ireena Kolyana'))

    act(() => { vi.advanceTimersByTime(50) })

    // Find the just-added chip and remove it.
    const chip = screen.getByText('Ireena Kolyana').closest('div')
    const removeBtn = chip.querySelector('button')
    fireEvent.click(removeBtn)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(recordActionMock).toHaveBeenCalledTimes(2)
    expect(recordActionMock.mock.calls[0][0]).toMatchObject({ type: 'addConnection' })
    expect(recordActionMock.mock.calls[1][0]).toMatchObject({ type: 'removeConnection' })
    // Both entries carry the SAME connectionId (the client-side UUID assigned
    // at the picker click — it stays stable through the whole session even
    // though the connection was never persisted long-term).
    expect(recordActionMock.mock.calls[0][0].connectionId)
      .toBe(recordActionMock.mock.calls[1][0].connectionId)
  })

  it('captures bullet-list edits as a single editCardField action on close', () => {
    renderModal()
    flushSave()
    recordActionMock.mockClear()

    // Add a story note and close.
    fireEvent.click(screen.getAllByRole('button', { name: /\+\s*add note/i })[0])
    const newBullet = screen.getAllByPlaceholderText(/narrative beat/i).at(-1)
    fireEvent.change(newBullet, { target: { value: 'New beat' } })

    fireEvent.keyDown(window, { key: 'Escape' })

    // Exactly one entry, for storyNotes.
    expect(recordActionMock).toHaveBeenCalledTimes(1)
    const entry = recordActionMock.mock.calls[0][0]
    expect(entry).toMatchObject({
      type: 'editCardField',
      cardId: 'node-strahd',
      field: 'storyNotes',
      before: ['Born ~1346', 'Cursed in 1346'],
      after:  ['Born ~1346', 'Cursed in 1346', 'New beat'],
    })
  })
})

describe('EditModal — avatar upload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    uploadCardImageMock.mockClear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('uploads the selected file and saves the returned path to thumbnail', async () => {
    const { props } = renderModal()
    flushSave()
    props.onUpdate.mockClear()

    // Find the avatar's hidden file input. There are two hidden file inputs
    // (avatar + media); the avatar one is the first.
    const fileInputs = document.querySelectorAll('input[type="file"]')
    const avatarInput = fileInputs[0]

    const file = new File(['fake-bytes'], 'portrait.jpg', { type: 'image/jpeg' })

    await act(async () => {
      fireEvent.change(avatarInput, { target: { files: [file] } })
      await Promise.resolve()  // let the async upload promise queue
    })

    expect(uploadCardImageMock).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: 'mock-campaign-id',
      cardId: 'node-strahd',
      section: 'avatar',
      file,
    }))

    flushSave()

    const lastCall = props.onUpdate.mock.calls.at(-1)
    expect(lastCall[1].avatar).toBe('mock/path.webp')
  })
})
