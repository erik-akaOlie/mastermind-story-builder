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

// Returns the point where a straight line from (cx, cy) toward targetPoint
// intersects a rectangle of size (w, h) centered on (cx, cy). Decoupled from
// any "node" shape so the same math can run against a React Flow node
// (passing its canvas dimensions) OR against a Chunk D hover-expanded card
// (passing its effective size at threshold-zoom and its clamped center).
export function getBorderIntersection(cx, cy, w, h, targetPoint) {
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

// Convenience wrapper that derives the rectangle from a React Flow node and
// delegates to getBorderIntersection. Kept so existing card-mode callers
// stay terse while Chunk D's expanded-card path uses the raw five-arg form
// with synthetic values.
export function getNodeBorderIntersection(node, targetPoint) {
  const w = node.width || NODE_WIDTH
  const h = node.height || NODE_HEIGHT
  return getBorderIntersection(
    node.position.x + w / 2,
    node.position.y + h / 2,
    w, h,
    targetPoint
  )
}

// Computes spread-out border connection points around a rectangle of size
// (w, h) centered on (cx, cy), ensuring no two dots on the same side are
// closer than MIN_GAP. Decoupled from any "node" shape — Chunk D's expanded
// hover-card passes synthetic dimensions (effective threshold-zoom size)
// and a clamped center; card-mode callers pass node-derived values via
// getNodeSpreadBorderPoints below.
//
// connections: [{ id: edgeId, targetCenter: {x, y} }]
// minGap / cornerPad: minimum dot-center spacing and corner inset, in CANVAS
//   units. Default to the static MIN_GAP / CORNER_PAD (fine at zoom ≈ 1), but
//   callers that route a node painted at a different on-screen scale than its
//   canvas extent — chiefly the Bead View hover-expanded card, whose canvas
//   footprint balloons as you zoom out — must pass screen-constant values
//   (desired_screen_px / zoom). Otherwise the fixed canvas gap shrinks to a
//   few on-screen px and aligned dots visually stack. Mirrors the circular
//   (bead) spreader, which is already screen-constant.
// Returns:     { [edgeId]: {x, y} }  — canvas-absolute coordinates
export function getSpreadBorderPoints(cx, cy, w, h, connections, minGap = MIN_GAP, cornerPad = CORNER_PAD) {
  if (connections.length === 0) return {}

  const left   = cx - w / 2
  const top    = cy - h / 2
  const right  = cx + w / 2
  const bottom = cy + h / 2

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

    const raw = getBorderIntersection(cx, cy, w, h, targetCenter)
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
    const rangeMin = (isVertical ? top  : left)  + cornerPad
    const rangeMax = (isVertical ? bottom : right) - cornerPad

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
      if (naturalPos[i] - naturalPos[i - 1] < minGap) {
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
      const totalSpan = minGap * (n - 1)
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
        finalPos = points.map((_, i) => start + i * minGap)
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

// Convenience wrapper that derives the rectangle from a React Flow node and
// delegates to getSpreadBorderPoints. Keeps the existing card-mode callsite
// terse while Chunk D's expanded-card branch uses the raw five-arg form
// with synthetic dimensions and the clamped center.
export function getNodeSpreadBorderPoints(node, connections, minGap, cornerPad) {
  const w = node.width || NODE_WIDTH
  const h = node.height || NODE_HEIGHT
  return getSpreadBorderPoints(
    node.position.x + w / 2,
    node.position.y + h / 2,
    w, h,
    connections,
    minGap, cornerPad
  )
}

// ── Circular-perimeter routing (bead mode, per ADR-0010 / Chunk C) ────────
// Mirrors the rectangular functions above for nodes rendered as beads. The
// dot's CENTER lands at exactly `radius` from the bead's center — i.e. on
// the outer edge of the container — so the dot extends half-inside the
// type-colored border and half-outside, keeping the dot visible against
// any border color (per Erik's Chunk C spec).

// Returns the point where a straight line from `center` toward `targetPoint`
// exits the circle of given `radius`. Mirrors getBorderIntersection.
export function getCircularIntersection(center, radius, targetPoint) {
  const dx = targetPoint.x - center.x
  const dy = targetPoint.y - center.y
  const dist = Math.hypot(dx, dy)
  if (dist < 0.001) return { x: center.x + radius, y: center.y }
  return {
    x: center.x + (dx / dist) * radius,
    y: center.y + (dy / dist) * radius,
  }
}

// Distributes connection points around a circular perimeter, separating
// adjacent points so their on-screen arc-distance is at least
// minArcCanvasPx. Mirrors getSpreadBorderPoints' shape (same input/output
// signature) so useEdgeGeometry can branch on shape mode cleanly.
//
// center:           canvas-absolute center of the bead
// radius:           canvas-px radius (= BEAD_DIAMETER_PX / 2)
// connections:      [{ id: edgeId, targetCenter: {x, y} }]
// minArcCanvasPx:   MIN_CIRCLE_POINT_GAP_PX / zoom — minimum arc-distance
//                   in canvas units (so the on-screen gap stays constant)
//
// Returns: { [edgeId]: {x, y} } — canvas-absolute coordinates of each
// connection point on the bead's perimeter.
export function getSpreadCircularPoints(center, radius, connections, minArcCanvasPx) {
  if (connections.length === 0) return {}

  // 1. Natural angle from bead center to each target. A dot's natural angle
  //    is the closest point on the bead's perimeter to its target — what
  //    the user expects when nothing is crowded.
  const points = connections.map(({ id, targetCenter }) => ({
    id,
    angle: Math.atan2(targetCenter.y - center.y, targetCenter.x - center.x),
  }))

  // Single-point fast path: no spreading possible.
  if (points.length === 1 || radius <= 0 || minArcCanvasPx <= 0) {
    return resolveAnglesToPoints(points, center, radius)
  }

  // 2. Sort by natural angle. Both the worst-case fallback below and the
  //    cluster-redistribute path further down assume a sorted array.
  points.sort((a, b) => a.angle - b.angle)

  const minAngleGap = minArcCanvasPx / radius
  const n = points.length

  // 3. Linearize: rotate the array so the LARGEST gap (incl. wrap-around)
  //    sits at the array's end. After this step the array's angles are
  //    monotonically increasing across a contiguous arc — no cluster spans
  //    the ±π boundary — so we can treat angles linearly and use arithmetic
  //    means. Hoisted above the worst-case branch so its midpoint anchor
  //    works correctly when the natural cluster wraps around ±π.
  let maxGap = 2 * Math.PI - (points[n - 1].angle - points[0].angle)
  let maxGapIdx = 0
  for (let i = 1; i < n; i++) {
    const gap = points[i].angle - points[i - 1].angle
    if (gap > maxGap) { maxGap = gap; maxGapIdx = i }
  }
  if (maxGapIdx > 0) {
    const rotated = points.slice(maxGapIdx).concat(
      points.slice(0, maxGapIdx).map((p) => ({ ...p, angle: p.angle + 2 * Math.PI }))
    )
    for (let i = 0; i < n; i++) points[i] = rotated[i]
  }

  // Worst-case fallback: even minimum-gap spacing doesn't fit in 2π
  // (happens at small radius + many connections, e.g. a bead at very
  // deep zoom-out). Distribute evenly around the full circle, anchored
  // so the midpoint of the distributed arc matches the midpoint of the
  // natural cluster's arc — i.e. the whole ring of dots gets rotated to
  // sit where the targets actually are, not at a hardcoded -π regardless
  // of where the cluster's center is.
  if (minAngleGap * n >= 2 * Math.PI) {
    const naturalMidpoint     = (points[0].angle + points[n - 1].angle) / 2
    const distributedMidpoint = (n - 1) * Math.PI / n
    const phi = naturalMidpoint - distributedMidpoint
    for (let i = 0; i < n; i++) {
      points[i].angle = phi + (i / n) * 2 * Math.PI
    }
    return resolveAnglesToPoints(points, center, radius)
  }

  // 4. Group consecutive close points into clusters (transitive: if A-B
  //    and B-C are each below the gap threshold, then A, B, C are one
  //    cluster — even if A-C would have been far enough on their own).
  //    Singletons (clusters of size 1) get left at their natural angle —
  //    that's the whole point: a non-crowded connection stays aimed at
  //    its target's exact direction.
  const clusters = [[points[0]]]
  for (let i = 1; i < n; i++) {
    const cur = clusters[clusters.length - 1]
    if (points[i].angle - cur[cur.length - 1].angle < minAngleGap) {
      cur.push(points[i])
    } else {
      clusters.push([points[i]])
    }
  }

  // 5. For each cluster with > 1 point, redistribute its members evenly
  //    around the cluster's natural mean — minAngleGap apart. Other
  //    clusters and singletons are untouched.
  for (const cluster of clusters) {
    if (cluster.length === 1) continue
    const k = cluster.length
    const meanAngle = cluster.reduce((s, p) => s + p.angle, 0) / k
    const totalSpan = minAngleGap * (k - 1)
    const start = meanAngle - totalSpan / 2
    for (let i = 0; i < k; i++) {
      cluster[i].angle = start + i * minAngleGap
    }
  }

  return resolveAnglesToPoints(points, center, radius)
}

function resolveAnglesToPoints(points, center, radius) {
  const result = {}
  for (const p of points) {
    result[p.id] = {
      x: center.x + Math.cos(p.angle) * radius,
      y: center.y + Math.sin(p.angle) * radius,
    }
  }
  return result
}
