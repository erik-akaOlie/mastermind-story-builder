# CLAUDE.md — Implementation Context for AI Sessions

Source of truth for any AI session working on this codebase. When this file conflicts with `design-document.md`, **this file wins** — the design doc captures original intent; this file captures current reality. When `project-brief.md` differs, this file wins for implementation specifics.

---

## Product

**Name:** MasterMind: Story Builder
**One-liner:** A visual, interactive continuity database for Dungeon Masters and Game Masters.
**V1 user:** Erik (a UX designer building a D&D campaign for his family). The app is also intended to be usable by other DMs later, but family-scale use is the design target for now.
**Working model:** Erik drives product direction, UX, and project management; Claude writes code, owns architecture, audits for best practices every sprint.

---

## Tech Stack (actual)

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + Vite | |
| Canvas | React Flow v11.11.4 | both `reactflow` and `@reactflow/core` are installed; use `reactflow` |
| Styling | Tailwind CSS v3 | rem units throughout; `html { font-size: 100% }` |
| Icons | **Phosphor Icons** (`@phosphor-icons/react`) | design doc says Lucide — **ignore that, we use Phosphor** |
| Drag-to-reorder | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | used in EditModal for bullets and images |
| State management | Zustand v5 | currently only for the local type store (`useTypeStore`); campaign data lives in React state hydrated from Supabase |
| Auth + Database | **Supabase** (Postgres + Auth + RLS) | `@supabase/supabase-js` client; schema in `supabase/schema.sql` |

Firebase was previously installed but never wired; it has been uninstalled. Do not reintroduce.

---

## Environment Variables

Two required, loaded from `.env` at the project root. See `.env.example`.

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable / anon public key>
```

Never use or reference the `service_role` key in client code.

---

## File Map

```
src/
  App.jsx                          root canvas: loads from Supabase, owns all edge state
  index.css                        Tailwind base + RF overrides + contenteditable placeholder CSS
  main.jsx                         entry; wraps app in AuthProvider → CampaignProvider → Root gatekeeper

  lib/                             infrastructure & data-access layer
    supabase.js                    single shared Supabase client (reads env vars)
    AuthContext.jsx                session + signIn/signUp/signOut context
    CampaignContext.jsx            active-campaign-id context; persists to localStorage
    campaigns.js                   CRUD for campaigns + listNodeTypes
    nodes.js                       CRUD for nodes + node_sections; shape-marshaling
    connections.js                 CRUD for connections (edges)
    textNodes.js                   CRUD for text annotations

  nodes/
    CampaignNode.jsx               colored campaign cards
    TextNode.jsx                   freestanding text annotation blocks (persists directly via lib/textNodes)
    iconRegistry.js                70+ Phosphor icons with keywords; getIcon(), recommendIcons()
    nodeTypes.js                   static NODE_TYPES object — LEGACY, prefer useNodeTypes()

  edges/
    FloatingEdge.jsx               straight-line edge renderer; reads sourcePoint/targetPoint from edge.data

  components/
    Login.jsx                      email+password auth form
    CampaignPicker.jsx             post-login landing; list/create/rename/delete campaigns
    UserAvatar.jsx                 circular profile button with dropdown (sign-out, etc.)
    UserMenu.jsx                   top-right overlay on the canvas: [Campaigns] + UserAvatar
    EditModal.jsx                  card detail editor (auto-saves, morph animation)
    ContextMenu.jsx                right-click menu on campaign nodes (Edit/Duplicate/Delete)
    CanvasContextMenu.jsx          right-click menu on empty canvas (Add card / Add text)
    CreateTypeModal.jsx            custom card type creation (label + icon + color picker)

  store/
    useTypeStore.js                Zustand store for node types; persists to localStorage under key "dnd-node-types"
                                   NOTE: built-in types are also seeded into Supabase per campaign. Custom-type
                                   persistence to the DB is a later sprint; currently localStorage-only.

  utils/
    labelUtils.js                  sortKey(), labelInitial()
    edgeRouting.js                 getNodeCenter(), getBorderIntersection(), getSpreadBorderPoints()

supabase/
  schema.sql                       full DB schema + RLS policies — run once in the Supabase SQL Editor

public/
  avatars/                         static avatar images for the sample Strahd data

Market Research/                   competitive analysis, roadmap, founder memos, this sprint's build plan
```

---

## Data Model

### Supabase schema (summary)

| Table | Purpose |
|---|---|
| `auth.users` | Supabase-managed; referenced by `campaigns.owner_id` |
| `campaigns` | one row per campaign; owned by a user |
| `node_types` | card types per campaign (built-in five + any custom); `is_system` flags the built-ins |
| `nodes` | cards on the canvas (label, summary, avatar_url, position, type_id) |
| `node_sections` | modular sections inside each card: `kind` ∈ `narrative` \| `hidden_lore` \| `dm_notes` \| `media` \| `custom`; `content` is JSONB |
| `connections` | edges between two nodes in the same campaign |
| `text_nodes` | free-floating text annotations on the canvas |

Full DDL in `supabase/schema.sql`. Every table has RLS enabled; policies require that the row's campaign belongs to the current `auth.uid()`.

### React shape (what handlers work with)

The data layer marshals DB rows back to the flatter React shape the canvas expects. See `src/lib/nodes.js`.

```js
// Campaign node (React/React Flow shape)
{
  id: string,
  type: 'campaignNode',
  position: { x: number, y: number },
  data: {
    id: string,                     // duplicated for convenience
    label: string,
    type: 'character' | 'location' | 'item' | 'faction' | 'story' | string,
    avatar: string | null,          // URL or base64 data URI
    summary: string,
    storyNotes: string[],           // from node_sections where kind='narrative'
    hiddenLore: string[],           // from node_sections where kind='hidden_lore'
    dmNotes: string[],              // from node_sections where kind='dm_notes'
    media: string[],                // from node_sections where kind='media'
    locked: boolean,                // in-memory only (lock feature scoped out of V1)
    // UI-only (not persisted):
    isEditing: boolean,
    connectionDots: { x, y, color }[],
    anySelected: boolean,
    anyHovered: boolean,
    hoveredEdgeNodeIds: Set<string>,
  }
}

// Text node data
{
  text: string,         // HTML (contenteditable output)
  editing: boolean,
  width: number,        // px
  height: number|null,  // px; null = auto
  fontSize: number,     // px (13 | 18 | 24 | 36)
  align: 'left' | 'center' | 'right',
}
```

### Persistence pattern

All data-mutating handlers follow the **optimistic UI + fire-and-forget** pattern:

1. Update React state immediately (so the UI is snappy).
2. Call the corresponding `lib/*.js` function to persist.
3. On error: `.catch(console.error)`. Toast-based error surfacing is a later sprint.

Position changes persist only on `onNodeDragStop` (not on every pixel of drag). Text-node resize persists only on mouseup, not on every mousemove.

---

## Key Conventions

### System CTA color

`#0284C7` (Tailwind `sky-600`) for all card-type-agnostic action buttons (login, "Create" in CreateTypeModal, "New campaign" in CampaignPicker). **Never reuse a card-type color for system UI.**

### Luminance-based text color

Any element rendered on a card-type-colored background (header, chips, buttons) must compute whether to use dark or white text:

```js
function textForHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#111827' : '#ffffff'
}
```

Used in: EditModal header, type selector chips, connection chips, CampaignNode header, UserAvatar.

### Icons — always Phosphor, always `weight="fill"` for content icons

```jsx
import { UserCircle } from '@phosphor-icons/react'
<UserCircle size={16} weight="fill" color={cfg.color} />
```

Toolbar/UI icons use `weight="bold"`. Never use Lucide.

### Dynamic icon visibility on card headers

At extreme zoom-out, the type icon in a card header would visually overlap the title. `CampaignNode.jsx` computes `iconHidden` via canvas `measureText` — it simulates the converged layout deterministically so there's no feedback loop with `avatarSize`. Do not make `iconHidden` depend on runtime-measured `avatarSize`; that path caused oscillation at certain zooms.

### Screen → canvas coordinate conversion

```js
const rfInstance = rfInstanceRef.current
const flowPos = rfInstance.project({ x: event.clientX, y: event.clientY })
```

`rfInstanceRef` is populated via `onInit` on the `<ReactFlow>` component.

---

## Architecture Notes

### Auth flow

- `src/main.jsx` wraps the app in `AuthProvider` → `CampaignProvider` → `Root`.
- `Root` gatekeeper: loading → null; not signed in → `<Login />`; signed in with no active campaign → `<CampaignPicker />`; signed in with active campaign → `<App /> + <UserMenu />`.
- Active campaign id is persisted in localStorage (`mastermind:activeCampaignId`) so refresh returns to the same campaign.

### Campaign creation seeds node_types

`createCampaign(name, description)` in `lib/campaigns.js` inserts the campaign row AND inserts the five built-in node types (`character`, `location`, `item`, `faction`, `story`) linked to that campaign. Colors and icon names match `useTypeStore`'s `DEFAULT_TYPES`.

### How connections work

`App.jsx` owns all edge state. It does NOT use React Flow handles. Instead:

- `getSpreadBorderPoints()` computes where dots appear on each card border
- `getBorderIntersection()` computes the edge endpoints
- Edges carry `data.sourcePoint` / `data.targetPoint` (screen-space `{x, y}`) which `FloatingEdge` reads directly
- `syncedNodeIds` ref in EditModal tracks which connections have been created as RF edges, preventing duplicates

### How auto-save works (EditModal)

- `doSaveRef` always points to the latest save closure
- A `useEffect` debounces the save 400ms after any change
- `handleClose` flushes immediately via `doSaveRef.current()`
- No Save / Cancel buttons — they were removed

### How TextNode drag works

While in edit mode, React Flow's `dragHandle` prop restricts drag to `.text-node-drag-handle` (the grip icon in the toolbar). This prevents the contenteditable from accidentally triggering node drag:

```js
// Entering edit mode:
{ ...node, draggable: true, dragHandle: '.text-node-drag-handle', data: { ...data, editing: true } }

// Exiting edit mode (save):
{ ...node, draggable: true, dragHandle: undefined, data: { ...data, text: html, editing: false } }
```

### TextNode rich text

Uses `contentEditable` div (not `<textarea>`). Bold/italic are per-selection via `document.execCommand('bold'/'italic')`. Data is stored as HTML. Display mode renders with `dangerouslySetInnerHTML`.

**Critical:** the edit div and display div must have `key="editor"` and `key="display"` respectively. Without keys, React reuses the same DOM element and leaves behind a raw text node that causes text duplication on save.

### TextNode persistence

TextNode imports `updateTextNode`/`deleteTextNode` directly from `lib/textNodes.js`:

- `save()` (on blur) writes `contentHtml` to the DB
- `update()` (toolbar font/align changes) persists immediately
- Resize drag: accumulates final values during mousemove, persists once on mouseup
- Delete from toolbar: calls `dbDeleteTextNode` then filters React state

The context-menu delete path goes through `App.onDeleteNode`, which also calls `dbDeleteTextNode`. Two delete paths, same net effect.

### Adding a new built-in node type

Not needed currently, but if we ever do:

1. Add to `DEFAULT_TYPES` in `useTypeStore.js` with `{ label, color, iconName }`
2. Add to `BUILT_IN_TYPES` in `src/lib/campaigns.js` so new campaigns seed it
3. Add the Phosphor icon name to `iconRegistry.js` if not already there

Custom user-created types are scoped per campaign in Supabase but the UI flow for creating them (`CreateTypeModal`) still writes to localStorage — wiring that to Supabase is a later sprint.

---

## What Is Built

- [x] Supabase auth (email+password), login screen, sign-out, avatar dropdown
- [x] Campaign CRUD (create, list, rename, delete, switch)
- [x] RLS policies on every table
- [x] 5 built-in node types seeded per campaign
- [x] Campaign cards with header, avatar, summary, bullet body, connection dots
- [x] Edit modal: title, type, avatar/thumbnail, summary, story notes, hidden lore, DM notes, media, connections
- [x] Auto-save (400ms debounce, flush on close) — writes to Supabase
- [x] Drag-to-reorder bullets and images in edit modal
- [x] Image lightbox in edit modal
- [x] Right-click canvas → "Add card" (submenu) or "Add text" (persists to DB)
- [x] Right-click node → Edit / Duplicate / Delete (persists to DB)
- [x] Freestanding text nodes (contenteditable, rich text, resize, formatting toolbar, all persisted)
- [x] Canvas pan (spacebar + drag), zoom, marquee selection, shift-click multi-select
- [x] Floating edge routing (border intersection points, dot spreading)
- [x] Luminance-based text color on all type-colored backgrounds
- [x] Zoom-compensated card titles (inverse scale, capped at 5×)
- [x] Dynamic icon visibility at extreme zoom-out (no feedback-loop flicker)
- [x] Icon registry with keyword-based recommendations
- [x] Position persistence on node drag-stop; text node resize persistence on mouseup

## What Is NOT Built (roadmap)

See README.md "What's Not Built Yet" for the sprint-by-sprint plan. High level:

- **Sprint 1.5:** Realtime sync (Supabase Realtime subscriptions)
- **Sprint 2:** Undo/redo; card templates per type
- **Sprint 3:** Modular card sections UI (reorder/add/remove; template editor)
- **Sprint 4:** Search panel; drag-to-connect; relationship labels on edges; Shift+1 fit-all
- **Sprint 5:** AI copilot grounded in campaign data
- **Deferred:** Player view, sharing/collaboration, D&D Beyond integration, native mobile apps

## Cut from V1

- Lock / unlock cards (feature scoped out; `locked` state remains in-memory only)
- Duplicate-with-connections (plain duplicate is sufficient)

---

## Cut Scope Notes

**"Locked" state is in-memory only.** The Supabase schema has no `locked` column on `nodes`. If we reinstate the lock feature later, add a column and a migration. Until then, do not persist `data.locked`.

**Custom node types are still localStorage-only.** The `node_types` table persists the built-in five per campaign, but user-created custom types (via CreateTypeModal) only live in the browser's localStorage. Migrating custom types to Supabase is a later task; flag it if it becomes user-facing.

---

## Relationship to `design-document.md`

As of the Sprint 1 hygiene pass, `design-document.md` has been updated to reflect current reality (Phosphor icons, Supabase backend, sections that are now built, lock feature cut, etc.).

Going forward:

- When a new divergence between design intent and implementation arises, **prefer updating the design doc** to keep the two in sync.
- When the divergence is a deliberate design decision worth preserving with context, write an ADR in [`docs/decisions/`](./docs/decisions/) and link to it from both files.
- If a divergence is a tactical hack that'll be revisited, note it in this file under a "Known Divergences" table and document it precisely.

### Known Divergences

| Area | Current reality | Design-doc state | Why it's logged here |
|---|---|---|---|
| Custom node types | Persisted per-browser in `localStorage` via `useTypeStore` (key `dnd-node-types`) | Described as per-campaign rows in `node_types` | Tactical: the DB already supports it; the UI write path wasn't migrated. Revisit before custom types become user-facing to anyone besides Erik. Cross-ref: "Cut Scope Notes" above. |
| Top-left breadcrumb + campaign switcher (`UserMenu.jsx`) | Collapsible house-icon chip that expands on hover to reveal `Campaigns / <name> v`; chevron opens a dropdown that switches campaigns in place | Design doc still describes a top-right UserMenu with separate Campaigns button + avatar | New UX, shipped after the design-doc Sprint 1 sync. Design doc should be updated to match (preferred path per policy). |
| Sync status chip (`SyncIndicator.jsx`) + lock overlay (`LockOverlay.jsx`) + 3-strike auto-retry (`persistWrite` + `useProbeLoop`) | Ambient bottom-left "Edited just now" chip; lock modal freezes edits on offline / 3 consecutive failures; 3s probe loop unlocks on reconnect; Sonner toast on final failure | Not in design doc | New behavior responding to the "loss of trust" risk in `project-brief.md`. Candidate for an ADR covering the probe-vs-requeue tradeoff and the 3-failure threshold. |

These last two divergences should be resolved either by updating `design-document.md` or writing ADRs — they're not hacks, they're design decisions that happened after the most recent doc sync.
