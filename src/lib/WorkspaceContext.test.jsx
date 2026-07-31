// ============================================================================
// WorkspaceContext tests — invalid-workspace recovery (bug-2 fix, 2026-07-31)
// ----------------------------------------------------------------------------
// The app could provably enter an invalid active-workspace state: `?w=` can
// point at a deleted workspace (delete → browser Back; stale bookmark; reload
// of a tab whose workspace was deleted elsewhere), which loaded as a normal-
// looking empty canvas whose every write then failed. Pinned here:
//   - a DEFINITIVE null row (signed-in) clears the id, REPLACES the dead URL
//     in history (Back must not loop), and sets the one-shot notice;
//   - a thrown (transient) error never ejects the user;
//   - pre-auth, nothing is fetched or interpreted (deep links must survive
//     the sign-in round-trip).
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext.jsx'

const { mockGetWorkspace, mockAuth } = vi.hoisted(() => ({
  mockGetWorkspace: vi.fn(),
  mockAuth: { session: null, loading: false },
}))

vi.mock('./AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}))
vi.mock('./workspaces.js', () => ({
  getWorkspace: mockGetWorkspace,
  touchWorkspaceOpened: vi.fn().mockResolvedValue(undefined),
}))

function Probe() {
  const { activeWorkspaceId, workspaceNotice } = useWorkspace()
  return (
    <div>
      <div data-testid="active-id">{activeWorkspaceId ?? 'none'}</div>
      <div data-testid="notice">{workspaceNotice ?? 'none'}</div>
    </div>
  )
}

function renderWithUrl(workspaceId) {
  window.history.replaceState(null, '', workspaceId ? `/?w=${workspaceId}` : '/')
  return render(
    <WorkspaceProvider>
      <Probe />
    </WorkspaceProvider>,
  )
}

describe('WorkspaceContext — invalid-workspace recovery', () => {
  let replaceSpy
  let pushSpy

  beforeEach(() => {
    mockGetWorkspace.mockReset()
    mockAuth.session = { user: { id: 'u1' } }
    mockAuth.loading = false
    replaceSpy = vi.spyOn(window.history, 'replaceState')
    pushSpy = vi.spyOn(window.history, 'pushState')
  })

  afterEach(() => {
    replaceSpy.mockRestore()
    pushSpy.mockRestore()
    window.history.replaceState(null, '', '/')
  })

  it('recovers from an unavailable workspace: clears the id, replaces the URL, sets the notice', async () => {
    mockGetWorkspace.mockResolvedValue(null) // .maybeSingle(): definitively unavailable
    renderWithUrl('dead-id')

    await waitFor(() => {
      expect(screen.getByTestId('active-id').textContent).toBe('none')
    })
    expect(screen.getByTestId('notice').textContent).toBe(
      'The workspace you were trying to reach is no longer available, so we’ve returned you to your library.',
    )
    // History REPLACE (not push): Back must not loop into the dead ?w= URL.
    const recoveryReplace = replaceSpy.mock.calls.find(
      ([, , url]) => typeof url === 'string' && !url.includes('w=dead-id'),
    )
    expect(recoveryReplace).toBeTruthy()
    expect(window.location.search).not.toContain('dead-id')
  })

  it('a transient fetch error never ejects the user from the workspace', async () => {
    mockGetWorkspace.mockRejectedValue(new Error('network down'))
    renderWithUrl('real-id')

    await waitFor(() => expect(mockGetWorkspace).toHaveBeenCalled())
    // Give the rejection handler a tick, then confirm nothing was cleared.
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('active-id').textContent).toBe('real-id')
    expect(screen.getByTestId('notice').textContent).toBe('none')
  })

  it('a real workspace stays active', async () => {
    mockGetWorkspace.mockResolvedValue({ id: 'real-id', name: 'Barovia' })
    renderWithUrl('real-id')

    await waitFor(() => expect(mockGetWorkspace).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('active-id').textContent).toBe('real-id')
    expect(screen.getByTestId('notice').textContent).toBe('none')
  })

  it('pre-auth: nothing is fetched or interpreted, so deep links survive sign-in', async () => {
    mockAuth.session = null
    mockGetWorkspace.mockResolvedValue(null) // would look "unavailable" if consulted
    renderWithUrl('deep-link-id')

    await new Promise((r) => setTimeout(r, 20))
    expect(mockGetWorkspace).not.toHaveBeenCalled()
    expect(screen.getByTestId('active-id').textContent).toBe('deep-link-id')
  })

  it('while auth is still hydrating: same — no fetch, no interpretation', async () => {
    mockAuth.session = { user: { id: 'u1' } }
    mockAuth.loading = true
    mockGetWorkspace.mockResolvedValue(null)
    renderWithUrl('deep-link-id')

    await new Promise((r) => setTimeout(r, 20))
    expect(mockGetWorkspace).not.toHaveBeenCalled()
    expect(screen.getByTestId('active-id').textContent).toBe('deep-link-id')
  })
})
