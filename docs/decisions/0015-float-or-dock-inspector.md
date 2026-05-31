# ADR-0015: Float-or-dock Inspector for card editing
Date: 2026-05-30
Status: Accepted

## Context

Editing a card happened in a single centered modal that grew out of the clicked
card and dimmed the canvas behind a backdrop. Two things pushed us to revisit it:

1. **Tester feedback (Chris, Todd; May 2026).** A centered modal over a darkened
   canvas hides exactly the thing the product exists to show — the surrounding web
   of connected cards. While editing one card you cannot see its neighbors, so you
   lose the context that makes the canvas worth having. Both testers wanted to edit
   a card while still seeing the graph, and to move quickly between cards without a
   close/reopen cycle each time.

2. **A planned search surface.** Search is coming and needs durable real estate at
   the top of the canvas; the editing surface has to coexist with it rather than
   cover the whole screen.

The initial idea was "switch the modal to a right-side slide-out panel." That trades
one fixed posture for another. The richer question — settled here — is whether the
editing surface should be *movable between* postures, and what the surrounding
interaction rules (open, repoint, close, multi-select) should be once it is.

External scan (LinkedIn messaging, Slack, Figma/Linear inspectors, IDE panels,
Notion peek): the dominant pattern for a persistent secondary surface is a
**dockable panel that can also float**, with the dock pinned to an edge or corner.
LinkedIn's bottom-right messaging dock is the closest analog to what testers
described.

## Decision

The card-editing surface is renamed **the Inspector** and gains two modes the user
moves between freely:

### 1. Two modes — undocked and docked
- **Undocked:** a draggable floating modal that morphs in from the clicked card.
  The whole type-colored header is the drag handle.
- **Docked:** a fixed-width panel pinned bottom-right (30rem wide, 1rem right margin,
  flush to the bottom, top clearing an 80px band reserved for search), rising in from
  the bottom edge.
- Dragging an undocked modal's right edge near the viewport edge arms docking;
  dragging a docked panel's header detaches it back to floating. Detach is a single
  continuous gesture (the pointer is never released across the mode flip).

### 2. Open vs. repoint vs. select
- Inspector **closed:** single-click selects the card (unchanged); **double-click**
  opens the Inspector.
- Inspector **open:** a single plain click on another card **repoints** the existing
  surface at that card — it does not close and reopen. Outgoing edits are committed
  first (flush save + undo entries), then the content remounts for the new card with
  a quick opacity fade; the surface stays exactly where it is.
- Multi-select gestures (shift/ctrl/cmd-click, marquee) never repoint. Plain canvas
  selection behavior is left entirely as-is — opening the Inspector does not change
  how nodes select.

### 3. Docked is an overlay, not a squeeze
The docked panel sits **over** the canvas; the canvas does not reflow to make room.
Best-practice for persistent side panels is usually to squeeze the content area, but
a panel that is inset from the top (clearing the search band) and pinned to one
corner cannot squeeze the canvas cleanly, and squeezing would fight the
pan/zoom/altitude model. Overlay is the deliberate choice. **A future session should
not "fix" this into a squeeze.**

### 4. Close is control-only, and directional
- Clicking the canvas does **not** close the Inspector. There is no backdrop/scrim.
  Close is via the explicit header control (an X when undocked; a down-chevron
  "collapse to edge" when docked) or Esc. Deleting the card whose contents are shown
  also closes it.
- The close animation is **directional and live**: an undocked Inspector morphs back
  toward the node's *current* on-screen position (recomputed at close time, so it
  aims correctly even after the node was panned or repositioned); a docked Inspector
  slides down off the bottom edge.

### 5. Mode memory — mode only
The last-used mode (docked vs. undocked) persists to `localStorage`
(`mastermind:inspector-mode`) so the next card opens in the user's preferred posture.
Position is **not** persisted — an undocked Inspector always recenters on open. We
deliberately did not persist position/size in V1; recentering is predictable and
avoids stale off-screen placements.

### 6. One Inspector at a time, modeled as if many
Only one Inspector is open at a time (the simplest version that satisfies the need).
But its state is modeled as a self-contained **inspector instance**
(`{ topicNodeId, node, position, mode, isRepoint, … }`) whose `topicNodeId` is
independent of canvas selection. Multiple simultaneous inspectors later become an
array of these instances rather than a rewrite. We rejected showing "N cards
selected" affordances — testers found a count unhelpful; the Inspector simply shows
the last node selected.

## Relationship to ADR-0010 (zoom progressive disclosure)

ADR-0010 introduces Bead View, where cards render as beads at low zoom and a bead
**hover-expands** as a read affordance. The Inspector's open/repoint/select rules are
defined in terms of node *clicks* and are altitude-agnostic — hover (ADR-0010's read
preview) and click (this ADR's open/repoint) do not collide. Opening the Inspector
from a bead follows the same double-click-to-open / single-click-repoint rules as a
card. This is the reconciliation of record; if a concrete conflict surfaces in Bead
View (e.g. a gesture that means different things at different altitudes), it is a
follow-up to be settled with a short addendum here, not silently in code.

## Consequences

**Enables**
- Editing a card while the surrounding web stays visible — the core complaint.
- Fast card-to-card movement via single-click repoint with no teardown/rebuild.
- A stable top band for the forthcoming search surface.
- A clean growth path to multiple simultaneous inspectors (instance array).

**Prevents / costs**
- The docked overlay covers a bottom-right slice of canvas; cards under it are
  occluded (mitigated: the user can pan, detach, or close).
- Repoint must commit outgoing edits before swapping; the commit path is guarded for
  idempotency (`committedRef`) to avoid double-applying under React StrictMode and
  the explicit-commit-before-swap sequence.
- No position memory means a user who drags the floating modal somewhere specific
  loses that placement on the next open. Accepted for V1.

**Trade-offs accepted**
- Overlay over squeeze (see Decision 3).
- Mode persisted, position not (see Decision 5).
- Single inspector now, modeled for many (see Decision 6).

## Implementation note (terminology)

This ADR also retires the "edit modal" name. The component files were renamed
`EditModal*` → `Inspector*` and App state `editingNode` → `inspectorNode` on
2026-05-30, so code and docs now speak only of "the Inspector." This is recorded for
historical clarity; future references should use Inspector exclusively.
