# ADR-0016: Block editor foundation — BlockNote
Date: 2026-06-03
Status: Accepted

## Context

The card-editing surface (the Inspector, ADR-0015) is moving from a fixed set of
typed form fields (Summary, Story Notes, Hidden Lore, DM Notes, Image Section,
Connections) to a **Notion-style block editor** — modular content blocks
(headings, paragraphs, lists, checklists, callouts, quotes, images) that a user
adds and reorders freely, split across two zones ("Card View" and "GM's Eyes
Only"). This ADR records the choice of editor *foundation*; the broader content
model and migration are scoped separately.

We evaluated two foundations against MasterMind's actual requirements: inline
`[[Node]]` links that create graph connections, custom data-driven blocks
(Connections, Image Album), the two-zone model, clean future Markdown export,
and a low-friction Notion-like editing experience (data-entry friction is the
product's primary abandonment risk).

- **BlockNote** — a block-based, Notion-style React editor built on top of
  Tiptap/ProseMirror. Ships the Notion UX (slash menu, drag handles, formatting
  toolbar, block-type switching, color) and editing robustness out of the box.
- **Tiptap** — a headless editor engine. Full control, but the Notion UX and a
  large share of editing-robustness edge cases must be assembled/owned by us
  (open starters like Novel exist but are starter kits, not clean libraries; the
  official Tiptap Notion template is paid).

We validated both in an isolated, throwaway spike (`#editor-spike`,
`src/spike/`). Findings are recorded in `src/spike/FINDINGS.md`. The decisive
question was whether BlockNote could support the product-defining interaction —
inline `[[Node]]` links — *cleanly*, since that was the one open risk.

**Measured result:** BlockNote's built-in multi-character trigger is buggy, but a
small (~15-line) workaround — trigger on a single `[`, search the query, strip
the one stray bracket on insert — gives a working `[[` link, including the
deletion lifecycle. All five requirements were validated in BlockNote in the
spike. With the `[[` concern measured as **small** (size S, under a day) rather
than structural, the completed comparison favors BlockNote: it satisfies every
requirement with modest, proven custom work *and* provides for free the Notion
UX + editing robustness that would be the costly buildout on headless Tiptap.

(An earlier lean toward Tiptap rested mainly on the `[[`/abstraction-ceiling
concern; once that was measured and small, the evidence pointed to BlockNote.)

## Decision

1. **BlockNote is the selected editor foundation for V1.**

2. **BlockNote block JSON is the source of truth.** Each editor's document is
   stored as BlockNote's native JSON (lossless), persisted in our existing
   JSONB content storage (`node_sections`, per ADR-0002). We do **not** store a
   derived/flattened representation as the canonical copy.

3. **Markdown export is a future requirement, built by us — not BlockNote's
   exporter.** BlockNote's built-in Markdown export is lossy and cannot emit our
   custom inline content or custom blocks. When the "download a node as `.md`"
   feature ships, we write our own serializer over the source-of-truth JSON
   (producing Obsidian-compatible `[[wikilinks]]`, callouts, etc.). Designing for
   this now means: never store content in a shape that can't later become clean
   Markdown.

4. **Inline `[[Node Name]]` links create graph connections.** Typing `[[` opens a
   node-name autocomplete; selecting a node inserts an inline link *and* creates
   a connection (a single line between the two nodes). This is the deliberate act
   of declaring a relationship — plain text is just text; brackets mean "draw a
   line." (Supersedes ADR-0004's `@` trigger and `@[card-id|Display Name]` string
   syntax — see below.)

5. **The validated `[[` workaround is accepted for now**, including the known
   quirk that the autocomplete menu also opens on a single `[`. It is a small,
   contained piece of code reliant on observed BlockNote behavior. Revisit if
   BlockNote fixes its multi-character trigger upstream (at which point the
   workaround and the single-`[` quirk can likely be removed).

6. **Connections remain first-class records outside the editor content.** A
   connection is a row in the `connections` table — not data embedded in block
   JSON. The editor *references* connections (via the inline link's stored node
   id and via the Connections block); it does not *own* them. One connection per
   node-pair (set semantics), as in ADR-0004.

7. **The Connections block is the only place a connection can be deleted.**
   - Deleting a connection there removes the line and reverts any inline
     `[[links]]` pointing at that node to **plain text** (the words stay).
   - Deleting or un-bracketing inline text does **not** delete the connection.
   - This **reverses ADR-0004's lifecycle** ("removing a mention removes the
     connection"). Connections are managed in one authoritative place, not
     auto-diffed from text on save.

8. **Custom blocks are driven by external app/data state, never by state held
   inside the block's own React component.** BlockNote node views can re-render
   and lose internal state (observed in the spike as connections "ghosting"
   back). The Connections and Image Album blocks read live from our data
   (connections table / media) every render.

9. **Canvas card previews use our own lightweight read-only renderer over the
   block JSON — not full BlockNote editor instances.** Mounting an editor per
   card would not scale to hundreds of cards. We render the card-visible zone's
   JSON with a small, non-interactive renderer.

10. **Tiptap remains the documented fallback** if BlockNote hits a future
    structural limitation. This is cheap insurance because (a) BlockNote is built
    on Tiptap/ProseMirror and exposes the underlying engine (`_tiptapOptions`,
    `editor._tiptapEditor`) as an escape hatch, and (b) our source of truth is
    portable JSON with connections held separately, so an editor swap is a
    re-render problem, not a data re-architecture.

## Addendum (2026-06-03): Connections are a fixed panel, not a block

During Phase 2 (Chunk C) implementation, the Connections "block" approach
(decision points 6–8 above) hit a concrete problem: a block inside the BlockNote
document can be **deleted or moved by the user** like any other block, and the
Connections surface must be permanent and always present. Guarding a block's
existence inside the document fights BlockNote's model (re-insertion ordering,
flicker). We therefore **moved Connections out of the editable document** into a
**fixed, non-removable panel** pinned below the GM zone editor.

What changes:
- Connections are **no longer a block** in the `gm_only` document. The migration
  stops emitting a `connections` block; `CardZones` strips any stray legacy one
  on load; the `connections` block type stays registered (rendering nothing)
  only as crash-safety for not-yet-re-migrated data.
- The fixed panel reads the live connection list and deletes through the
  Inspector's existing `localConns` flow (so canvas-edge removal, persistence,
  and undo are unchanged).

What does NOT change — this **reinforces** the original principle rather than
reversing it:
- Decision **§6 still holds**: connections remain first-class rows in the
  `connections` table, never embedded in block JSON. A fixed panel honors
  "outside the editor content" *more* faithfully than an in-document block did.
- Decision **§7 still holds**: the panel is the authoritative place to delete a
  connection, and deleting reverts any inline `[[links]]` to plain text.
- Decision **§8 still holds**: the panel reads live external state every render.

Only the *representation* of the Connections surface changed (block → fixed
panel); the connection model is unchanged. Inline `[[Node]]` links still create
connections (§4).

## Relationship to ADR-0004

ADR-0004 ("Inline `@`-mention syntax") was **design-locked but never built**, so
nothing is migrated. This ADR supersedes it on three points:

| Aspect | ADR-0004 (superseded) | ADR-0016 (this) |
|---|---|---|
| Trigger | `@` | `[[` |
| Storage | `@[card-id\|Display Name]` string inside JSONB text | BlockNote inline-content node (node id + cached label) inside block JSON |
| Delete lifecycle | Removing the mention removes the connection (auto-diff on save) | Only the Connections block deletes a connection; removing inline text does not |

ADR-0004's **retained** principle: one connection row per pair in the
`connections` table is the single source of truth, and inline references create
connections. That core is reinforced here, not changed.

## Consequences

**Benefits**
- Notion-class editing UX and editing-robustness for free — directly serves the
  data-entry-friction risk.
- All five core requirements validated in a working spike, not estimated.
- JSON source of truth is durable and export-ready; connections held separately
  keep the graph authoritative and the editor swappable.

**Costs / risks accepted (none blocking)**
- The `[[` workaround depends on observed BlockNote behavior; a version bump
  could change it. Mitigation: it's small and isolated; monitor upstream.
- **Dependency/version drift:** BlockNote's default Mantine theme targets a newer
  React than our React 18; we pin `@mantine/core@^8` / `@mantine/hooks@^8`.
  Monitor; may later require a React 18→19 upgrade or a different BlockNote theme.
- Theming to match MasterMind's look happens within BlockNote's theming system —
  some effort, less freeform than a headless editor.
- **Migration with zero data loss** — converting existing fielded content
  (Summary / Story Notes / Hidden Lore / DM Notes / Image Section / Connections)
  into block JSON is required and is a hard correctness requirement. Editor-
  agnostic, but real build work; write the no-loss test first.
- The Markdown exporter is deferred work we own.

**When to revisit**
- If BlockNote fixes multi-char triggers (simplify the `[[` workaround).
- If a structural limitation appears that the underlying-engine escape hatch
  can't resolve cleanly (consider the Tiptap fallback).
- When the Markdown export feature is scheduled.

## References / Related decisions

- Spike findings: `src/spike/FINDINGS.md` (spike to be removed; patterns captured here).
- [ADR-0004](./0004-inline-mentions-syntax.md) — superseded on trigger, storage, and delete lifecycle (above).
- [ADR-0002](./0002-modular-node-sections.md) — JSONB section content this builds on.
- [ADR-0015](./0015-float-or-dock-inspector.md) — the Inspector surface the editor lives in.
- [ADR-0013](./0013-product-positioning.md) / [ADR-0014](./0014-workspace-schema-architecture.md) — custom card types and data-driven structure this rework enables.
- [ADR-0003](./0003-optimistic-ui-persistence.md) — connection writes follow the same optimistic, fire-and-forget pattern.
