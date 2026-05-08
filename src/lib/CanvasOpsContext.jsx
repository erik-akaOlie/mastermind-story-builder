// ============================================================================
// CanvasOpsContext
// ----------------------------------------------------------------------------
// A thin React context that lets custom React Flow node renderers (CampaignNode,
// TextNode) call App-level operations like delete, without going through
// `useReactFlow().setNodes(filter)`.
//
// Why this exists: React Flow v11's `useReactFlow().setNodes` only emits
// `'reset'` changes for kept nodes when the controlled-mode `onNodesChange`
// callback is wired up. It does NOT emit `'remove'` changes for nodes that
// disappeared from the array unless ALL nodes are being removed. As a result,
// `setNodes((nds) => nds.filter(...))` from a custom node silently fails to
// propagate the removal to App's `useNodesState` — the row stays in App's
// state and the deleted node reappears as soon as anything causes a re-render.
//
// Custom nodes that need to delete themselves should use this context's
// callback, which routes through App's `setNodes` (the source of truth).
// ============================================================================

import { createContext, useContext } from 'react'

const CanvasOpsContext = createContext(null)

export function CanvasOpsProvider({ value, children }) {
  return <CanvasOpsContext.Provider value={value}>{children}</CanvasOpsContext.Provider>
}

export function useCanvasOps() {
  const ctx = useContext(CanvasOpsContext)
  if (!ctx) throw new Error('useCanvasOps must be used inside <CanvasOpsProvider>')
  return ctx
}
