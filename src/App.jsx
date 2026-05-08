import { useEffect, useState, useCallback } from 'react'
import ReactFlow, { Background, useNodesState, useEdgesState } from 'reactflow'
import 'reactflow/dist/style.css'
import CampaignNode from './nodes/CampaignNode'

const nodeTypes = {
  campaignNode: CampaignNode,
}

const initialNodes = [
  {
    id: '1',
    type: 'campaignNode',
    position: { x: 60, y: 60 },
    data: {
      label: 'Count Strahd von Zarovich',
      type: 'character',
      summary: 'Vampire lord of Barovia. The campaign\'s primary antagonist.',
      narrative: [
        'Ancient vampire lord, ruler of all Barovia',
        'Bound to the land by a dark pact with the entity known as Death',
        'Obsessed with Ireena — believes she is the reincarnation of Tatyana',
        'Intelligent, patient, and theatrical — treats the players as entertainment',
        'Cannot be permanently destroyed while the Dark Powers hold sway',
      ],
    },
  },
  {
    id: '2',
    type: 'campaignNode',
    position: { x: 380, y: 60 },
    data: {
      label: 'Castle Ravenloft',
      type: 'location',
      summary: 'Strahd\'s seat of power. Looms over all of Barovia.',
      narrative: [
        'Perched above the Luna River gorge, visible from nearly everywhere',
        'Contains the Amber Temple\'s dark gifts hidden in the catacombs',
        'The Heart of Sorrow — a giant crystal heart linked to Strahd\'s life force',
        'Dozens of rooms, many sealed or trapped',
      ],
    },
  },
  {
    id: '3',
    type: 'campaignNode',
    position: { x: 60, y: 380 },
    data: {
      label: 'Ireena Kolyana',
      type: 'character',
      summary: 'The campaign\'s ward. Strahd believes she is Tatyana reborn.',
      narrative: [
        'Daughter of the late Burgomaster Kolyan Indirovich',
        'Has been bitten twice by Strahd — a third bite will turn her',
        'Strong-willed, refuses to be treated as a victim',
        'Her fate is the emotional core of the campaign',
      ],
    },
  },
  {
    id: '4',
    type: 'campaignNode',
    position: { x: 380, y: 380 },
    data: {
      label: 'Keepers of the Feather',
      type: 'faction',
      summary: 'Secret wereraven society. Quietly resist Strahd.',
      narrative: [
        'Oppose Strahd but act cautiously — avoid direct confrontation',
        'Run the Blue Water Inn in Vallaki as a front',
        'Can provide safe refuge and information to trusted allies',
        'Led by the Martikov family',
      ],
    },
  },
  {
    id: '5',
    type: 'campaignNode',
    position: { x: 700, y: 60 },
    data: {
      label: 'The Dark Powers\' Bargain',
      type: 'story',
      summary: 'The pact that created Strahd and sealed Barovia from the world.',
      narrative: [
        'Strahd sold his soul the day he murdered Sergei and drank Tatyana\'s blood',
        'Death itself claimed him — he became the first vampire',
        'Barovia was sealed as his eternal prison and playground',
        'Resolution requires breaking the pact or fulfilling the Tarokka prophecy',
      ],
    },
  },
  {
    id: '6',
    type: 'campaignNode',
    position: { x: 700, y: 380 },
    data: {
      label: 'The Sunsword',
      type: 'item',
      summary: 'One of three artifacts capable of permanently destroying Strahd.',
      narrative: [
        'A longsword with a blade of pure radiant energy',
        'Hilt is hidden; the blade spirit must be reunited with it',
        'The spirit of Sergei von Zarovich is bound within',
        'Radiates sunlight when activated — devastating to undead',
      ],
    },
  },
  {
    id: '7',
    type: 'campaignNode',
    position: { x: 60, y: 700 },
    data: {
      label: 'Village of Barovia',
      type: 'location',
      summary: 'The first settlement players encounter. A portrait of despair.',
      narrative: [
        'Population crushed by fear — most villagers are hollow and withdrawn',
        'Mary searches endlessly for her missing daughter Gertruda',
        'The Blood on the Vine tavern is the only gathering place',
        'Strahd\'s castle is visible from the village square on clear nights',
      ],
    },
  },
  {
    id: '8',
    type: 'campaignNode',
    position: { x: 380, y: 700 },
    data: {
      label: 'Vistani',
      type: 'faction',
      summary: 'Nomadic travelers who move freely through the mists.',
      narrative: [
        'Appear to serve Strahd — most do so willingly',
        'Madam Eva leads the largest camp at Tser Pool',
        'Some Vistani secretly oppose Strahd and aid outsiders',
        'The only people who can reliably navigate the mists',
      ],
    },
  },
]

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e1-3', source: '1', target: '3' },
  { id: 'e1-5', source: '1', target: '5' },
  { id: 'e1-4', source: '1', target: '4' },
  { id: 'e2-5', source: '2', target: '5' },
  { id: 'e3-7', source: '3', target: '7' },
  { id: 'e4-2', source: '4', target: '2' },
  { id: 'e6-1', source: '6', target: '1' },
  { id: 'e8-1', source: '8', target: '1' },
]

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.map((n) => ({ ...n, data: { ...n.data, id: n.id } }))
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [isPanning, setIsPanning] = useState(false)

  const onSelectionChange = useCallback(({ nodes: selected }) => {
    const anySelected = selected.length > 0
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, anySelected } }))
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

  const handleKeyDown = useCallback((e) => {
    if (e.code === 'Space' && !e.repeat) {
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
        onSelectionChange={onSelectionChange}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        nodeTypes={nodeTypes}
        panOnDrag={isPanning}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        selectionOnDrag={false}
        fitView
      >
        <Background />
      </ReactFlow>
    </div>
  )
}
