# DnD Campaign Mind Map — Design Document

## Overview

This document captures all design decisions made during the design phase. It is the source of truth for visual systems, interaction patterns, and information architecture. Aesthetic decisions (typography choices, specific color values, textures, theming) are intentionally deferred — this document defines the functional grammar of the interface, not its skin.

---

## Design Principles

- **Visual systems before aesthetics.** Every design decision is grounded in function and meaning, not style. The system must work correctly before it is made beautiful.
- **One signifier, one meaning.** No visual cue is reused across different concepts. Each treatment has exactly one meaning in the system.
- **Content is the signal.** Where possible, the state of a thing is readable from the thing itself — not from a separate indicator added on top of it.
- **Progressive disclosure.** At every zoom level, the interface shows just enough to orient the user and invite them deeper.
- **Skinnable by design.** All visual treatments are structurally separable from aesthetic choices, so the interface can be reskinned without touching underlying logic.

---

## 1. Node System

### 1.1 Card Format

All nodes are **rectangles** — uniform shape across all types. Shape does not encode type. Cards grow vertically with content. There is no fixed height cap.

### 1.2 Node Types and Colors

Color encodes node type. Each type has a distinct assigned color. Color is never used to encode any other property.

| Type | Color |
|---|---|
| Character / Beings | Purple |
| Location / Environment | Green |
| Item / Thing | Orange |
| Faction | Blue |
| Story / Narrative Structure | Warm gray |
| Custom (user-defined) | User-selected |

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
| Default | Normal appearance |
| Locked (being edited by another user) | 50% opacity |
| Hovered | Scales up slightly + drop shadow |
| Selected | Scales up slightly + drop shadow + all other nodes drop to 50% opacity |
| Locked + not selected (when another node is selected) | ~25% opacity (50% locked × 50% from dimming) |

**Rule:** Drop shadow and scale-up mean "pulled forward in space." This treatment is exclusive to hover and selected states and must not be applied to any other concept.

### 1.5 Completeness

Completeness is **implicit and content-driven**. There is no separate completeness indicator. A card that has been worked on looks worked on — rich with description, connections, and media. A card that needs attention looks sparse. The content is the signal.

No progress bars, badges, or completeness scores are used.

### 1.6 Drag Affordance

- **Grab zone:** The grip icon area on the left side of the card header
- **Grip icon:** A 2×n grid of dots (drag handle) — a persistent visual hint that this area is grabbable
- **Cursor states:**
  - Default arrow when not over grip area
  - Open hand when hovering over grip icon
  - Closed fist when mouse is held down (grabbed)
  - Closed fist while dragging
  - Open hand on mouse release
  - Returns to arrow when leaving grip area

The card's drag mechanic is unique to cards. It does not apply to any other UI element.

### 1.7 Card Actions

**Right-clicking anywhere on a card** opens a context menu with all available actions:
- Edit (opens detail popup)
- Lock / Unlock
- Delete
- Duplicate (with or without connections)

There is no persistent edit icon on the card surface. The grip icon is the only persistent interactive element on the card.

---

## 2. Card Content Structure

### 2.1 Sections

Every node contains the following sections, in this order:

1. **Title** — always visible to players once a node is discovered
2. **Node type** — always visible to players once a node is discovered (communicated via card color)
3. **Narrative** — rich text with inline media support; bullet-level discovery control (see Section 5)
4. **DM Notes** — rich text with inline media support; always hidden from players
5. **Mood board / Media** — dedicated media section; DM-only (see Section 3)
6. **Related to** — connections to other nodes with relationship types; discovery-controlled per relationship
7. **Custom fields** — user-defined text input fields; DM-only by default

### 2.2 Custom Fields

- Field type: plain text input only
- Defined per node by the user
- Can be added to card templates for automatic inclusion on new cards of that type
- Template changes apply to new cards only — existing cards are not retroactively updated
- Hidden from players by default

### 2.3 Card Templates

Users can define templates per node type. A template pre-populates custom fields for all new cards of that type. Template updates only affect cards created after the change.

### 2.4 Information Hierarchy

Information hierarchy follows established typographic best practices:
- **Card title / header:** Dominant — the first thing the eye lands on
- **Section headers (inside popup):** Clearly subordinate to the card title
- **Body text and bullet points:** Standard reading weight
- **Labels, metadata, secondary information:** Lightest weight

Specific type sizes and weights are aesthetic decisions deferred to the implementation phase.

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

### 5.1 Visual Language

All connection lines are visually identical — line style does not vary by relationship type. Relationship type is communicated exclusively through the **hover label**.

- **Hover label:** All relationship types for a connection are displayed stacked vertically, one per line, for easy scanning
- **Line treatment:** Solid (discovered) or dashed (undiscovered) per the discovery layer system

### 5.2 Creating Connections — Method 1: Canvas Drag

1. Hover over any card border → cursor changes to a **four-directional arrow**
2. Click and drag → a line begins drawing from that point
3. Drag toward target card → line snaps to the target card's border
4. Release mouse → connection is created and the **relationship type popup** appears

### 5.3 Creating Connections — Method 2: Detail Popup

Inside the Related to section of the detail popup:
1. A dropdown lists all available nodes
2. Selecting a node creates the connection
3. The **relationship type popup** appears

### 5.4 Relationship Type Popup

Appears immediately after a connection is created via either method.

- Dropdown with checkboxes — multiple relationship types can be selected for a single connection
- Options listed **alphabetically**
- **First option always:** Custom (free-text input field)
- Custom entries become permanent global presets, sorted alphabetically into the list
- Dismissing the popup without selecting **cancels the connection entirely** — no unlabeled connections exist
- At least one selection required to confirm

---

## 6. Detail Popup

### 6.1 Appearance

- **Centered modal** overlay
- **Draggable** by clicking and dragging the header bar — standard modal conventions (Figma/Photoshop mental model)
- The card's grip-icon drag mechanic does not apply to the modal

### 6.2 Layout

Single **scrolling panel**. Sections appear in the same order as the card, top to bottom:

1. Title
2. Node type
3. Narrative (rich text, checkable bullets, inline media)
4. DM Notes (rich text, inline media)
5. Mood board / Media
6. Related to (connections + relationship types + discovery toggles)
7. Custom fields

---

## 7. Canvas Navigation

### 7.1 Navigation Controls

| Interaction | Behavior |
|---|---|
| Scroll wheel | Zoom centered on cursor |
| Click and drag (canvas) | Pan |
| Double-click (canvas area) | Zoom into that area |

### 7.2 Bottom Toolbar

A persistent toolbar lives at the bottom of the screen. Contains (left to right):

| Control | Function |
|---|---|
| Undo | Undo last action (50-action limit per session, configurable in settings) |
| Redo | Redo last undone action |
| Zoom out | Decrease zoom level |
| Zoom level indicator | Shows current zoom percentage |
| Zoom in | Increase zoom level |
| Fit-all | Adjusts zoom and pan to fit all nodes in view; updates as map grows |
| Node | Drag onto canvas to create a new node |
| Text tool | Add freestanding canvas text label |

### 7.3 Creating a New Node

1. User drags the Node item from the toolbar onto the canvas
2. Node is dropped at the desired position
3. A **type selection popup** appears immediately
4. Popup lists all default types + custom types
5. **First option always:** Custom (creates a new permanent global card type)
6. User selects type → card is created in the correct color → detail popup opens for content entry

### 7.4 Text Tool

- Adds freestanding text directly on the canvas surface
- Not connected to any node — purely for canvas annotation and labeling
- Scalable by the user
- Default size: larger than any card header
- Follows the canvas information hierarchy (canvas labels > card headers > section headers > body text)

---

## 8. Search

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

## 9. Settings (Phase 1)

Settings panel contains at minimum:

- **Discovery layer toggle** — show/hide dashed vs. solid line distinction on the DM canvas (default: on)
- **Undo history limit** — configurable number of undo steps per session (default: 50)

---

## 10. Phase 2 (Deferred)

The following are fully deferred to Phase 2. Do not design or build until Phase 1 is complete:

- **Player view interface** — how players access and navigate their filtered map view
- **Collaboration indicators** — active user cursors, display names on canvas, active users list
- **Campaign management UI** — switching campaigns, inviting collaborators, managing permissions

Note: The data logic for player view (discovery state, bullet visibility, player-visible image designation) is already designed. Only the UI layer is deferred.
