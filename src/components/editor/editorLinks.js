// ============================================================================
// editorLinks — inline [[Node]] link helpers (block-editor Phase 2, Chunk C)
// ----------------------------------------------------------------------------
// The product-defining interaction (ADR-0016 §4): typing [[ opens a node-name
// autocomplete; choosing a node inserts an inline link AND declares a
// connection. Plain text is just text; brackets mean "draw a line."
//
// These are pure helpers over a BlockNote editor instance so they can be reused
// across both zone editors and unit-reasoned about. The [[ trigger uses the
// measured single-"[" workaround from the spike (ADR-0016 §5): BlockNote
// re-triggers on the SECOND "[", so we trigger on "[", search the query
// directly, and strip the stray leading "[" after insert.
// ============================================================================

// Filter the candidate nodes for the [[ autocomplete. `allOtherNodes` are React
// Flow nodes ({ id, data: { label, type } }); match on label, cap the list.
export function searchNodes(allOtherNodes, query) {
  const q = (query || '').toLowerCase().trim()
  const list = allOtherNodes || []
  const matched = q
    ? list.filter((n) => (n.data?.label || '').toLowerCase().includes(q))
    : list
  return matched.slice(0, 12)
}

// Insert an inline [[Node]] link at the cursor and declare the connection.
// `node` is a React Flow node; `onAddConnection(node)` is the Inspector's
// existing connection-add flow (dedupes by node, persists, undoes).
export function insertNodeLink(editor, node, onAddConnection) {
  const nodeId = node.id
  const label = node.data?.label || 'Untitled'

  editor.insertInlineContent([{ type: 'nodeLink', props: { nodeId, label } }, ' '])

  // Strip the stray leading "[" the double-bracket leaves behind (spike finding).
  const block = editor.getTextCursorPosition().block
  if (Array.isArray(block.content)) {
    const idx = block.content.findIndex(
      (it) => it.type === 'nodeLink' && it.props?.nodeId === nodeId,
    )
    const prev = idx > 0 ? block.content[idx - 1] : null
    if (prev && prev.type === 'text' && prev.text.endsWith('[')) {
      const newContent = [...block.content]
      newContent[idx - 1] = { ...prev, text: prev.text.slice(0, -1) }
      editor.updateBlock(block, { content: newContent })
    }
  }

  // Declaring the relationship is the whole point of the brackets.
  onAddConnection?.(node)
}

// Revert every [[link]] pointing at `nodeId` back to plain text (the words
// stay; the link dies). Called when a connection is deleted (ADR-0016 §7) —
// run across every mounted zone editor so links in either zone are cleaned up.
// Walks nested blocks too (a link can live inside a nested list item). Returns
// the number of links reverted, so the caller can diagnose a no-op.
export function revertLinksForNode(editor, nodeId) {
  if (!editor || typeof editor.updateBlock !== 'function') return 0
  let reverted = 0
  const updates = []

  const visit = (blocks) => {
    for (const block of blocks || []) {
      if (Array.isArray(block.content)) {
        let changed = false
        const newContent = block.content.map((it) => {
          if (it?.type === 'nodeLink' && it.props?.nodeId === nodeId) {
            changed = true
            reverted++
            return { type: 'text', text: it.props.label ?? '', styles: {} }
          }
          return it
        })
        if (changed) updates.push([block, newContent])
      }
      if (Array.isArray(block.children) && block.children.length) visit(block.children)
    }
  }
  visit(editor.document)

  for (const [block, content] of updates) editor.updateBlock(block, { content })
  return reverted
}
