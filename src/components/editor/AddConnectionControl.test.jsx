// ============================================================================
// AddConnectionControl tests — the Connections panel's restored add door
// (Erik go 2026-07-29). Pins:
//   - collapsed plus → expand-with-focus → typing filters → select creates
//     the connection through the canonical onAddConnection and collapses
//   - eligibility: already-connected nodes excluded (self-exclusion lives
//     upstream in allOtherNodes), alphabetical ordering
//   - keyboard: ArrowDown/Up + Enter, Escape abandons
//   - click-away abandons; keystrokes never propagate past the input
//     (BlockNote lives upstream)
//   - overflow: 12 shown + "+N more" hint so the cap never reads as complete
//   - empty states: no matches vs everything-already-connected
//   - analytics funnel: started / completed / abandoned
// Portal placement (flip-above, clamping) is placeDropdown's own concern.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('../../lib/analytics.js', () => ({ track: vi.fn() }))

import AddConnectionControl from './AddConnectionControl.jsx'
import { EditorProvider } from './EditorContext.jsx'
import { track } from '../../lib/analytics.js'

const mkNode = (id, label, type = 'character') => ({ id, data: { label, type } })

function renderControl({ connections = [], nodes, onAddConnection = vi.fn() } = {}) {
  const allOtherNodes = nodes ?? [
    mkNode('n-ireena', 'Ireena'),
    mkNode('n-strahd', 'Strahd'),
    mkNode('n-barovia', 'Barovia', 'location'),
  ]
  const value = { connections, allOtherNodes, onAddConnection }
  const utils = render(
    <EditorProvider value={value}>
      <AddConnectionControl />
    </EditorProvider>,
  )
  return { ...utils, onAddConnection }
}

const expand = () => fireEvent.click(screen.getByLabelText('Add connection'))
const input = () => screen.getByLabelText('Search nodes to connect')

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('expand / collapse', () => {
  it('renders the collapsed plus; clicking expands to the search input', () => {
    renderControl()
    expect(screen.queryByLabelText('Search nodes to connect')).toBeNull()
    expand()
    expect(input()).toBeTruthy()
    expect(track).toHaveBeenCalledWith('connection_started')
  })

  it('Escape collapses without adding and tracks abandonment', () => {
    const { onAddConnection } = renderControl()
    expand()
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(screen.queryByLabelText('Search nodes to connect')).toBeNull()
    expect(onAddConnection).not.toHaveBeenCalled()
    expect(track).toHaveBeenCalledWith('connection_abandoned')
  })

  it('clicking away collapses and tracks abandonment', () => {
    const { onAddConnection } = renderControl()
    expand()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByLabelText('Search nodes to connect')).toBeNull()
    expect(onAddConnection).not.toHaveBeenCalled()
    expect(track).toHaveBeenCalledWith('connection_abandoned')
  })
})

describe('eligibility + ordering', () => {
  it('lists eligible nodes alphabetically and excludes already-connected ones', () => {
    renderControl({ connections: [{ id: 'c1', nodeId: 'n-strahd' }] })
    expand()
    const items = screen.getAllByRole('button').filter((b) => b.textContent.includes('character') || b.textContent.includes('location'))
    expect(items.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Barovia'),
      expect.stringContaining('Ireena'),
    ])
    expect(screen.queryByText('Strahd')).toBeNull()
  })

  it('typing filters the menu by label', () => {
    renderControl()
    expand()
    fireEvent.change(input(), { target: { value: 'ir' } })
    expect(screen.getByText('Ireena')).toBeTruthy()
    expect(screen.queryByText('Barovia')).toBeNull()
    expect(screen.queryByText('Strahd')).toBeNull()
  })

  it('shows the no-matches state, and the all-connected state when nothing is eligible', () => {
    renderControl()
    expand()
    fireEvent.change(input(), { target: { value: 'zzz' } })
    expect(screen.getByText('No nodes match')).toBeTruthy()
    cleanup()

    renderControl({
      nodes: [mkNode('n1', 'Solo')],
      connections: [{ id: 'c1', nodeId: 'n1' }],
    })
    expand()
    expect(screen.getByText('Every node is already connected')).toBeTruthy()
  })

  it('caps the visible list at 12 and shows a "+N more" hint', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      mkNode(`n${i}`, `Node ${String(i).padStart(2, '0')}`),
    )
    renderControl({ nodes: many })
    expand()
    expect(screen.getByText('Node 00')).toBeTruthy()
    expect(screen.getByText('Node 11')).toBeTruthy()
    expect(screen.queryByText('Node 12')).toBeNull()
    expect(screen.getByText('+3 more — keep typing to narrow')).toBeTruthy()
  })
})

describe('selection', () => {
  it('clicking a result creates the connection and collapses back to the plus', () => {
    const { onAddConnection } = renderControl()
    expand()
    fireEvent.click(screen.getByText('Ireena'))
    expect(onAddConnection).toHaveBeenCalledTimes(1)
    expect(onAddConnection.mock.calls[0][0].id).toBe('n-ireena')
    expect(track).toHaveBeenCalledWith('connection_completed', { targetType: 'character' })
    expect(screen.queryByLabelText('Search nodes to connect')).toBeNull()
    expect(screen.getByLabelText('Add connection')).toBeTruthy()
  })

  it('Enter selects the first result; ArrowDown+Enter selects the second', () => {
    const { onAddConnection } = renderControl()
    expand()
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onAddConnection.mock.calls[0][0].id).toBe('n-barovia') // alphabetical first
    cleanup()

    const second = renderControl()
    expand()
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(second.onAddConnection.mock.calls[0][0].id).toBe('n-ireena')
  })

  it('a fresh query resets the keyboard highlight to the first result', () => {
    const { onAddConnection } = renderControl()
    expand()
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.change(input(), { target: { value: 'b' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onAddConnection.mock.calls[0][0].id).toBe('n-barovia')
  })
})

describe('BlockNote containment', () => {
  it('keystrokes in the search input do not propagate to ancestors', () => {
    const outer = vi.fn()
    render(
      <div onKeyDown={outer}>
        <EditorProvider value={{ connections: [], allOtherNodes: [mkNode('n1', 'A')], onAddConnection: vi.fn() }}>
          <AddConnectionControl />
        </EditorProvider>
      </div>,
    )
    expand()
    fireEvent.keyDown(input(), { key: '[' })
    fireEvent.keyDown(input(), { key: '/' })
    fireEvent.keyDown(input(), { key: 'a' })
    expect(outer).not.toHaveBeenCalled()
  })
})
