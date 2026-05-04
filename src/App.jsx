import { useEffect, useRef, useState, useCallback } from 'react'
import ReactFlow, { Background, useNodesState, useEdgesState } from 'reactflow'
import { useTypeStore } from './store/useTypeStore'
import FloatingEdge from './edges/FloatingEdge'
import ContextMenu from './components/ContextMenu'
import CanvasContextMenu from './components/CanvasContextMenu'
import EditModal from './components/EditModal'
import { LightboxProvider } from './components/Lightbox'
import CampaignNode from './nodes/CampaignNode'
import TextNode from './nodes/TextNode'
import { useCampaign } from './lib/CampaignContext.jsx'
import {
  createNode as dbCreateNode,
  updateNode as dbUpdateNode,
  updateNodeSections as dbUpdateNodeSections,
  deleteNode as dbDeleteNode,
  buildDeleteCardSnapshot,
} from './lib/nodes.js'
import {
  createConnection as dbCreateConnection,
  deleteConnection as dbDeleteConnection,
} from './lib/connections.js'
import {
  createTextNode as dbCreateTextNode,
  updateTextNode as dbUpdateTextNode,
  deleteTextNode as dbDeleteTextNode,
} from './lib/textNodes.js'
import { useSpacebarPan } from './hooks/useSpacebarPan'
import { useCampaignData } from './hooks/useCampaignData'
import { useEdgeGeometry } from './hooks/useEdgeGeometry'
import { useNodeHoverSelection } from './hooks/useNodeHoverSelection'
import { useUndoShortcuts } from './hooks/useUndoShortcuts'
import { useUndoStore } from './store/useUndoStore'
import { ACTION_TYPES } from './lib/undo/index.js'
import { CanvasOpsProvider } from './lib/CanvasOpsContext.jsx'

const nodeTypes = {
  campaignNode: CampaignNode,
  textNode:     TextNode,
}

const edgeTypes = {
  floating: FloatingEdge,
}

export default function App() {
  const { activeCampaignId } = useCampaign()

  // Type-id lookups live in useTypeStore (per-user, hydrated on load).
  // Read via useTypeStore.getState().idByKey inside callbacks.

  // ── Canvas state ─────────────────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const { loading, loadError } = useCampaignData({
    campaignId: activeCampaignId,
    setNodes,
    setEdges,
  })

  const isPanning = useSpacebarPan()
  const [contextMenu, setContextMenu] = useState(null)  // { nodeId, x, y }
  const [canvasMenu,  setCanvasMenu]  = useState(null)  // { x, y, flowPos }
  const rfInstanceRef = useRef(null)

  // { node, connectedNodes, allOtherNodes, originRect }
  const [editingNode, setEditingNode] = useState(null)

  useEdgeGeometry({ nodes, edges, setNodes, setEdges })

  // Hover / selection UI (not persisted; backed by useCanvasUiStore so a
  // hover event mutates one atomic value instead of every node's data).
  const {
    onSelectionChange,
    onNodeMouseEnter,
    onNodeMouseLeave,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
  } = useNodeHoverSelection({ setEdges })

  // Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS, Ctrl+Y also accepted on Windows).
  // The hook captures nodes/edges/setters in a ref so the keydown listener
  // always sees fresh values without re-attaching every render.
  useUndoShortcuts({ nodes, edges, setNodes, setEdges })

  // ── Persist node position on drag end ────────────────────────────────────
  // Per-node start positions captured at drag start drive (a) the 4px-jitter
  // filter on the undo entry and (b) the entry's `before` snapshot. Stored
  // in a Map keyed by node id.
  //
  // RF v11 fires different events depending on how the selection was made:
  //   - shift+click multi-select drag → onNodeDragStart/Stop (the third arg
  //     `nodes` is the full dragged set; the second arg `node` is just the
  //     primary)
  //   - marquee multi-select drag     → onSelectionDragStart/Stop (the
  //     second arg `nodes` is the full dragged set)
  // Wiring both, iterating the full set in each, and de-duping via a
  // per-drag Set covers all cases — including the rare double-fire if both
  // events end up dispatching for the same drag.
  const dragStartPosRef  = useRef(new Map())
  const finalizedDragRef = useRef(new Set())

  const captureDragStart = useCallback((dragNodes) => {
    finalizedDragRef.current.clear()
    for (const n of dragNodes ?? []) {
      if (!n) continue
      dragStartPosRef.current.set(n.id, { x: n.position.x, y: n.position.y })
    }
  }, [])

  const finalizeDragStop = useCallback((dragNodes) => {
    // Collect every card from this drag into one moveCard entry so Ctrl+Z
    // reverts the whole drag in a single step (vs N steps for N cards).
    // Persist promises for THESE same cards are tracked so we can roll the
    // entry back as a unit if any of the writes fail.
    const cardMoves = []
    const cardPersists = []

    for (const n of dragNodes ?? []) {
      if (!n || finalizedDragRef.current.has(n.id)) continue
      finalizedDragRef.current.add(n.id)

      const start = dragStartPosRef.current.get(n.id)
      dragStartPosRef.current.delete(n.id)

      // 4px threshold filters out mouse-jitter "moves" that aren't real drags
      // (per ADR-0006 §"Action set covered" — moveCard fires only if Δ ≥ 4px).
      const movedFar =
        start &&
        Math.hypot(n.position.x - start.x, n.position.y - start.y) >= 4

      if (n.type === 'campaignNode') {
        const persist = dbUpdateNode(n.id, {
          positionX: n.position.x,
          positionY: n.position.y,
        })
        if (movedFar) {
          cardMoves.push({
            cardId: n.id,
            before: { x: start.x, y: start.y },
            after:  { x: n.position.x, y: n.position.y },
          })
          cardPersists.push(persist)
        } else {
          // Sub-threshold nudge — still persist, just no undo entry.
          persist.catch(console.error)
        }
      } else if (n.type === 'textNode') {
        const persist = dbUpdateTextNode(n.id, {
          positionX: n.position.x,
          positionY: n.position.y,
        })
        if (movedFar) {
          // moveTextNode is one entry per text node moved (no grouping).
          // The persist failure path pops by rolling back this specific
          // entry via popLastAction inside the .catch — same shape as the
          // grouped moveCard rollback but per-node.
          useUndoStore.getState().recordAction({
            type: ACTION_TYPES.MOVE_TEXT_NODE,
            campaignId: activeCampaignId,
            label: 'Move text',
            timestamp: new Date().toISOString(),
            textNodeId: n.id,
            before: { x: start.x, y: start.y },
            after:  { x: n.position.x, y: n.position.y },
          })
          persist.catch((err) => {
            console.error(err)
            // Best-effort rollback. Multi-node drags that mix cards and
            // text nodes can race here; in practice persists rarely fail
            // for valid writes, and the orphan entry would just refuse on
            // Ctrl+Z (canApplyInverse drift check). Acceptable.
            useUndoStore.getState().popLastAction()
          })
        } else {
          // Sub-threshold nudge — still persist, just no undo entry.
          persist.catch(console.error)
        }
      }
    }

    if (cardMoves.length === 0) return

    useUndoStore.getState().recordAction({
      type: ACTION_TYPES.MOVE_CARD,
      campaignId: activeCampaignId,
      label: cardMoves.length === 1 ? 'Move card' : `Move ${cardMoves.length} cards`,
      timestamp: new Date().toISOString(),
      cards: cardMoves,
    })

    // Roll back the grouped entry if any of its card persists fails
    // (ADR-0006 §4). One pop is correct here — the entry is a single unit.
    Promise.allSettled(cardPersists).then((results) => {
      const failures = results.filter((r) => r.status === 'rejected')
      if (failures.length > 0) {
        failures.forEach((r) => console.error(r.reason))
        useUndoStore.getState().popLastAction()
      }
    })
  }, [activeCampaignId])

  const onNodeDragStart = useCallback((_event, node, nodes) => {
    // Fall back to [node] in case `nodes` is undefined (defensive — RF v11
    // documents the third arg, but a single-node drag may pass it as the
    // 1-element array or omit it depending on the path).
    captureDragStart(nodes?.length ? nodes : [node])
  }, [captureDragStart])

  const onNodeDragStop = useCallback((_event, node, nodes) => {
    finalizeDragStop(nodes?.length ? nodes : [node])
  }, [finalizeDragStop])

  const onSelectionDragStart = useCallback((_event, nodes) => {
    captureDragStart(nodes)
  }, [captureDragStart])

  const onSelectionDragStop = useCallback((_event, nodes) => {
    finalizeDragStop(nodes)
  }, [finalizeDragStop])

  // ── Context menu plumbing ────────────────────────────────────────────────
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault()
    setCanvasMenu(null)
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault()
    if (!rfInstanceRef.current) return
    const flowPos = rfInstanceRef.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    setContextMenu(null)
    setCanvasMenu({ x: event.clientX, y: event.clientY, flowPos })
  }, [])

  // ── Add card (DB-backed) ─────────────────────────────────────────────────
  const addCardNode = useCallback(async (typeKey, flowPos) => {
    const typeId = useTypeStore.getState().idByKey[typeKey]
    if (!typeId) {
      console.error(`No type_id for key: ${typeKey}`)
      return
    }
    try {
      const newNode = await dbCreateNode({
        campaignId: activeCampaignId,
        typeId,
        typeKey,
        label: '',
        summary: '',
        positionX: flowPos.x,
        positionY: flowPos.y,
      })
      setNodes((nds) => [...nds, newNode])

      // Record the create AFTER the persist succeeds, so canApplyInverse's
      // existence check can rely on the card being in DB. dbRow captures
      // the inputs that recreate the card on redo (with explicit id).
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.CREATE_CARD,
        campaignId: activeCampaignId,
        label: 'Add card',
        timestamp: new Date().toISOString(),
        cardId: newNode.id,
        dbRow: {
          typeId,
          typeKey,
          label:     '',
          summary:   '',
          avatarUrl: null,
          positionX: flowPos.x,
          positionY: flowPos.y,
        },
      })

      setEditingNode({ node: newNode, connectedNodes: [], allOtherNodes: nodes, originRect: null })
    } catch (err) {
      console.error('Failed to create card:', err)
    }
  }, [activeCampaignId, nodes, setNodes])

  // ── Add text (DB-backed) ─────────────────────────────────────────────────
  const addTextNode = useCallback(async (flowPos) => {
    try {
      const newTextNode = await dbCreateTextNode({
        campaignId: activeCampaignId,
        contentHtml: '',
        positionX: flowPos.x,
        positionY: flowPos.y,
      })
      // Drop straight into edit mode on creation
      newTextNode.dragHandle = '.text-node-drag-handle'
      newTextNode.data = { ...newTextNode.data, editing: true }
      setNodes((nds) => [...nds, newTextNode])

      // Record AFTER the persist succeeds so canApplyInverse's existence
      // check can rely on the row being in DB. dbRow captures the fields
      // createTextNode writes; redo replays them via createTextNode({ id }).
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.CREATE_TEXT_NODE,
        campaignId: activeCampaignId,
        label: 'Add text',
        timestamp: new Date().toISOString(),
        textNodeId: newTextNode.id,
        dbRow: {
          id:           newTextNode.id,
          campaign_id:  activeCampaignId,
          content_html: '',
          position_x:   flowPos.x,
          position_y:   flowPos.y,
          width:        newTextNode.data.width,
          height:       newTextNode.data.height,
          font_size:    newTextNode.data.fontSize,
          align:        newTextNode.data.align,
        },
      })
    } catch (err) {
      console.error('Failed to create text node:', err)
    }
  }, [activeCampaignId, setNodes])

  // ── Edit modal: building state ───────────────────────────────────────────
  const getNodeOriginRect = (nodeId) => {
    const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
    return el ? el.getBoundingClientRect() : null
  }

  const buildEditingState = useCallback((nodeId) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return null
    const connectedEdges = edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    )
    const connectedNodes = connectedEdges
      .map((edge) => {
        const otherId = edge.source === nodeId ? edge.target : edge.source
        const other   = nodes.find((n) => n.id === otherId)
        if (!other) return null
        return {
          edgeId:  edge.id,
          nodeId:  otherId,
          label:   other.data.label,
          type:    other.data.type,
        }
      })
      .filter(Boolean)
    const allOtherNodes = nodes.filter((n) => n.id !== nodeId)
    const originRect    = getNodeOriginRect(nodeId)
    return { node, connectedNodes, allOtherNodes, originRect }
  }, [nodes, edges])

  const openEdit = useCallback((nodeId) => {
    const state = buildEditingState(nodeId)
    if (!state) return
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, isEditing: true } } : n
    ))
    setEditingNode(state)
  }, [buildEditingState, setNodes])

  const onNodeDoubleClick = useCallback((_, node) => {
    if (node.type === 'textNode') {
      setNodes((nds) => nds.map((n) =>
        n.id === node.id ? { ...n, draggable: true, dragHandle: '.text-node-drag-handle', data: { ...n.data, editing: true } } : n
      ))
      return
    }
    const state = buildEditingState(node.id)
    if (!state) return
    setNodes(nds => nds.map(n =>
      n.id === node.id ? { ...n, data: { ...n.data, isEditing: true } } : n
    ))
    setEditingNode(state)
  }, [buildEditingState, setNodes])

  // ── Update node (DB-backed) ─────────────────────────────────────────────
  //
  // Called from EditModal as the user edits. Applies the change optimistically
  // to React state, persists to Supabase in parallel, and handles connection
  // add/remove by updating the DB edges in the background.
  //
  // Connection payloads carry the connection's id (assigned client-side in
  // ConnectionsSection at picker click). EditModal owns the `recordAction`
  // calls for connections — App.jsx just persists. This lets EditModal
  // emit all undo entries for a session in chronological order at close,
  // mixing field edits and connection clicks correctly.
  //
  // `addConnections`    - [{ id, nodeId }] connections to create.
  // `removeConnections` - [{ id, nodeId }] connections to delete.
  const onUpdateNode = useCallback((nodeId, updatedData, { addConnections = [], removeConnections = [] } = {}) => {
    // --- Optimistic React update -------------------------------------------
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updatedData } } : n
      )
    )

    // --- Persist core node fields + sections -------------------------------
    const nodeField = {}
    if (updatedData.label !== undefined)   nodeField.label     = updatedData.label
    if (updatedData.summary !== undefined) nodeField.summary   = updatedData.summary
    if (updatedData.avatar !== undefined)  nodeField.avatarUrl = updatedData.avatar
    if (updatedData.type !== undefined) {
      const typeId = useTypeStore.getState().idByKey[updatedData.type]
      if (typeId) nodeField.typeId = typeId
    }
    if (Object.keys(nodeField).length > 0) {
      dbUpdateNode(nodeId, nodeField).catch(console.error)
    }

    const sectionsPatch = {}
    if (updatedData.storyNotes !== undefined) sectionsPatch.storyNotes = updatedData.storyNotes
    if (updatedData.hiddenLore !== undefined) sectionsPatch.hiddenLore = updatedData.hiddenLore
    if (updatedData.dmNotes    !== undefined) sectionsPatch.dmNotes    = updatedData.dmNotes
    if (updatedData.media      !== undefined) sectionsPatch.media      = updatedData.media
    if (Object.keys(sectionsPatch).length > 0) {
      // Sections API replaces all four; fill in any unspecified from current state.
      const current = nodes.find((n) => n.id === nodeId)
      const merged = {
        storyNotes: sectionsPatch.storyNotes ?? current?.data?.storyNotes ?? [],
        hiddenLore: sectionsPatch.hiddenLore ?? current?.data?.hiddenLore ?? [],
        dmNotes:    sectionsPatch.dmNotes    ?? current?.data?.dmNotes    ?? [],
        media:      sectionsPatch.media      ?? current?.data?.media      ?? [],
      }
      dbUpdateNodeSections(nodeId, merged).catch(console.error)
    }

    // --- Connection adds / removes -----------------------------------------
    // EditModal owns the recordAction calls (chronological ordering across
    // field edits and connection clicks). This block is purely persistence.
    if (addConnections.length === 0 && removeConnections.length === 0) return

    if (removeConnections.length > 0) {
      const removeIds = new Set(removeConnections.map((c) => c.id))
      setEdges((eds) => eds.filter((e) => !removeIds.has(e.id)))
      removeConnections.forEach(({ id }) => {
        dbDeleteConnection(id).catch(console.error)
      })
    }

    addConnections.forEach(({ id, nodeId: targetId }) => {
      dbCreateConnection({
        id,
        campaignId: activeCampaignId,
        sourceNodeId: nodeId,
        targetNodeId: targetId,
      })
        .then((edge) => {
          setEdges((eds) => (eds.some((e) => e.id === edge.id) ? eds : [...eds, edge]))
        })
        .catch(console.error)
    })
  }, [nodes, edges, activeCampaignId, setNodes, setEdges])

  // ── Duplicate (DB-backed) ───────────────────────────────────────────────
  const onDuplicate = useCallback(async (nodeId) => {
    const source = nodes.find((n) => n.id === nodeId)
    if (!source || source.type !== 'campaignNode') return
    const typeId = useTypeStore.getState().idByKey[source.data.type]
    if (!typeId) {
      console.error(`No type_id for key: ${source.data.type}`)
      return
    }
    try {
      const duplicate = await dbCreateNode({
        campaignId: activeCampaignId,
        typeId,
        typeKey: source.data.type,
        label: source.data.label,
        summary: source.data.summary,
        avatarUrl: source.data.avatar,
        positionX: source.position.x + 40,
        positionY: source.position.y + 40,
        storyNotes: source.data.storyNotes ?? [],
        hiddenLore: source.data.hiddenLore ?? [],
        dmNotes:    source.data.dmNotes    ?? [],
        media:      source.data.media      ?? [],
      })
      setNodes((nds) => [...nds, duplicate])
    } catch (err) {
      console.error('Failed to duplicate card:', err)
    }
  }, [activeCampaignId, nodes, setNodes])

  // ── Lock toggle — in-memory only (feature scoped out of V1) ─────────────
  const onLockToggle = useCallback((nodeId) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, locked: !n.data.locked } } : n
      )
    )
  }, [setNodes])

  // ── Delete (DB-backed, cascades to sections + connections) ──────────────
  const onDeleteNode = useCallback((nodeId) => {
    const target = nodes.find((n) => n.id === nodeId)
    if (!target) return

    if (target.type === 'textNode') {
      // Snapshot the full DB-shape row from current React state BEFORE the
      // optimistic removal. Text nodes have no dependent rows (no cascade),
      // so this is a single-row snapshot — much simpler than deleteCard's
      // restoreCardWithDependents path.
      const dbRow = {
        id:           target.id,
        campaign_id:  activeCampaignId,
        content_html: target.data.text ?? '',
        position_x:   target.position.x,
        position_y:   target.position.y,
        width:        target.data.width,
        height:       target.data.height ?? null,
        font_size:    target.data.fontSize,
        align:        target.data.align,
      }

      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))

      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.DELETE_TEXT_NODE,
        campaignId: activeCampaignId,
        label: 'Delete text',
        timestamp: new Date().toISOString(),
        textNodeId: target.id,
        dbRow,
      })

      dbDeleteTextNode(nodeId).catch((err) => {
        console.error(err)
        useUndoStore.getState().popLastAction()
      })
      return
    }

    // Card delete: snapshot dependents BEFORE the optimistic removal so the
    // inverse can rebuild card + sections + connections (per ADR-0006 §8).
    const snapshot = buildDeleteCardSnapshot(nodeId, {
      nodes,
      edges,
      campaignId: activeCampaignId,
      typeIdByKey: useTypeStore.getState().idByKey,
    })

    // Optimistic removal
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))

    if (snapshot) {
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.DELETE_CARD,
        campaignId: activeCampaignId,
        label: `Delete "${snapshot.dbCardRow.label || 'card'}"`,
        timestamp: new Date().toISOString(),
        dbCardRow:        snapshot.dbCardRow,
        dbSectionRows:    snapshot.dbSectionRows,
        dbConnectionRows: snapshot.dbConnectionRows,
      })
    }

    // Persist; rollback the undo entry if the write fails.
    dbDeleteNode(nodeId).catch((err) => {
      console.error(err)
      if (snapshot) useUndoStore.getState().popLastAction()
    })
  }, [nodes, edges, activeCampaignId, setNodes, setEdges])

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh' }} className="flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading campaign…</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ width: '100vw', height: '100vh' }} className="flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <div className="text-sm font-medium text-red-700 mb-1">Couldn't load campaign</div>
          <div className="text-xs text-gray-600">{loadError}</div>
        </div>
      </div>
    )
  }

  return (
    <LightboxProvider>
    <CanvasOpsProvider value={{ onDeleteNode }}>
    <div
      style={{ width: '100vw', height: '100vh' }}
      className={isPanning ? 'is-panning' : ''}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStart={onSelectionDragStart}
        onSelectionDragStop={onSelectionDragStop}
        onSelectionChange={onSelectionChange}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={() => { closeContextMenu(); setCanvasMenu(null) }}
        onPaneContextMenu={onPaneContextMenu}
        onInit={(rf) => { rfInstanceRef.current = rf }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnDrag={isPanning}
        panOnScroll={true}
        panOnScrollMode="vertical"
        zoomOnScroll={false}
        zoomActivationKeyCode="Control"
        zoomOnPinch={true}
        selectionOnDrag={!isPanning}
        selectionMode="partial"
        multiSelectionKeyCode="Shift"
        fitView
      >
        <Background color="#1f2937" />
      </ReactFlow>

      {contextMenu && (() => {
        const node = nodes.find((n) => n.id === contextMenu.nodeId)
        return node ? (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={node}
            onEdit={() => openEdit(contextMenu.nodeId)}
            onDuplicate={() => onDuplicate(contextMenu.nodeId)}
            onLockToggle={() => onLockToggle(contextMenu.nodeId)}
            onDelete={() => onDeleteNode(contextMenu.nodeId)}
            onClose={closeContextMenu}
          />
        ) : null
      })()}

      {canvasMenu && (
        <CanvasContextMenu
          x={canvasMenu.x}
          y={canvasMenu.y}
          onAddCard={(type) => addCardNode(type, canvasMenu.flowPos)}
          onAddText={() => addTextNode(canvasMenu.flowPos)}
          onClose={() => setCanvasMenu(null)}
        />
      )}

      {editingNode && (
        <EditModal
          node={editingNode.node}
          connectedNodes={editingNode.connectedNodes}
          allOtherNodes={editingNode.allOtherNodes}
          originRect={editingNode.originRect}
          onUpdate={onUpdateNode}
          onClose={() => {
            setNodes(nds => nds.map(n =>
              n.id === editingNode.node.id
                ? { ...n, data: { ...n.data, isEditing: false } }
                : n
            ))
            setEditingNode(null)
          }}
        />
      )}
    </div>
    </CanvasOpsProvider>
    </LightboxProvider>
  )
}
