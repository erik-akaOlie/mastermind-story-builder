# MasterMind: Story Builder — Design Document

## Overview

This document captures design decisions — the functional grammar of the interface: visual systems, interaction patterns, and information architecture. Aesthetic decisions (typography choices, specific color values, textures, theming) are intentionally deferred.

**Scope.** This doc specifies the **canvas + cards** interaction system — the worldbuilding surface of MasterMind. Other surfaces in the long-term Game Master Operating System vision — live session co-pilot, AI campaign generation, lifecycle management (scheduling / session history / party finances), and player view — are not designed in this document. Each will get its own design doc once it enters active design. The product vision and the surfaces still to be designed are described in [`project-brief.md`](./project-brief.md).

**Relationship to other docs:** This document is updated as the design evolves, but source-of-truth for *current implementation* is [`CLAUDE.md`](./CLAUDE.md). Architectural decisions (backend choice, persistence pattern, etc.) are captured as ADRs in [`docs/decisions/`](./docs/decisions/). Current and upcoming work is in [`BACKLOG.md`](./BACKLOG.md).

---

## Design Principles

- **The graph is the model.** Campaigns are systems of interconnected entities — characters, locations, items, factions, story threads — not documents. Every interaction in the canvas reinforces the graph structure (entities + typed relationships) rather than flattening it back into prose. A new feature should make the graph more navigable, more queryable, or more legible; if it would shave the graph back down to lists or notes, it's the wrong feature.
- **Visual systems before aesthetics.** Every design decision is grounded in function and meaning, not style. The system must work correctly before it is made beautiful.
- **One signifier, one meaning.** No visual cue is reused across different concepts. Each treatment has exactly one meaning in the system.
- **Content is the signal.** Where possible, the state of a thing is readable from the thing itself — not from a separate indicator added on top of it.
- **Progressive disclosure.** At every zoom level, the interface shows just enough to orient the user and invite them deeper.
- **Skinnable by design.** All visual treatments are structurally separable from aesthetic choices, so the interface can be reskinned without touching underlying logic.

---

## 1. Node System

### 1.1 Card Format

All nodes are **rectangles** — uniform shape across all types. Shape does not encode type. Cards grow vertically with content. There is no fixed height cap. Current implementation uses `w-64` (256px) with `rounded-lg`.

### 1.2 Node Types and Colors

Color encodes node type. Each type has a distinct assigned color and a Phosphor icon. Color is never used to encode any other property.

| Type | Color | Phosphor Icon |
|---|---|---|
| Character | Purple (`#7C3AED`) | UserCircle |
| Location | Green (`#16A34A`) | MapPin |
| Item | Orange (`#EA580C`) | Backpack |
| Faction | Blue (`#2563EB`) | ShieldPlus |
| Story | Warm gray (`#9CA3AF`) | BookOpen |
| Custom (user-defined) | User-selected from 2D color picker | User-selected from icon library |

Note: The fifth type is confirmed as "Story" (not "Plot Hook"). Type icons render at `weight="fill"`, colored by the header's luminance-adaptive foreground, sized proportionally to the title text.

### 1.3 Custom Type Color Picker

When a user creates a custom node type, they select a color from a **2D color map** showing the full color space simultaneously.

**Exclusion zones:**
- Existing type colors are plotted as colored dots on the color map at their exact position in the color space
- Each dot has a radius large enough that any selectable color outside it is perceptibly different from the center color
- Hovering over a dot reveals a tooltip with the type name (e.g. "Locations")
- Clicking within a dot's radius is blocked — cursor changes to not-allowed on entry

**Purpose:** Prevents users from creating custom types that are visually indistinguishable from existing types.

### 1.4 Node States

Each state has exactly one visual treatment. Treatments are never shared across states.

| State | Visual Treatment |
|---|---|
| Default | Normal appearance, light drop shadow |
| Hovered | scale(1.03) + deep drop shadow |
| Selected | scale(1.03) + deep drop shadow; persists while anything else is hovered |
| Dimmed | 50% opacity — any card that is not active when something else is hovered/selected |
| Is-editing | opacity 0 (card disappears; modal animates from its position) |

*(The original design included a "Locked" state — an explicit user toggle that dimmed the card to 50% opacity. The lock feature was cut from V1; the `locked` flag remains in-memory only and the state treatment is no longer active.)*

**Rule:** Drop shadow and scale-up mean "pulled forward in space." This treatment is exclusive to hover and selected states and must not be applied to any other concept.

**Hover priority:** Hover always claims visual priority over selection. A hovered card is always lifted and undimmed — this is consistent with Figma and expected in all canvas tools.

**Multi-select:** Shift+click selects additional nodes. All selected nodes remain lifted (scale + shadow). The selection bounding box React Flow renders after release is hidden; cards communicate selection visually themselves.

**Edge hover:** When the user hovers over a connection line, the two connected cards are highlighted (undimmed, lifted) and the line thickens. All other cards dim.

### 1.5 Completeness

Completeness is **implicit and content-driven**. There is no separate completeness indicator. A card that has been worked on looks worked on — rich with description, connections, and media. A card that needs attention looks sparse. The content is the signal.

No progress bars, badges, or completeness scores are used.

### 1.6 Drag Affordance

Cards are draggable across their entire surface (React Flow's default node drag behavior). Grip icons have been removed from the current implementation — the whole card is the drag target.

Cursor states on the canvas:
- Default cursor: arrow
- Spacebar held: open hand (pan mode)
- Spacebar + drag: closed fist (actively panning)

*(A grip icon with cursor affordance was designed but removed during build. May be revisited.)*

### 1.7 Card Actions

**Right-clicking anywhere on a card** opens a context menu with all available actions:
- Edit (opens edit modal)
- Duplicate (without connections — "with connections" variant is cut from V1)
- Delete

**Double-clicking a card** also opens the edit modal.

There is no persistent edit icon on the card surface.

---

## 2. Card Content Structure

### 2.1 Card Layout (implemented)

The card has three visual zones:

1. **Header** — type-color background; D-shaped avatar on the left (diameter tracks the header's rendered height via ResizeObserver); title text (wraps, no truncation, font scales with zoom compensation); Phosphor type icon on the right (auto-hidden when the title would overflow it at extreme zoom-out)
2. **Summary** — short italicized text visible on the card surface (`text-xs`, `text-gray-500`); separated from the body by a subtle border
3. **Body** — bullet list of narrative notes (`text-xs`, `text-gray-700`); shows "No content yet" placeholder when empty

### 2.2 Avatar

- If `data.avatar` is set, the renderer resolves it via the `useImageUrl` hook (handles Supabase Storage paths, legacy base64 data URIs, and external `/avatars/*` URLs) and renders an `<img>` with `object-cover`
- If not: renders the darkened type color as background + the label's first meaningful initial (via `labelInitial()`, which strips a leading "The " before taking the first character)
- The avatar is D-shaped: full circle clipped on the left with `rounded-r-full`; its diameter always equals the header's rendered height
- Clicking the avatar opens the shared lightbox (the same one the inspiration grid uses)

### 2.3 Node Data Schema

Persistent fields (stored in Supabase; see `CLAUDE.md` for the full DB schema):
- `label` — display title
- `type` — one of the built-in type keys (`character`, `location`, `item`, `faction`, `story`) or a campaign-defined custom key
- `avatar` — Supabase Storage path string (current shape, per ADR-0005), or a `/avatars/*` URL for the bundled Strahd sample data, or null. Legacy base64 data URIs still render but no new ones are written.
- `summary` — short summary text
- `storyNotes` — array of bullet strings (the visible body of the card)
- `hiddenLore` — DM-only bullets (hidden from players)
- `dmNotes` — DM-only operational notes
- `media` — array of inspiration entries; each entry is either a legacy string (URL or base64) or a `{path, alt, uploaded_at}` object pointing at a Storage path (current shape, per ADR-0005)

(`storyNotes`, `hiddenLore`, `dmNotes`, and `media` are each stored as a row in `node_sections` keyed by `kind`; the schema supports future modular sections.)

UI-computed fields (not persisted):
- `isEditing` — hides the card while the edit modal is open
- `connectionDots` — array of `{x, y, color}` for the border dot indicators
- `locked` — in-memory only; lock feature was cut from V1

Hover/select flags (`anySelected`, `anyHovered`, `hoveredEdgeNodeIds`) are not on `data` — they live in `useCanvasUiStore` and cards subscribe to them via narrow Zustand selectors so a hover event doesn't force every card to re-render.

### 2.4 Edit Modal Content (implemented)

The edit modal (`EditModal.jsx`) is a centered overlay with:
1. **Header** — type-color background; title input (inline, borderless); close button
2. **Type selector** — pill buttons for all types; clicking changes card color immediately
3. **Thumbnail** — clicking the avatar opens it in the lightbox; a small pencil button appears in the top-right on hover and triggers the file picker. When no avatar is set, clicking the initial-letter placeholder opens the file picker. Uploads transcode to two WebP variants (thumb + full) and write to Supabase Storage.
4. **Summary** — textarea
5. **Story Notes** — bullet list shown on the card body; Enter adds, Backspace on empty removes; drag-to-reorder
6. **Hidden Lore** — bullet list visible only to the DM (planned to be hidden in the future player view)
7. **DM Notes** — bullet list, DM-only
8. **Inspiration Images** — media grid with drag-to-reorder and a lightbox
9. **Connections** — list of connected nodes; add via dropdown picker (alphabetically sorted, strips "The " prefix); remove individually

### 2.5 Sections Designed but Not Yet Built

The following section-level capabilities are in the design spec but not yet implemented:
- Relationship type labels on connections (Sprint 4)
- Discovery toggles per relationship (deferred with player view)
- Modular card sections UI — reorder / add / remove sections, per-type templates (Sprint 3; the schema already supports it)
- Custom fields — fully user-defined sections beyond the built-in kinds

### 2.6 Information Hierarchy

Information hierarchy follows established typographic best practices:
- **Card title / header:** Dominant — the first thing the eye lands on
- **Section headers (inside modal):** Clearly subordinate to the card title
- **Body text and bullet points:** Standard reading weight
- **Labels, metadata, secondary information:** Lightest weight

Font sizes use `rem` units. `html { font-size: 100% }` anchors rem to the browser's root font size preference.

---

## 3. Media System

### 3.1 Mood Board Section

Each card has a dedicated **mood board section** for visual reference material. This is distinct from inline media embedded within the Narrative or DM Notes sections (which is also supported).

The mood board section is **DM-only** by default.

### 3.2 Media Types

| Media type | Card representation | On click |
|---|---|---|
| Image | Thumbnail | Lightbox → fullscreen option |
| Video | Thumbnail + video icon (lower right, Instagram-style) | Lightbox → fullscreen option |
| Audio | Generic audio icon + label | Lightbox audio player → closeable |
| PDF / other files | Generic file type icon + label | Lightbox → hand off to browser |

### 3.3 Primary Image vs. Player-Visible Image

These are two **independent** designations that can be applied to any image in the mood board:

- **Primary image** — DM's visual reference; always displayed first in the mood board. DM-only.
- **Player-visible image** — the one image surfaced in the player view. Separately designated. Can be any image regardless of whether it is also the primary image.

An image can hold one, both, or neither designation.

### 3.4 Progressive Zoom Disclosure

Media visibility scales with zoom level. As the user zooms out, media progressively disappears. As they zoom in, it progressively reappears.

- **Fully zoomed out:** No media visible; a count indicator shows total media available (e.g. "21")
- **Zooming in:** Media appears progressively, primary image first, with a count indicator for remaining hidden items
- **Fully zoomed in on card:** All media visible simultaneously, no truncation

When zoom makes individual media items too small to be useful, content fades out and the count indicator takes over.

---

## 4. Discovery Layer (DM View)

*Status: **Designed, deferred to Phase 2 with Player View.** The two-layer (DM world vs. player-discovered) model is captured here as design intent because it shapes the data model, but the visual treatment (dashed-vs-solid lines, the bullet-checking discovery mechanic, the DM toggle) won't be implemented until Player View enters active design. Until then, all cards and edges render as discovered. When Player View is built, this section moves to a dedicated `design/player-view.md` and gets reviewed against current product reality.*

### 4.1 Two-Layer System

The map holds two simultaneous states:
- **DM world** — everything that exists
- **Player-discovered** — the subset players have encountered through gameplay

### 4.2 Visual Treatment

Discovery state is encoded through **line treatment** on card borders and connection lines:

- **Dashed** = undiscovered (not yet experienced by players)
- **Solid** = discovered (players have encountered this)

This treatment applies to both card outlines and connection lines. No color is used to encode discovery state.

### 4.3 DM Toggle

The DM can toggle the discovery layer visualization on or off:
- **On (default):** Dashed borders and lines show discovery state
- **Off:** All borders and lines render solid — discovery state hidden for a cleaner view

### 4.4 Node-Level Discovery

A node becomes discovered when the DM **checks at least one bullet** in the Narrative section. Discovery is implicit — there is no separate "mark as discovered" control.

- Checking a bullet → node becomes discovered + that bullet becomes player-visible
- Each additional checked bullet → becomes player-visible
- Unchecked bullets → always hidden from players
- No bullets checked → node is undiscovered, invisible to players

**What players see on a discovered node:**
- Title (always)
- Node type / color (always)
- Checked narrative bullets (only)
- Player-visible image (if designated)
- Discovered connection relationships (only)

**What players never see regardless of discovery:**
- Unchecked narrative bullets
- DM Notes
- Mood board (except player-visible image)
- Custom fields

### 4.5 Connection-Level Discovery

Connection discovery is **independent from node discovery**. Within the detail popup's Related to section, each relationship type has an on/off toggle indicating whether players are aware of that specific relationship.

- Any relationship type toggled on → connection line renders **solid**
- All relationship types toggled off → connection line renders **dashed**
- Players see only the toggled-on relationship types in the hover label

---

## 5. Connections

### 5.1 Visual Language (implemented)

All connection lines are straight lines from card border to card border — no curves, no arrows. Line style does not vary by relationship type.

- **Color:** Slate gray (`#94a3b8`) by default
- **Weight:** 1.5px default; 2px when the edge is hovered or selected
- **Connection dots:** 8px colored circles rendered directly on the card border at each connection point. The dot color reflects the type color of the card on the other end of the connection. Dots are HTML elements, not SVG, so they sit above the card surface.
- **Dot spreading:** When multiple connections exit the same card side, dots spread apart automatically with a minimum 16px gap between centers, staying 8px clear of corners. If they would overlap, they distribute evenly.

### 5.2 Floating Edge Routing (implemented)

Edges connect to precise border intersection points, not fixed handle positions.

- `getNodeCenter()` — returns the center point of a node
- `getBorderIntersection()` — finds where a straight line from the node center toward a target exits the node's rectangular border
- `getSpreadBorderPoints()` — handles multi-connection spreading on a single side
- React Flow handles are invisible; border points are computed by the App and passed to `FloatingEdge` via `edge.data.sourcePoint` / `edge.data.targetPoint`

### 5.3 Creating Connections — Method 1: Edit Modal

Inside the Connections section of the edit modal:
1. Click "+ Add connection"
2. A dropdown picker lists all other nodes alphabetically (strips "The " prefix for sort order)
3. Selecting a node creates the connection immediately

Relationship type labels are designed but not yet built.

### 5.4 Creating Connections — Method 2: Canvas Drag

*(Designed but not yet built.)*

1. Hover over any card border → cursor changes to a four-directional arrow
2. Click and drag → a line begins drawing from that point
3. Drag toward target card → line snaps to the target card's border
4. Release mouse → connection is created and the relationship type popup appears

### 5.5 Relationship Type Popup

*(Designed but not yet built.)*

Appears immediately after a connection is created via either method.

- Dropdown with checkboxes — multiple relationship types can be selected for a single connection
- Options listed **alphabetically**
- **First option always:** Custom (free-text input field)
- Custom entries become permanent global presets, sorted alphabetically into the list
- Dismissing the popup without selecting **cancels the connection entirely** — no unlabeled connections exist
- At least one selection required to confirm

---

## 6. Edit Modal

### 6.1 Appearance

- **Centered modal** overlay with a semi-transparent black backdrop
- Width: `41.25rem` (660px at default browser font size); max-height: 90vh; scrollable body
- Opens with a morph animation: the card disappears and the modal expands from the card's screen position to center. Closes with the reverse animation.
- **Not draggable** in the current implementation (draggable header is in the design spec but not yet built)
- Escape key closes the modal; clicking the backdrop closes the modal

### 6.2 Layout (implemented)

Single **scrolling panel**. Sections in order:

1. Title (inline input in the colored header bar)
2. Type selector (pill buttons)
3. Thumbnail (image upload)
4. Summary (textarea)
5. Notes (bullet list with keyboard navigation)
6. Connections (list + add picker)

### 6.3 Animation Detail

- `useLayoutEffect` runs before first paint, reads the modal's actual centered rect, and applies a `translate + scale` transform placing the modal exactly over the source card — invisible (`opacity: 0`), no transition
- `useEffect` fires after first paint, schedules a `requestAnimationFrame` to set `transform: none` and `opacity: 1` with a CSS transition, so the browser interpolates card → center
- Close reverses the process: animates to card position, then `setTimeout(onClose, 260)` so React unmounts after the animation completes

---

## 7. Canvas Navigation

### 7.1 Navigation Controls (implemented)

| Interaction | Behavior |
|---|---|
| Scroll wheel | Vertical pan |
| Ctrl + scroll wheel | Zoom centered on cursor |
| Pinch (trackpad) | Zoom |
| Spacebar + drag | Pan (Figma model) |
| Drag on empty canvas | Marquee selection (indigo rectangle, partial intersection selects) |
| Shift + click | Add to / remove from selection |
| Double-click on card | Open edit modal |
| Right-click on card | Context menu (Edit, Duplicate, Delete) |
| Right-click on empty canvas | Context menu (Add card / Add text) |

**Marquee selection:** React Flow's selection rect uses an indigo tinted fill + indigo border. The post-selection bounding box React Flow renders around selected nodes is hidden (background: none, border: none) — cards communicate selection state visually.

### 7.2 Toolbar / Node Creation

**No persistent toolbar exists.** Node creation, text tools, and related controls are exposed via canvas right-click.

**Implemented:**
- Canvas right-click menu: "Add card" (with type submenu) and "Add text"
- Undo / redo: Ctrl+Z and Ctrl+Shift+Z (Cmd on macOS, Ctrl+Y also accepted on Windows). Per-tab, per-(user × campaign) action stack capped at 75 entries. Word-style typing exemption: Ctrl+Z while focused inside an input / textarea / contenteditable is browser-native; outside of those, it reverses the last campaign action. See [ADR-0006](./docs/decisions/0006-undo-redo.md) for the command-pattern architecture and the trade-offs against snapshot pattern.

**Still planned:**
- Shift+1: fit all (zoom and pan to fit all nodes)

### 7.3 Text Tool

- Freestanding text directly on the canvas surface (default font 18px; S/M/L/XL size options)
- Not connected to any node — purely for canvas annotation
- Scalable by the user via 8 resize handles (corners + edges)
- Rich text: per-selection bold + italic via contentEditable; alignment left/center/right
- All content, size, formatting, and position persist to Supabase

### 7.4 Zoom Compensation

Card titles scale inversely with viewport zoom so they remain readable at any zoom level:

- At zoom ≥ 1: base size (`1rem`)
- At zoom < 1: `1rem ÷ zoom`, capped at 5× to prevent absurd values at extreme zoom-out
- The Phosphor type icon scales proportionally (`iconSize = titleFontSize × 16 × 1.25 px`)
- The icon auto-hides when the title's longest word would otherwise slide under it (determined by a deterministic canvas `measureText` layout simulation — see `CampaignNode.jsx`)
- The avatar diameter tracks the header's rendered height via `ResizeObserver`, so it always fills the header regardless of title wrapping or zoom level

---

## 8. Search *(designed, not yet built)*

### 8.1 Invocation

A **search icon** is always visible in the upper right corner of the canvas. Clicking it opens the search input field. Typing and pressing Enter triggers the search.

### 8.2 Results Panel

A panel slides out from the **right side of the screen**:
- Search field at the top of the panel
- Results listed below:
  - **Title matches** appear first
  - **Description / notes matches** appear below
- A **close button** sits in the upper right corner of the panel

### 8.3 Result Interaction

- Clicking any result instantly **zooms and pans the canvas** to that node
- The panel **remains open** — the user can click additional results to hop around the map freely
- Closing the panel returns to the persistent search icon in the upper right

---

## 9. Settings *(designed, not yet built)*

Settings panel contains at minimum:

- **Discovery layer toggle** — show/hide dashed vs. solid line distinction on the DM canvas (default: on)
- **Undo history limit** — configurable number of undo steps per session (default: 50)

---

## 10. Tech Stack and Implementation Conventions

### 10.1 Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite |
| Canvas | React Flow v11.11.4 |
| Styling | Tailwind CSS v3 |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| Drag-to-reorder | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| State management | Zustand v5 (wired for the node-type store) |
| Auth + Database | Supabase (Postgres + Auth + RLS) |

See [ADR-0001](./docs/decisions/0001-supabase-over-firebase.md) for the backend decision rationale.

### 10.2 CSS Import Order

React Flow's stylesheet is imported in `main.jsx` **before** `index.css`. This ensures our Tailwind overrides and custom CSS rules win over React Flow's defaults without needing `!important` everywhere.

### 10.3 Grid System

All sizing follows an 8-point grid:
- **÷8 ideal** — preferred for all spacing, sizing, and layout values
- **÷4 acceptable** — used where ÷8 would be too coarse
- **÷2 rare** — only when the UI genuinely requires it

Font sizes use `rem`. The `html { font-size: 100% }` declaration in `index.css` anchors rem to the browser's own root font size preference so accessibility zoom settings are respected.

### 10.4 Key Architectural Notes

- All layout is free-form — physics/collision was built and then reverted. Nodes go where you put them.
- `App.jsx` orchestrates canvas state via focused hooks under `src/hooks/`: `useCampaignData` (load lifecycle + Supabase Realtime), `useEdgeGeometry` (recompute spread border points + connection dots), `useNodeHoverSelection` (hover/select handlers backed by `useCanvasUiStore`), `useSpacebarPan` (pan keyboard state), `useUndoShortcuts` (Ctrl+Z / Ctrl+Shift+Z). Persistence is optimistic + fire-and-forget per [ADR-0003](./docs/decisions/0003-optimistic-ui-persistence.md).
- Persistent vs. UI state in `node.data` is split: persistent fields flow from Supabase via `lib/nodes.js`; UI-only fields (`isEditing`, `connectionDots`) are derived per render. Hover/select flags (`anySelected`, `anyHovered`, `hoveredEdgeNodeIds`) live in `useCanvasUiStore` so a hover event mutates one atomic value instead of forcing every card to re-render.
- The sample Curse of Strahd data now lives in Supabase as a real campaign seeded via the (now-deleted) `seedStrahd.js` utility. Avatar images are still self-hosted in `public/avatars/`.

### 10.5 Utility Files

- `src/utils/labelUtils.js` — `sortKey(label)` strips "The " prefix for alphabetical sorting; `labelInitial(label)` returns the first meaningful character for avatar fallbacks
- `src/utils/edgeRouting.js` — `getNodeCenter()`, `getBorderIntersection()`, `getSpreadBorderPoints()`

---

## 11. Roadmap

The numbered sprint roadmap that previously lived here is retired in favor of a tier-ranked backlog reviewed at the start of each sprint. See [`BACKLOG.md`](./BACKLOG.md) for current and upcoming work, [`CHANGELOG.md`](./CHANGELOG.md) for what's shipped, and [`docs/decisions/`](./docs/decisions/) for architectural decisions.

### Cut from V1

- Lock / unlock cards (state remains in-memory only; no UI)
- Duplicate-with-connections (plain duplicate is sufficient)

### Deferred to Phase 2

- Player view interface — how players access and navigate their filtered view. The two-layer data model is captured in §4 of this doc; the UI is deferred and will be specified in a dedicated `design/player-view.md` when it enters active design.
- Collaboration indicators — cursors, display names, active users
- Campaign sharing / multi-user permissions
- Settings panel (discovery toggle, undo limit)
- Other surfaces in the long-term GMOS vision (live session co-pilot, AI campaign generation, lifecycle management) are described in [`project-brief.md`](./project-brief.md) and will get their own design docs as they enter active design.
