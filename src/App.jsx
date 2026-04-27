import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ReactFlow, { Background, useNodesState, useEdgesState } from 'reactflow'
import { getNodeCenter, getSpreadBorderPoints } from './utils/edgeRouting'
import { useTypeStore } from './store/useTypeStore'
import FloatingEdge from './edges/FloatingEdge'
import ContextMenu from './components/ContextMenu'
import CanvasContextMenu from './components/CanvasContextMenu'
import EditModal from './components/EditModal'
import CampaignNode from './nodes/CampaignNode'
import TextNode from './nodes/TextNode'
import { useCampaign } from './lib/CampaignContext.jsx'
import { ensureBuiltinTypes } from './lib/campaigns.js'
import {
  loadNodes,
  createNode as dbCreateNode,
  updateNode as dbUpdateNode,
  updateNodeSections as dbUpdateNodeSections,
  deleteNode as dbDeleteNode,
} from './lib/nodes.js'
import {
  loadConnections,
  createConnection as dbCreateConnection,
  deleteConnection as dbDeleteConnection,
} from './lib/connections.js'
import {
  loadTextNodes,
  createTextNode as dbCreateTextNode,
  updateTextNode as dbUpdateTextNode,
  deleteTextNode as dbDeleteTextNode,
} from './lib/textNodes.js'

const nodeTypes = {
  campaignNode: CampaignNode,
  textNode:     TextNode,
}

const edgeTypes = {
  floating: FloatingEdge,
}

export default function App() {
  const { activeCampaignId } = useCampaign()

  // ── Persistence / load state ─────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Type-id lookups now live in useTypeStore (per-user, hydrated on load).
  // Read via useTypeStore.getState().idByKey inside callbacks.

  // ── Canvas state ─────────────────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const [isPanning,   setIsPanning]   = useState(false)
  const [contextMenu, setContextMenu] = useState(null)  // { nodeId, x, y }
  const [canvasMenu,  setCanvasMenu]  = useState(null)  // { x, y, flowPos }
  const rfInstanceRef = useRef(null)

  // { node, connectedNodes, allOtherNodes, originRect }
  const [editingNode, setEditingNode] = useState(null)

  // Refs to guard against re-running when nothing geometrically changed
  const prevEdgeGeoRef = useRef('')
  const prevDotsRef    = useRef('')

  // ── Load campaign data on mount / campaign change ───────────────────────
  useEffect(() => {
    if (!activeCampaignId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        // Types live at the user level. ensureBuiltinTypes is idempotent:
        // it inserts any of the five defaults the user is missing and
        // returns the full list (built-in + custom).
        const types = await ensureBuiltinTypes()

        // Hydrate the in-memory type store so components reading via
        // useNodeTypes() get the latest set without having to refetch.
        useTypeStore.getState().hydrate(types)

        // keyById is still needed locally to translate DB rows back to the
        // flat React shape inside loadNodes.
        const keyById = {}
        for (const t of types) {
          keyById[t.id] = { key: t.key, color: t.color, label: t.label, iconName: t.icon_name }
        }

        const [campaignNodes, campaignConnections, campaignTextNodes] = await Promise.all([
          loadNodes(activeCampaignId, keyById),
          loadConnections(activeCampaignId),
          loadTextNodes(activeCampaignId),
        ])

        if (cancelled) return

        setNodes([...campaignNodes, ...campaignTextNodes])
        setEdges(campaignConnections)
      } catch (err) {
        if (!cancelled) setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [activeCampaignId, setNodes, setEdges])

  // ── Recompute spread connection points whenever nodes move ──────────────
  useEffect(() => {
    const nodeConnections = {}
    nodes.forEach((n) => { nodeConnections[n.id] = [] })

    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source)
      const targetNode = nodes.find((n) => n.id === edge.target)
      if (!sourceNode || !targetNode) return

      const sourceCenter = getNodeCenter(sourceNode)
      const targetCenter = getNodeCenter(targetNode)

      nodeConnections[edge.source].push({ id: edge.id, targetCenter })
      nodeConnections[edge.target].push({ id: edge.id, targetCenter: sourceCenter })
    })

    const allBorderPoints = {}
    nodes.forEach((node) => {
      allBorderPoints[node.id] = getSpreadBorderPoints(node, nodeConnections[node.id] || [])
    })

    const newEdgeGeo = {}
    edges.forEach((edge) => {
      const sourcePoint = allBorderPoints[edge.source]?.[edge.id]
      const targetPoint = allBorderPoints[edge.target]?.[edge.id]
      if (!sourcePoint || !targetPoint) return
      newEdgeGeo[edge.id] = { sourcePoint, targetPoint }
    })

    const newDotsMap = {}
    nodes.forEach((node) => {
      const borderPoints = allBorderPoints[node.id] || {}
      newDotsMap[node.id] = Object.entries(borderPoints).map(([edgeId, p]) => {
        const edge = edges.find((e) => e.id === edgeId)
        const otherNodeId = edge?.source === node.id ? edge?.target : edge?.source
        const otherNode = nodes.find((n) => n.id === otherNodeId)
        const color = useTypeStore.getState().types[otherNode?.data?.type]?.color ?? '#94a3b8'
        return {
          x: p.x - node.position.x,
          y: p.y - node.position.y,
          color,
        }
      })
    })

    const edgeGeoJson = JSON.stringify(newEdgeGeo)
    const dotsJson    = JSON.stringify(newDotsMap)

    if (edgeGeoJson !== prevEdgeGeoRef.current) {
      prevEdgeGeoRef.current = edgeGeoJson
      setEdges((eds) =>
        eds.map((edge) => {
          const geo = newEdgeGeo[edge.id]
          if (!geo) return edge
          return { ...edge, type: 'floating', data: { ...edge.data, ...geo } }
        })
      )
    }

    if (dotsJson !== prevDotsRef.current) {
      prevDotsRef.current = dotsJson
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, connectionDots: newDotsMap[n.id] || [] },
        }))
      )
    }
  }, [nodes, edges, setEdges, setNodes])

  // ── Hover / selection UI (not persisted) ─────────────────────────────────
  const onSelectionChange = useCallback(({ nodes: selected }) => {
    const anySelected = selected.length > 0
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, anySelected } }))
    )
  }, [setNodes])

  const onNodeMouseEnter = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, anyHovered: true } }))
    )
  }, [setNodes])

  const onNodeMouseLeave = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, anyHovered: false } }))
    )
  }, [setNodes])

  const onEdgeMouseEnter = useCallback((_, edge) => {
    const connectedIds = new Set([edge.source, edge.target])
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, hoveredEdgeNodeIds: connectedIds } }))
    )
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edge.id
          ? { ...e, style: { ...e.style, opacity: 1, strokeWidth: 2 } }
          : e
      )
    )
  }, [setNodes, setEdges])

  const onEdgeMouseLeave = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, hoveredEdgeNodeIds: null } }))
    )
    setEdges((eds) =>
      eds.map((e) => ({ ...e, style: { ...e.style, opacity: undefined, strokeWidth: undefined } }))
    )
  }, [setNodes, setEdges])

  // ── Persist node position on drag end ────────────────────────────────────
  const onNodeDragStop = useCallback((_, node) => {
    if (node.type === 'campaignNode') {
      dbUpdateNode(node.id, {
        positionX: node.position.x,
        positionY: node.position.y,
      }).catch(console.error)
    } else if (node.type === 'textNode') {
      dbUpdateTextNode(node.id, {
        positionX: node.position.x,
        positionY: node.position.y,
      }).catch(console.error)
    }
  }, [])

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
    const pane = event.currentTarget
    const rect = pane.getBoundingClientRect()
    const flowPos = rfInstanceRef.current.project({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
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
  // `addNodeIds`    - node IDs to connect TO this node.
  // `removeNodeIds` - node IDs to disconnect FROM this node.
  const onUpdateNode = useCallback((nodeId, updatedData, { addNodeIds = [], removeNodeIds = [] } = {}) => {
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
    if (addNodeIds.length === 0 && removeNodeIds.length === 0) return

    // Work from the CURRENT edges snapshot.
    const edgesToRemove = edges.filter((e) => {
      const other = e.source === nodeId ? e.target : e.source
      return (e.source === nodeId || e.target === nodeId) && removeNodeIds.includes(other)
    })
    const existingOthers = new Set(
      edges
        .filter((e) => e.source === nodeId || e.target === nodeId)
        .map((e) => (e.source === nodeId ? e.target : e.source))
    )
    const trulyNewTargets = addNodeIds.filter((tid) => !existingOthers.has(tid))

    // Optimistic edge removal
    if (edgesToRemove.length > 0) {
      const removeIds = new Set(edgesToRemove.map((e) => e.id))
      setEdges((eds) => eds.filter((e) => !removeIds.has(e.id)))
      edgesToRemove.forEach((e) => {
        dbDeleteConnection(e.id).catch(console.error)
      })
    }

    // Persist + append new edges
    trulyNewTargets.forEach((targetId) => {
      dbCreateConnection({
        campaignId: activeCampaignId,
        sourceNodeId: nodeId,
        targetNodeId: targetId,
      })
        .then((edge) => {
          setEdges((eds) => [...eds, edge])
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
    // Optimistic removal
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    // Persist
    if (target?.type === 'textNode') {
      dbDeleteTextNode(nodeId).catch(console.error)
    } else {
      dbDeleteNode(nodeId).catch(console.error)
    }
  }, [nodes, setNodes, setEdges])

  // ── Keyboard: spacebar pan ──────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (e.code === 'Space' && !e.repeat) {
      const tag = document.activeElement?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' ||
        document.activeElement?.isContentEditable
      if (isEditable) return
      e.preventDefault()
      setIsPanning(true)
    }
  }, [])

  const handleKeyUp = useCallback((e) => {
    if (e.code === 'Space') {
      setIsPanning(false)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

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
    <div
      style={{ width: '100vw', height: '100vh' }}
      className={isPanning ? 'is-panning' : ''}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
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
        <Background />
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
  )
}
