// ============================================================================
// Text Nodes API
// ----------------------------------------------------------------------------
// Supabase CRUD for free-floating text annotations on the canvas.
// React Flow treats these as nodes with type='textNode'; we store them in
// a separate `text_nodes` table so their shape can evolve independently.
// ============================================================================

import { supabase } from './supabase.js'

// ----------------------------------------------------------------------------
// Load all text annotations for a campaign, shaped as React Flow nodes.
// ----------------------------------------------------------------------------
export async function loadTextNodes(campaignId) {
  const { data, error } = await supabase
    .from('text_nodes')
    .select('*')
    .eq('campaign_id', campaignId)
  if (error) throw error

  return data.map(dbTextNodeToReactFlow)
}

// ----------------------------------------------------------------------------
// Create a new text annotation.
// ----------------------------------------------------------------------------
export async function createTextNode({
  campaignId,
  contentHtml = '',
  positionX = 0,
  positionY = 0,
  width = 256,
  height = null,
  fontSize = 18,
  align = 'left',
}) {
  const { data, error } = await supabase
    .from('text_nodes')
    .insert({
      campaign_id:  campaignId,
      content_html: contentHtml,
      position_x:   positionX,
      position_y:   positionY,
      width,
      height,
      font_size:    fontSize,
      align,
    })
    .select()
    .single()
  if (error) throw error

  return dbTextNodeToReactFlow(data)
}

// ----------------------------------------------------------------------------
// Update a text annotation (any subset of fields).
// ----------------------------------------------------------------------------
export async function updateTextNode(id, {
  contentHtml,
  positionX,
  positionY,
  width,
  height,
  fontSize,
  align,
}) {
  const patch = {}
  if (contentHtml !== undefined) patch.content_html = contentHtml
  if (positionX   !== undefined) patch.position_x   = positionX
  if (positionY   !== undefined) patch.position_y   = positionY
  if (width       !== undefined) patch.width        = width
  if (height      !== undefined) patch.height       = height
  if (fontSize    !== undefined) patch.font_size    = fontSize
  if (align       !== undefined) patch.align        = align
  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('text_nodes').update(patch).eq('id', id)
  if (error) throw error
}

// ----------------------------------------------------------------------------
// Delete a text annotation by its id.
// ----------------------------------------------------------------------------
export async function deleteTextNode(id) {
  const { error } = await supabase.from('text_nodes').delete().eq('id', id)
  if (error) throw error
}

// ============================================================================
// Internal helpers
// ============================================================================

function dbTextNodeToReactFlow(t) {
  return {
    id:   t.id,
    type: 'textNode',
    position: { x: Number(t.position_x), y: Number(t.position_y) },
    draggable: true,
    data: {
      text:     t.content_html,
      editing:  false,
      width:    Number(t.width),
      height:   t.height === null ? null : Number(t.height),
      fontSize: Number(t.font_size),
      align:    t.align,
    },
  }
}
