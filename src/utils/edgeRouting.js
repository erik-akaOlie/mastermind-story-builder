const NODE_WIDTH = 256
const NODE_HEIGHT = 220 // approximate

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
