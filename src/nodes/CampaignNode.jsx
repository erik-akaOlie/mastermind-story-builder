import { useState } from 'react'
import { Handle, Position } from 'reactflow'
import { NODE_TYPES } from './nodeTypes'

const GripIcon = () => (
  <div className="flex flex-col gap-[3px] px-1 py-0.5 flex-shrink-0">
    <div className="flex gap-[3px]">
      <div className="w-[3px] h-[3px] rounded-full bg-white opacity-70" />
      <div className="w-[3px] h-[3px] rounded-full bg-white opacity-70" />
    </div>
    <div className="flex gap-[3px]">
      <div className="w-[3px] h-[3px] rounded-full bg-white opacity-70" />
      <div className="w-[3px] h-[3px] rounded-full bg-white opacity-70" />
    </div>
    <div className="flex gap-[3px]">
      <div className="w-[3px] h-[3px] rounded-full bg-white opacity-70" />
      <div className="w-[3px] h-[3px] rounded-full bg-white opacity-70" />
    </div>
  </div>
)

export default function CampaignNode({ data, selected }) {
  const [hovered, setHovered] = useState(false)
  const typeConfig = NODE_TYPES[data.type] || { label: data.type, color: data.color || '#6B7280' }

  const isEdgeHighlighted = data.hoveredEdgeNodeIds?.has(data.id)
  const anythingActive = data.anyHovered || data.hoveredEdgeNodeIds != null

  // Selected cards are always part of the user's active focus — never dimmed
  // Hover gives lift; selected gives lift only when nothing is being hovered
  const isActive = hovered || isEdgeHighlighted || selected
  const lifted = hovered || isEdgeHighlighted || (selected && !anythingActive)

  const baseopacity = data.locked ? 0.5 : 1
  const isDimmed = !isActive && (anythingActive || data.anySelected)
  const opacity = isDimmed ? baseopacity * 0.5 : baseopacity

  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 w-64
        transition-all duration-150
        ${lifted ? 'scale-[1.03] shadow-xl' : 'shadow-md'}
      `}
      style={{ opacity }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible center handles — floating edges compute their own border points */}
      <Handle type="source" position={Position.Top} className="opacity-0" style={{ top: '50%', left: '50%' }} />
      <Handle type="target" position={Position.Top} className="opacity-0" style={{ top: '50%', left: '50%' }} />

      {/* Header */}
      <div
        className="flex items-center rounded-t-lg px-2 py-2 gap-2"
        style={{ backgroundColor: typeConfig.color }}
      >
        <div className="cursor-grab active:cursor-grabbing">
          <GripIcon />
        </div>
        <span className="text-white font-semibold text-sm truncate flex-1">
          {data.label || 'Untitled'}
        </span>
        <span className="text-white text-xs opacity-75 flex-shrink-0">
          {typeConfig.label}
        </span>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="px-3 pt-2 pb-1 border-b border-gray-100">
          <p className="text-gray-500 text-xs leading-snug">{data.summary}</p>
        </div>
      )}

      {/* Body */}
      <div className="p-3 flex flex-col gap-2">
        {data.narrative && data.narrative.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {data.narrative.map((bullet, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 leading-snug">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                {bullet}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-300 text-xs italic">No content yet</p>
        )}
      </div>
    </div>
  )
}
