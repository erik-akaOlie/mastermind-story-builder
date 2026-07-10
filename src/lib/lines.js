// ============================================================================
// Lines API
// ----------------------------------------------------------------------------
// Supabase CRUD for free-standing straight-line annotations on the canvas.
// A line is an organization/annotation tool with two absolute canvas anchors
// (A and B) — it is NOT a relationship and never references nodes. React Flow
// treats a line as a node with type='lineNode' whose position is the top-left
// of the line's padded bounding box; the anchors live in data as absolute
// canvas coordinates. Mirrors textNodes.js (same table-per-shape pattern).
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'

// Padding around the line's bounding box (canvas units). Gives the endpoint
// handles and the widened hit-stroke room to render without clipping, and
// keeps a perfectly horizontal/vertical line's box from collapsing to zero.
export const LINE_PAD = 16

export const LINE_DEFAULTS = Object.freeze({
  weight: 8,                // Erik 2026-07-10 (was 4)
  dashed: false,
  dashLength: 12,
  dashGap: 8,
  color: '#9CA3AF',
})

// Shift-constrained drawing: snap `point` onto the nearest of the four axes
// through `fixed` (horizontal, vertical, both 45° diagonals), preserving the
// distance from `fixed`. Used by placement (preview + commit) and endpoint
// re-anchoring; whole-line drags inherit App's existing shift-axis-lock.
export function snapToAxis(fixed, point) {
  const dx = point.x - fixed.x
  const dy = point.y - fixed.y
  if (dx === 0 && dy === 0) return { x: point.x, y: point.y }
  const step = Math.PI / 4
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  const len = Math.hypot(dx, dy)
  return { x: fixed.x + Math.cos(angle) * len, y: fixed.y + Math.sin(angle) * len }
}

// ----------------------------------------------------------------------------
// Load all lines for a workspace, shaped as React Flow nodes.
// ----------------------------------------------------------------------------
export async function loadLines(workspaceId) {
  const { data, error } = await supabase
    .from('lines')
    .select('*')
    .eq('workspace_id', workspaceId)
  if (error) throw error

  return data.map(dbLineToReactFlow)
}

// ----------------------------------------------------------------------------
// Create a new line. `id` is optional — pass it to recreate a line at a known
// UUID (undo's redo-create / undo-delete round-trip, same pattern as
// createTextNode).
// ----------------------------------------------------------------------------
export async function createLine({
  id,
  workspaceId,
  ax, ay, bx, by,
  weight     = LINE_DEFAULTS.weight,
  dashed     = LINE_DEFAULTS.dashed,
  dashLength = LINE_DEFAULTS.dashLength,
  dashGap    = LINE_DEFAULTS.dashGap,
  color      = LINE_DEFAULTS.color,
}) {
  return persistWrite(async () => {
    const insertRow = {
      workspace_id: workspaceId,
      a_x: ax,
      a_y: ay,
      b_x: bx,
      b_y: by,
      stroke_width: weight,
      dashed,
      dash_length:  dashLength,
      dash_gap:     dashGap,
      color,
    }
    if (id) insertRow.id = id

    const { data, error } = await supabase
      .from('lines')
      .insert(insertRow)
      .select()
      .single()
    if (error) throw error

    return dbLineToReactFlow(data)
  }, 'your line')
}

// ----------------------------------------------------------------------------
// Inverse of a line delete: re-insert the row with all its fields at its
// original UUID. Lines have no dependent rows, so this is a single insert.
// Realtime echoes the INSERT back, but useWorkspaceData's lines INSERT
// handler is idempotent (skips ids already in local state).
// ----------------------------------------------------------------------------
export async function restoreLine(dbRow) {
  return persistWrite(async () => {
    const { error } = await supabase.from('lines').insert(dbRow)
    if (error) throw error
  }, 'this restore')
}

// ----------------------------------------------------------------------------
// Update a line (any subset of fields).
// ----------------------------------------------------------------------------
export async function updateLine(id, {
  ax, ay, bx, by,
  weight,
  dashed,
  dashLength,
  dashGap,
  color,
}) {
  const patch = {}
  if (ax         !== undefined) patch.a_x          = ax
  if (ay         !== undefined) patch.a_y          = ay
  if (bx         !== undefined) patch.b_x          = bx
  if (by         !== undefined) patch.b_y          = by
  if (weight     !== undefined) patch.stroke_width = weight
  if (dashed     !== undefined) patch.dashed       = dashed
  if (dashLength !== undefined) patch.dash_length  = dashLength
  if (dashGap    !== undefined) patch.dash_gap     = dashGap
  if (color      !== undefined) patch.color        = color
  if (Object.keys(patch).length === 0) return

  return persistWrite(async () => {
    const { error } = await supabase.from('lines').update(patch).eq('id', id)
    if (error) throw error
  }, 'your line')
}

// ----------------------------------------------------------------------------
// Delete a line by its id.
// ----------------------------------------------------------------------------
export async function deleteLine(id) {
  return persistWrite(async () => {
    const { error } = await supabase.from('lines').delete().eq('id', id)
    if (error) throw error
  }, 'this deletion')
}

// ============================================================================
// Marshaling helpers (pure — unit-tested in lines.test.js)
// ============================================================================

// Padded-bounding-box position for a pair of anchors. Translation-invariant:
// moving both anchors by Δ moves the position by exactly Δ, which is what
// lets React Flow's whole-node drag map 1:1 onto an anchor translation.
export function linePositionFor({ ax, ay, bx, by }) {
  return { x: Math.min(ax, bx) - LINE_PAD, y: Math.min(ay, by) - LINE_PAD }
}

export function dbLineToReactFlow(l) {
  const data = {
    ax: Number(l.a_x),
    ay: Number(l.a_y),
    bx: Number(l.b_x),
    by: Number(l.b_y),
    weight:     Number(l.stroke_width),
    dashed:     Boolean(l.dashed),
    dashLength: Number(l.dash_length),
    dashGap:    Number(l.dash_gap),
    color:      l.color,
  }
  return {
    id:   l.id,
    type: 'lineNode',
    position: linePositionFor(data),
    draggable: true,
    data,
  }
}

// React line node → DB-shape row (the inverse of dbLineToReactFlow). Used by
// delete snapshots (single + batch) so undo can restore the exact row.
export function buildLineDbRow(node, workspaceId) {
  return {
    id:           node.id,
    workspace_id: workspaceId,
    a_x:          node.data.ax,
    a_y:          node.data.ay,
    b_x:          node.data.bx,
    b_y:          node.data.by,
    stroke_width: node.data.weight,
    dashed:       node.data.dashed,
    dash_length:  node.data.dashLength,
    dash_gap:     node.data.dashGap,
    color:        node.data.color,
  }
}
