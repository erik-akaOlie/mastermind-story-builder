# ADR-0019: Line annotations — organization tool, not relationships

**Date:** 2026-07-10
**Status:** Accepted
**Decider:** Erik (product), Claude (architecture)

## Context

Beta users need to organize the canvas visually — divide regions, point at
things, sketch structure — without creating node relationships. Connections
carry semantic weight in MasterMind (two layers of truth, edge-hover
expansion, the Connections block); pressing them into service as visual
dividers would pollute the relationship graph with false edges. Erik
requested a third primary canvas tool for beta: **Lines**, deliberately
narrow — a straight line with exactly two anchors, not a drawing subsystem.

## Decision

1. **Lines are free-standing annotations, never edges.** They live in their
   own `lines` table (migration 015) with two absolute canvas anchor points
   (A, B) + style columns, referencing only `workspace_id` — structurally
   incapable of referencing nodes. React Flow renders each line as a node
   (`lineNode`, like `textNode`), NOT as a React Flow edge (edges require a
   node at each end — exactly the semantics lines must not have).
2. **Bounding-box representation.** The RF node's position is the padded
   top-left of the anchor bounding box (`linePositionFor`, translation-
   invariant), so RF's whole-node drag maps 1:1 onto anchor translation.
   Only the widened invisible hit-stroke and endpoint handles take pointer
   events — clicks land near the line, not anywhere in its box.
3. **Placement is a dedicated mode.** The Line tool arms a full-viewport
   overlay that owns the whole gesture (click-move-click on desktop;
   press-drag-lift on touch, per Erik's spec) — sidestepping conflicts
   with marquee-select and MB-1 touch pan/zoom rather than arbitrating
   with them. Pan/zoom is unavailable mid-placement (accepted, first cut).
   **Shift** constrains drawing and endpoint re-anchoring to the four axes
   through the fixed anchor (horizontal / vertical / both 45° diagonals,
   `snapToAxis`); whole-line drags inherit the canvas's existing
   shift-axis-lock since lines are RF nodes.
4. **Styling mirrors text block editing.** A floating contextual toolbar on
   selection (screen-layer child of `<ReactFlow>`, like AlignmentToolbar):
   stroke weight (default 8 — revised from 4, 2026-07-10), solid/dashed,
   dash length + gap (dashed only), delete. Numeric values are direct
   type-in fields (like the text block's px field), not steppers. The
   bottom toolbar (FTUE work) stays creation-only.
   **Cap policy:** solid = round caps, dashed = **butt** caps — the
   Figma/Illustrator convention. SVG round caps extend every dash by
   weight/2 per end, which visually couples stroke weight to dash length
   (weight 8 / dash 8 / gap 8 read as a solid line in testing). Butt caps
   make dash + gap literal; weight affects thickness only.
   **Unit model:** weight and dash values are canvas units (world-space),
   like every other canvas element — they scale with zoom rather than
   staying screen-constant, so a line keeps its size relative to the nodes
   it organizes. Screen-constant strokes were rejected: they'd change the
   line's apparent world size on every zoom.
5. **Full citizenship in the data guarantees.** Four undo action types
   (create/move/edit/deleteLine) in the ADR-0006 dispatcher, batch-delete
   membership, Realtime mirroring (publication + REPLICA IDENTITY FULL),
   and inclusion in `list_workspaces_with_activity`.

## Scope limits (deliberate)

No curves, no polylines/multi-point, no arrowheads, no attach-to-node, no
color UI (a `color` column exists with one default so a future control
needs no migration). The Inspector and alignment tools ignore lines.
Lines DO get the (simplified, 2026-07-10) element right-click menu —
Duplicate + Delete, same rows as nodes and text blocks — and participate
in multi-duplicate/multi-delete. Line duplicate shares the known
"duplicate isn't undoable yet" gap tracked in BACKLOG.

## Consequences

- A fourth content table joins the Realtime channel and every future
  workspace-scale feature (export, soft-delete, snapshots) must include it.
- The placement overlay is MasterMind's first modal "active tool" state —
  the same machinery the approved bottom toolbar (Node / Text Block /
  Line) generalizes next.
- Pre-line `batchDelete` undo entries in sessionStorage restore unchanged
  (the `lines` field defaults to empty; regression-tested).
