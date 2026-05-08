import { BaseEdge, getStraightPath } from 'reactflow'

export default function FloatingEdge({ data, style, selected }) {
  if (!data?.sourcePoint || !data?.targetPoint) return null

  const [path] = getStraightPath({
    sourceX: data.sourcePoint.x,
    sourceY: data.sourcePoint.y,
    targetX: data.targetPoint.x,
    targetY: data.targetPoint.y,
  })

  const stroke = style?.stroke || '#94a3b8'

  return (
    <BaseEdge
      path={path}
      style={{ stroke, strokeWidth: selected ? 2 : 1.5, ...style }}
    />
  )
}
