// Tests for Inspector — the card-editing surface (orchestration shell that
// owns title, type, avatar, auto-save, undo emission, and the morph animation;
// composes InspectorHeader + the block editor (CardZones) and its fixed
// Connections panel via EditorContext). These pin down behavior across both
// inspector modes (undocked floating modal + docked panel), repoint commit,
// and directional close.
//
// Block-editor cutover (ADR-0016 Chunk E4a): the legacy Summary / bullet /
// media / connections sections were removed from the Inspector body. Card
// content now lives in the two block-editor zones (CardZones, lazy-loaded,
// BlockNote-backed) and connections in the fixed panel inside it. We mock
// CardZones with a small synchronous stub that exercises the SURVIVING
// Inspector → connection contract through the real EditorContext seam
// (connections / onAddConnection / onDeleteConnection) — without pulling
// BlockNote into jsdom.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Inspector from './Inspector'
import { useEditorContext } from './editor/EditorContext.jsx'

// ── Module mocks ─────────────────────────────────────────────────────────────
// Stub out the modules Inspector reaches into, so we're testing Inspector's
// own behavior — not our auth, Storage uploads, Supabase RPCs, etc.

// Mirror the real hook's null-pass-through so InspectorHeader picks the
// correct branch for the avatar state. Without this, sampleNode's
// avatar: null still resolves to a URL and the "Add avatar" empty-state
// button is never rendered.
vi.mock('../lib/useImageUrl', () => ({
  useImageUrl: (input) => (input ? 'mock://image.jpg' : null),
}))
// InspectorHeader.openUploadFresh / openUploadReplace call cardImagePipeline()
// inside the click handler to build a pipeline for the upload modal. The
// pipeline's internals don't matter for these tests — we only care that
// the right config gets handed to the upload modal's open() — so a stub
// with the expected method shape is sufficient.
vi.mock('../lib/imageStorage', () => ({
  cardImagePipeline: vi.fn(() => ({
    upload: vi.fn(),
    delete: vi.fn(),
    getUrl: vi.fn(),
  })),
}))
// Replace the real Upload Image modal with a captured open() so the avatar-
// upload test can inspect the config (mode / pipeline / onSave) and invoke
// the onSave callback manually with a fake returned path. The provider
// becomes a pass-through so Inspector's <UploadImageProvider> wrapper still
// renders its children.
const uploadOpenMock = vi.fn()
vi.mock('./UploadImageProvider', () => ({
  UploadImageProvider: ({ children }) => children,
  useUploadImage: () => ({ open: uploadOpenMock, close: vi.fn() }),
}))
vi.mock('../lib/WorkspaceContext.jsx', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'mock-workspace-id' }),
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

// CardZones is the lazy, BlockNote-backed editor surface. We never want
// BlockNote in jsdom, so we replace it with a synchronous stub that consumes
// the SAME EditorContext the real fixed Connections panel does. It renders the
// live connection list (each with a delete button) plus an "add" button per
// available node — mirroring the real surviving connection seam (add via the
// editor, delete via the fixed panel). This keeps the Inspector → connection
// (localConns → onUpdate → undo) contract under unit test across the cutover.
vi.mock('./editor/CardZones.jsx', () => ({
  default: function CardZonesStub() {
    const { connections, allOtherNodes, onAddConnection, onDeleteConnection } =
      useEditorContext()
    return (
      <div data-testid="card-zones-stub">
        {connections.map((c) => (
          <button
            key={c.id}
            aria-label={`remove ${c.label}`}
            onClick={() => onDeleteConnection(c.id)}
          >
            {c.label}
          </button>
        ))}
        {allOtherNodes.map((n) => (
          <button
            key={n.id}
            aria-label={`add ${n.data.label}`}
            onClick={() => onAddConnection(n)}
          >
            add {n.data.label}
          </button>
        ))}
      </div>
    )
  },
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

// Renders the Inspector and resolves the lazy CardZones stub before returning,
// so the editor seam (the connections panel) is mounted and queryable. Async
// because React.lazy resolves on a microtask; `await act` flushes it.
const renderModal = async (overrides = {}) => {
  const props = {
    node:           sampleNode,
    connectedNodes: [],
    allOtherNodes:  [],
    originRect:     null,
    onUpdate:       vi.fn(),
    onClose:        vi.fn(),
    ...overrides,
  }
  const result = render(<Inspector {...props} />)
  await act(async () => {})
  return { ...result, props }
}

// Inspector auto-saves on a 400ms debounce — tests that exercise the save
// path use fake timers and `flushSave()` to advance past the debounce.
const flushSave = () => act(() => { vi.advanceTimersByTime(400) })

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Inspector — open + populate', () => {
  it('populates the title from node.data', async () => {
    await renderModal()
    expect(screen.getByDisplayValue('Strahd von Zarovich')).toBeInTheDocument()
  })
})

describe('Inspector — auto-save', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('debounces title edits and calls onUpdate with the new label after 400ms', async () => {
    const { props } = await renderModal()
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

  it('saves type changes when the user picks a new type from the dropdown', async () => {
    const { props } = await renderModal()
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
})

describe('Inspector — connections', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const otherNode = {
    id: 'node-ireena',
    data: { label: 'Ireena Kolyana', type: 'character' },
  }

  it('shows pre-existing connections in the editor connections panel', async () => {
    await renderModal({
      connectedNodes: [{ edgeId: 'edge-1', nodeId: 'node-ireena', label: 'Ireena Kolyana', type: 'character' }],
    })
    expect(screen.getByText('Ireena Kolyana')).toBeInTheDocument()
  })

  it('adds a connection — onUpdate gets addConnections with a client-assigned id', async () => {
    const { props } = await renderModal({
      connectedNodes: [],
      allOtherNodes: [otherNode],
    })
    flushSave()
    props.onUpdate.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /add Ireena Kolyana/i }))

    flushSave()

    const lastCall = props.onUpdate.mock.calls.at(-1)
    expect(lastCall[2].addConnections).toEqual([
      { id: expect.any(String), nodeId: 'node-ireena' },
    ])
    expect(lastCall[2].addConnections[0].id).not.toBe('')
  })

  it('removes a connection — onUpdate gets removeConnections carrying the original edge id', async () => {
    const { props } = await renderModal({
      connectedNodes: [{ edgeId: 'edge-1', nodeId: 'node-ireena', label: 'Ireena Kolyana', type: 'character' }],
    })
    flushSave()
    props.onUpdate.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /remove Ireena Kolyana/i }))

    flushSave()

    const lastCall = props.onUpdate.mock.calls.at(-1)
    expect(lastCall[2].removeConnections).toEqual([
      { id: 'edge-1', nodeId: 'node-ireena' },
    ])
  })
})

describe('Inspector — close behavior', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('flushes a pending save and calls onClose when the user presses Escape', async () => {
    const { props } = await renderModal()
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

describe('Inspector — undo entries (phase 4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    recordActionMock.mockClear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('does NOT recordAction while the user is typing (auto-save handles persistence; undo entries are session-bounded)', async () => {
    await renderModal()
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

  it('emits exactly one editCardField action per changed field on modal close', async () => {
    await renderModal()
    flushSave()
    recordActionMock.mockClear()

    // Edit BOTH title and type (two surviving scalar fields), then close.
    fireEvent.change(screen.getByDisplayValue('Strahd von Zarovich'), {
      target: { value: 'Strahd the Damned' },
    })
    fireEvent.click(screen.getByText('Character'))
    fireEvent.click(screen.getByText('Location'))

    fireEvent.keyDown(window, { key: 'Escape' })

    // Two entries — one per field that drifted from snapshot.
    expect(recordActionMock).toHaveBeenCalledTimes(2)

    const calls = recordActionMock.mock.calls.map((c) => c[0])
    const fields = calls.map((e) => e.field).sort()
    expect(fields).toEqual(['label', 'type'])

    const labelEntry = calls.find((e) => e.field === 'label')
    expect(labelEntry).toMatchObject({
      type: 'editCardField',
      cardId: 'node-strahd',
      before: 'Strahd von Zarovich',
      after:  'Strahd the Damned',
    })

    const typeEntry = calls.find((e) => e.field === 'type')
    expect(typeEntry).toMatchObject({
      type: 'editCardField',
      cardId: 'node-strahd',
      before: 'character',
      after:  'location',
    })
  })

  it('emits no editCardField action on close when nothing changed', async () => {
    await renderModal()
    flushSave()
    recordActionMock.mockClear()

    // Open and close without touching anything.
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(recordActionMock).not.toHaveBeenCalled()
  })

  it('records before:"" (raw, not "Untitled") when the user types into a freshly-created empty card', async () => {
    // Regression: an earlier version persisted `title.trim() || "Untitled"`,
    // so the snapshot captured "Untitled" while createCard.dbRow.label stayed
    // "". Redo-create restored "" and redo-edit then refused (`before` !==
    // current). The fix: persist the raw label and let CampaignNode handle
    // the display-time fallback.
    const emptyCard = {
      ...sampleNode,
      data: { ...sampleNode.data, label: '' },
    }
    await renderModal({ node: emptyCard })
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

  it('emits multiple field edits in chronological order by last-dirty time (most recent on top)', async () => {
    await renderModal()
    flushSave()
    recordActionMock.mockClear()

    // 1) Change type first.
    fireEvent.click(screen.getByText('Character'))
    fireEvent.click(screen.getByText('Location'))
    act(() => { vi.advanceTimersByTime(50) })

    // 2) Touch title second — its last-dirty is later.
    fireEvent.change(screen.getByDisplayValue('Strahd von Zarovich'), {
      target: { value: 'Strahd v2' },
    })

    fireEvent.keyDown(window, { key: 'Escape' })

    // Push order: type first (older lastAt), label second.
    // Stack top = label (most recent action).
    expect(recordActionMock).toHaveBeenCalledTimes(2)
    expect(recordActionMock.mock.calls[0][0]).toMatchObject({
      type: 'editCardField', field: 'type',
    })
    expect(recordActionMock.mock.calls[1][0]).toMatchObject({
      type: 'editCardField', field: 'label',
    })
  })

  it('logs every connection click — add then remove in same session yields two undo entries', async () => {
    // Trust-preserving choice: every click is its own undo step. Even if the
    // user adds then removes within a session (net no change), they still get
    // two stack entries — undo once restores intermediate state, twice cancels.
    const otherNode = {
      id: 'node-ireena',
      data: { label: 'Ireena Kolyana', type: 'character' },
    }
    await renderModal({ allOtherNodes: [otherNode] })
    flushSave()
    recordActionMock.mockClear()

    // Add via the editor seam, then remove via the fixed panel's × button.
    fireEvent.click(screen.getByRole('button', { name: /add Ireena Kolyana/i }))
    act(() => { vi.advanceTimersByTime(50) })
    fireEvent.click(screen.getByRole('button', { name: /remove Ireena Kolyana/i }))

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(recordActionMock).toHaveBeenCalledTimes(2)
    expect(recordActionMock.mock.calls[0][0]).toMatchObject({ type: 'addConnection' })
    expect(recordActionMock.mock.calls[1][0]).toMatchObject({ type: 'removeConnection' })
    // Both entries carry the SAME connectionId (the client-side UUID assigned
    // when the connection was created — it stays stable through the whole
    // session even though the connection was never persisted long-term).
    expect(recordActionMock.mock.calls[0][0].connectionId)
      .toBe(recordActionMock.mock.calls[1][0].connectionId)
  })
})

describe('Inspector — avatar upload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    uploadOpenMock.mockClear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('opens the Upload Image modal in thumbnail mode and writes the saved path to thumbnail', async () => {
    const { props } = await renderModal()
    flushSave()
    props.onUpdate.mockClear()

    // sampleNode has avatar: null, so InspectorHeader renders the empty-state
    // "Add avatar" button. Clicking it should open the Upload Image modal
    // with the thumbnail-mode config.
    fireEvent.click(screen.getByRole('button', { name: /add avatar/i }))

    expect(uploadOpenMock).toHaveBeenCalledTimes(1)
    const cfg = uploadOpenMock.mock.calls[0][0]
    expect(cfg.mode).toBe('thumbnail')
    expect(cfg.pipeline).toBeTruthy()
    expect(typeof cfg.onSave).toBe('function')

    // Simulate the modal calling onSave with the Storage path it produced.
    // (The real flow is: user picks a file, crops it, presses Save → modal
    // runs pipeline.upload(blob) and invokes onSave with the returned path.)
    act(() => { cfg.onSave('mock/path.webp') })

    flushSave()

    const lastCall = props.onUpdate.mock.calls.at(-1)
    expect(lastCall[1].avatar).toBe('mock/path.webp')
  })
})

describe('Inspector — repoint commit (Chunk 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    recordActionMock.mockClear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('exposes commitSession on commitApiRef so App can commit before a repoint', async () => {
    const commitApiRef = { current: null }
    const { props } = await renderModal({ commitApiRef })
    flushSave()
    props.onUpdate.mockClear()
    recordActionMock.mockClear()

    fireEvent.change(screen.getByDisplayValue('Strahd von Zarovich'), {
      target: { value: 'Strahd the Damned' },
    })

    // App calls this synchronously right before swapping the topic node.
    expect(typeof commitApiRef.current).toBe('function')
    act(() => { commitApiRef.current() })

    // Pending edit is flushed to onUpdate immediately (no debounce wait)...
    expect(props.onUpdate).toHaveBeenCalledWith(
      'node-strahd',
      expect.objectContaining({ label: 'Strahd the Damned' }),
      expect.any(Object),
    )
    // ...and the outgoing node's undo entry is emitted.
    const labelEntry = recordActionMock.mock.calls
      .map((c) => c[0])
      .find((e) => e.type === 'editCardField' && e.field === 'label')
    expect(labelEntry).toMatchObject({ before: 'Strahd von Zarovich', after: 'Strahd the Damned' })
  })

  it('commitSession is idempotent — calling it twice emits the undo entry once', async () => {
    const commitApiRef = { current: null }
    await renderModal({ commitApiRef })
    flushSave()
    recordActionMock.mockClear()

    fireEvent.change(screen.getByDisplayValue('Strahd von Zarovich'), {
      target: { value: 'Strahd v2' },
    })

    act(() => { commitApiRef.current() })
    act(() => { commitApiRef.current() })

    const labelEntries = recordActionMock.mock.calls
      .map((c) => c[0])
      .filter((e) => e.type === 'editCardField' && e.field === 'label')
    expect(labelEntries).toHaveLength(1)
  })
})

describe('Inspector — docked mode (Chunk 2c)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders an edge-collapse close control instead of an X when docked', async () => {
    await renderModal({ mode: 'docked' })
    expect(screen.getByRole('button', { name: /collapse to edge/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument()
  })

  it('docked close calls onClose after the slide-down animation', async () => {
    const { props } = await renderModal({ mode: 'docked' })
    flushSave()

    fireEvent.click(screen.getByRole('button', { name: /collapse to edge/i }))
    // onClose is deferred until the slide-down finishes.
    expect(props.onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(260) })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Inspector — full-screen presentation on narrow viewports (MB-2)', () => {
  // Simulate a phone-narrow viewport: our useIsNarrowViewport hook asks
  // matchMedia('(max-width: 640px)'). Match that query only, so other
  // matchMedia consumers (e.g. reduced-motion) keep their defaults.
  let originalMatchMedia
  beforeEach(() => {
    vi.useFakeTimers()
    originalMatchMedia = window.matchMedia
    window.matchMedia = (query) => ({
      matches: query.includes('max-width'),
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    window.matchMedia = originalMatchMedia
  })

  it('renders the full-screen container regardless of the desktop mode prop', async () => {
    await renderModal({ mode: 'docked' })
    expect(screen.getByTestId('inspector-fullscreen')).toBeInTheDocument()
  })

  it('uses the X close control (not the docked chevron) and slides down to close', async () => {
    const { props } = await renderModal({ mode: 'docked' })
    flushSave()

    expect(screen.queryByRole('button', { name: /collapse to edge/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    // onClose is deferred until the slide-down finishes (same exit as docked).
    expect(props.onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(260) })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('still populates and edits the title (the B2 naming flow)', async () => {
    const { props } = await renderModal()
    flushSave()
    props.onUpdate.mockClear()

    const titleInput = screen.getByDisplayValue('Strahd von Zarovich')
    fireEvent.change(titleInput, { target: { value: 'Strahd on Mobile' } })
    flushSave()
    expect(props.onUpdate).toHaveBeenCalledWith(
      'node-strahd',
      expect.objectContaining({ label: 'Strahd on Mobile' }),
      expect.anything(),
    )
  })
})

describe('Inspector — directional close (Chunk 3)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('consults getCloseRect on close so the morph targets the node’s current position', async () => {
    const getCloseRect = vi.fn(() => ({ left: 200, top: 120, width: 256, height: 180 }))
    const { props } = await renderModal({
      getCloseRect,
      originRect: { left: 0, top: 0, width: 256, height: 180 },
    })
    flushSave()

    fireEvent.keyDown(window, { key: 'Escape' })

    // The exit morph recomputes the live rect rather than reusing originRect.
    expect(getCloseRect).toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(260) })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
