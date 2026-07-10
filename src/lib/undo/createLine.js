// createLine — recreate at the original UUID via createLine({ id, ... }) so
// any later undo entry referring to this line still finds it. Mirrors
// createTextNode.

import { createLine, deleteLine } from '../lines.js'
import { checkLinePresent, checkLineAbsent } from './_lineHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = delete the line we just created. It must still exist.
  return checkLinePresent(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = recreate at the original UUID. Must currently be absent.
  return checkLineAbsent(entry, currentState)
}

export async function applyInverse(entry, { setNodes } = {}) {
  const id = entry.lineId
  if (!id) throw new Error('[undoActions] createLine: missing lineId')

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.filter((n) => n.id !== id))
  }
  await deleteLine(id)
}

export async function applyForward(entry, { setNodes } = {}) {
  const { lineId, dbRow } = entry
  if (!lineId || !dbRow) {
    throw new Error('[undoActions] createLine: missing lineId or dbRow')
  }
  const reactNode = await createLine({
    id:          lineId,
    workspaceId: entry.workspaceId,
    ax: dbRow.a_x,
    ay: dbRow.a_y,
    bx: dbRow.b_x,
    by: dbRow.b_y,
    weight:     dbRow.stroke_width,
    dashed:     dbRow.dashed,
    dashLength: dbRow.dash_length,
    dashGap:    dbRow.dash_gap,
    color:      dbRow.color,
  })

  if (typeof setNodes === 'function') {
    setNodes((nds) => (nds.some((n) => n.id === lineId) ? nds : [...nds, reactNode]))
  }
}
