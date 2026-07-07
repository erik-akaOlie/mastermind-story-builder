// ============================================================================
// editorLinks.test — the pure stored-JSON link revert (revertLinksInBlocks)
// ----------------------------------------------------------------------------
// Covers the cross-endpoint half of the ADR-0016 §7 contract: when a
// connection dies, [[links]] in the OTHER card's stored zones must downgrade
// to plain text. The live-editor twin (revertLinksForNode) is exercised via
// Inspector.test.jsx; this file pins the data-level walk.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { revertLinksInBlocks } from './editorLinks.js'

const link = (nodeId, label) => ({ type: 'nodeLink', props: { nodeId, label } })
const text = (t) => ({ type: 'text', text: t, styles: {} })

const para = (content, children = []) => ({
  id: 'b1',
  type: 'paragraph',
  props: {},
  content,
  children,
})

describe('revertLinksInBlocks', () => {
  it('reverts a top-level link to plain text and counts it', () => {
    const blocks = [para([text('ally of '), link('beta-id', 'Beta')])]
    const { blocks: out, reverted } = revertLinksInBlocks(blocks, 'beta-id')
    expect(reverted).toBe(1)
    expect(out[0].content[1]).toEqual(text('Beta'))
  })

  it('reverts links nested inside children blocks', () => {
    const child = { ...para([link('beta-id', 'Beta')]), id: 'child' }
    const blocks = [para([text('list:')], [child])]
    const { blocks: out, reverted } = revertLinksInBlocks(blocks, 'beta-id')
    expect(reverted).toBe(1)
    expect(out[0].children[0].content[0]).toEqual(text('Beta'))
  })

  it('leaves links to OTHER nodes untouched', () => {
    const blocks = [para([link('gamma-id', 'Gamma'), link('beta-id', 'Beta')])]
    const { blocks: out, reverted } = revertLinksInBlocks(blocks, 'beta-id')
    expect(reverted).toBe(1)
    expect(out[0].content[0]).toEqual(link('gamma-id', 'Gamma'))
    expect(out[0].content[1]).toEqual(text('Beta'))
  })

  it('reverts every occurrence, not just the first', () => {
    const blocks = [
      para([link('beta-id', 'Beta')]),
      para([text('again '), link('beta-id', 'Beta')]),
    ]
    const { reverted } = revertLinksInBlocks(blocks, 'beta-id')
    expect(reverted).toBe(2)
  })

  it('does not mutate the input document', () => {
    const blocks = [para([link('beta-id', 'Beta')])]
    const frozen = JSON.stringify(blocks)
    revertLinksInBlocks(blocks, 'beta-id')
    expect(JSON.stringify(blocks)).toBe(frozen)
  })

  it('returns the same reference and reverted=0 when nothing matches', () => {
    const blocks = [para([text('plain only')])]
    const { blocks: out, reverted } = revertLinksInBlocks(blocks, 'beta-id')
    expect(reverted).toBe(0)
    expect(out).toBe(blocks)
  })

  it('handles a null / missing zone without throwing', () => {
    expect(revertLinksInBlocks(null, 'beta-id')).toEqual({ blocks: null, reverted: 0 })
    expect(revertLinksInBlocks(undefined, 'beta-id')).toEqual({ blocks: undefined, reverted: 0 })
  })

  it('falls back to empty text when the link has no label', () => {
    const blocks = [para([{ type: 'nodeLink', props: { nodeId: 'beta-id' } }])]
    const { blocks: out, reverted } = revertLinksInBlocks(blocks, 'beta-id')
    expect(reverted).toBe(1)
    expect(out[0].content[0]).toEqual(text(''))
  })
})
