// ============================================================================
// blockTypes — the single list of block types MasterMind lets users convert
// between, with their product-facing labels (Chunk F5a).
// ----------------------------------------------------------------------------
// ONE source of truth, consumed by every surface where a user changes a block's
// type, so the list + labels stay identical everywhere (decision F5a-1):
//   • the 6-dot menu's "Turn into ▶" submenu        (blockControls.jsx, F5a)
//   • the floating formatting toolbar's type select  (blockControls.jsx, F5a)
//   • the "/" slash menu                             (relabeled to match in F5b)
//
// `type` / `props` are BlockNote's native primitives; `label` is MasterMind's
// product language. Note "Callout" maps to the native `quote` block via
// CALLOUT_BLOCK_TYPE — see blockSchema.jsx for why we alias rather than fork.
//
// `aliases` are search synonyms for the slash ("/") menu (F5b) so typing "/h1"
// still finds "Heading 1" even though the title is what's displayed. They are
// part of the canonical definition (kept here, single-sourced) so every surface
// can use them — they are NOT a second block-type list.
//
// Heading levels are intentionally limited to H1/H2 (the levels F2 styles);
// H3–H6 are slated to be hidden in F6, so offering them here would contradict
// that. Image Album / Connections are excluded — they aren't text blocks a user
// converts into. Array order = display order.
//
// CONSUMED VIA blockTypeAdapters.jsx — the shared layer that maps this one list
// into each surface's item shape (6-dot "Turn into", slash menu, and the F5c
// toolbar dropdown). Add/remove a block type HERE and every surface follows.
// ============================================================================

import {
  TextT,
  TextHOne,
  TextHTwo,
  ListBullets,
  ListNumbers,
  ListChecks,
  AlignLeftSimple,
} from '@phosphor-icons/react'
import { CALLOUT_BLOCK_TYPE } from './blockSchema.jsx'

export const BLOCK_TYPES = [
  { key: 'paragraph', label: 'Text', type: 'paragraph', props: {}, icon: TextT, aliases: ['text', 'paragraph', 'p', 'plain'] },
  { key: 'heading1', label: 'Heading 1', type: 'heading', props: { level: 1 }, icon: TextHOne, aliases: ['h1', 'heading', 'title'] },
  { key: 'heading2', label: 'Heading 2', type: 'heading', props: { level: 2 }, icon: TextHTwo, aliases: ['h2', 'heading', 'subtitle'] },
  { key: 'bullet', label: 'Bullet List', type: 'bulletListItem', props: {}, icon: ListBullets, aliases: ['bullet', 'unordered', 'ul', 'list'] },
  { key: 'numbered', label: 'Numbered List', type: 'numberedListItem', props: {}, icon: ListNumbers, aliases: ['numbered', 'ordered', 'ol', 'list'] },
  { key: 'check', label: 'Check List', type: 'checkListItem', props: {}, icon: ListChecks, aliases: ['check', 'todo', 'task', 'checkbox'] },
  { key: 'callout', label: 'Callout', type: CALLOUT_BLOCK_TYPE, props: {}, icon: AlignLeftSimple, aliases: ['callout', 'quote', 'aside', 'note', 'info'] },
]
