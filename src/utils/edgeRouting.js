const NODE_WIDTH = 256
const NODE_HEIGHT = 224 // approximate — ÷8 ✓

const MIN_GAP = 16    // minimum px between dot centers on the same side — ÷8 ✓
const CORNER_PAD = 8  // keep dots away from corners — ÷8 ✓

export function getNodeCenter(node) {
  const w = node.width || NODE_WIDTH
  const h = node.height || NODE_HEIGHT
  return {
    x: node.position.x + w / 2,
    y: node.position.y + h / 2,
  }
}

// Returns the point where a straight line from nodeCenter toward targetPoint
// intersects the node's rectangular border
export function getBorderIntersection(node, targetPoint) {
  const w = node.width || NODE_WIDTH
  const h = node.height || NODE_HEIGHT
  const cx = node.position.x + w / 2
  const cy = node.position.y + h / 2

  const dx = targetPoint.x - cx
  const dy = targetPoint.y - cy

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy }

  const hw = w / 2
  const hh = h / 2

  // Find the scale factor that brings us to the nearest edge
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity
  const scale = Math.min(scaleX, scaleY)

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  }
}

// Computes spread-out border connection points for all edges on a single node,
// ensuring no two dots on the same border side are closer than MIN_GAP.
//
// connections: [{ id: edgeId, targetCenter: {x, y} }]
// Returns:     { [edgeId]: {x, y} }  — canvas-absolute coordinates
export function getSpreadBorderPoints(node, connections) {
  if (connections.length === 0) return {}

  const w = node.width || NODE_WIDTH
  const h = node.height || NODE_HEIGHT
  const left   = node.position.x
  const top    = node.position.y
  const right  = left + w
  const bottom = top + h
  const cx = left + w / 2
  const cy = top + h / 2

  // 1. Compute raw intersection and classify which side each connection exits
  const pointData = connections.map(({ id, targetCenter }) => {
    const dx = targetCenter.x - cx
    const dy = targetCenter.y - cy
    const scaleX = Math.abs(dx) > 0.001 ? (w / 2) / Math.abs(dx) : Infinity
    const scaleY = Math.abs(dy) > 0.001 ? (h / 2) / Math.abs(dy) : Infinity

    let side
    if (scaleX <= scaleY) {
      side = dx >= 0 ? 'right' : 'left'
    } else {
      side = dy >= 0 ? 'bottom' : 'top'
    }

    const raw = getBorderIntersection(node, targetCenter)
    return { id, raw, side }
  })

  // 2. Group by side
  const bySide = { left: [], right: [], top: [], bottom: [] }
  pointData.forEach(p => bySide[p.side].push(p))

  const result = {}

  // 3. Process each side independently
  for (const [side, points] of Object.entries(bySide)) {
    if (points.length === 0) continue

    const isVertical = side === 'left' || side === 'right'
    const fixedCoord  = side === 'left' ? left : side === 'right' ? right
                      : side === 'top'  ? top  : bottom
    const rangeMin = (isVertical ? top  : left)  + CORNER_PAD
    const rangeMax = (isVertical ? bottom : right) - CORNER_PAD

    if (points.length === 1) {
      const p = points[0]
      const natural = isVertical ? p.raw.y : p.raw.x
      const clamped = Math.max(rangeMin, Math.min(rangeMax, natural))
      result[p.id] = isVertical
        ? { x: fixedCoord, y: clamped }
        : { x: clamped,    y: fixedCoord }
      continue
    }

    // Sort by natural position along this side
    points.sort((a, b) => {
      const posA = isVertical ? a.raw.y : a.raw.x
      const posB = isVertical ? b.raw.y : b.raw.x
      return posA - posB
    })

    const naturalPos = points.map(p => isVertical ? p.raw.y : p.raw.x)

    // Check if any adjacent pair needs spreading
    let needsSpread = false
    for (let i = 1; i < naturalPos.length; i++) {
      if (naturalPos[i] - naturalPos[i - 1] < MIN_GAP) {
        needsSpread = true
        break
      }
    }

    let finalPos
    if (!needsSpread) {
      // Natural spacing is fine — just clamp to the safe range
      finalPos = naturalPos.map(p => Math.max(rangeMin, Math.min(rangeMax, p)))
    } else {
      const n = points.length
      const totalSpan = MIN_GAP * (n - 1)
      const rangeLen  = rangeMax - rangeMin

      if (totalSpan >= rangeLen) {
        // Not enough room — distribute evenly across the full side
        finalPos = points.map((_, i) =>
          n === 1 ? (rangeMin + rangeMax) / 2
                  : rangeMin + (i / (n - 1)) * rangeLen
        )
      } else {
        // Center the spread group on the midpoint of natural positions
        const naturalCenter = (naturalPos[0] + naturalPos[n - 1]) / 2
        let start = naturalCenter - totalSpan / 2
        // Clamp so the group fits within [rangeMin, rangeMax]
        start = Math.max(rangeMin, Math.min(rangeMax - totalSpan, start))
        finalPos = points.map((_, i) => start + i * MIN_GAP)
      }
    }

    points.forEach((p, i) => {
      result[p.id] = isVertical
        ? { x: fixedCoord, y: finalPos[i] }
        : { x: finalPos[i], y: fixedCoord }
    })
  }

  return result
}
