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
| State management | Zustand v5 | two stores: `useTypeStore` (node types, localStorage-persisted) and `useCanvasUiStore` (transient hover/select flags). Campaign data lives in React state hydrated from Supabase. |
| Auth + Database | **Supabase** (Postgres + Auth + RLS) | `@supabase/supabase-js` client; schema in `supabase/schema.sql` |
| Image storage | **Supabase Storage** (`card-media` bucket) | private bucket; client requests signed URLs per render. See ADR-0005. |

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
  App.jsx                          canvas orchestration: composes hooks, renders ReactFlow + menus + modal
  index.css                        Tailwind base + RF overrides + .is-lifted z-index rule
  main.jsx                         entry; wraps app in AuthProvider → CampaignProvider → Root gatekeeper;
                                   hash-based route to <MigrateImages /> at #migrate

  lib/                             infrastructure & data-access layer
    supabase.js                    single shared Supabase client (reads env vars)
    AuthContext.jsx                session + signIn/signUp/signOut context
    CampaignContext.jsx            active-campaign-id context; persists to localStorage
    campaigns.js                   CRUD for campaigns + listNodeTypes
    nodes.js                       CRUD for nodes + node_sections; shape-marshaling
    connections.js                 CRUD for connections (edges)
    textNodes.js                   CRUD for text annotations
    imageStorage.js                Storage helpers: transcode → two WebP variants → upload; signed-URL fetch
    useImageUrl.js                 hook resolving avatar/media values to renderable URLs (handles base64,
                                   external https, and Storage paths)
    errorReporting.js              persistWrite() retry wrapper; drives the sync indicator
    CanvasOpsContext.jsx           context exposing App-level ops (onDeleteNode) to RF custom node
                                   renderers. Workaround for RF v11's `useReactFlow().setNodes` not
                                   propagating removals to App's `useNodesState`. See file header.

  hooks/                           reusable hooks extracted from App.jsx and EditModal
    useSpacebarPan.js              spacebar-held-down panning state
    useCampaignData.js             load lifecycle for the active campaign (types + nodes + edges + text)
                                   AND Supabase Realtime subscriptions that mirror remote INSERT/UPDATE/DELETE
                                   into setNodes/setEdges
    useEdgeGeometry.js             recomputes spread border points + connection-dot positions when nodes move
    useNodeHoverSelection.js       returns the four ReactFlow hover/select handlers, all backed by useCanvasUiStore
    useAutoSave.js                 debounced save with explicit flush; used by EditModal
    useMorphAnimation.js           modal-from-card morph in/out (useLayoutEffect setup, RAF animate-in,
                                   returned animateClose for exit); used by EditModal

  nodes/
    CampaignNode.jsx               colored campaign cards; subscribes to useCanvasUiStore; adds .is-lifted
                                   class so :has() in index.css promotes the wrapper z-index
    TextNode.jsx                   freestanding text annotation blocks (persists directly via lib/textNodes)
    iconRegistry.js                70+ Phosphor icons with keywords; getIcon(), recommendIcons()
    nodeTypes.js                   static NODE_TYPES object — LEGACY, prefer useNodeTypes()

  edges/
    FloatingEdge.jsx               straight-line edge renderer; reads sourcePoint/targetPoint from edge.data

  components/
    Login.jsx                      email+password auth form
    CampaignPicker.jsx             post-login landing; list/create/rename/delete campaigns
    UserAvatar.jsx                 circular profile button with dropdown (sign-out, etc.)
    UserMenu.jsx                   top-left breadcrumb chip + UserAvatar overlay on the canvas
    EditModal.jsx                  orchestration shell: form state + auto-save trigger + composes the
                                   pieces below. Was 792 lines before Sprint 1.6 — now 228 (state +
                                   composition only)
    EditModalHeader.jsx            avatar + title + TypePicker + close button (the type-colored band)
    BulletSection.jsx              reusable section: DnD-reorder bullets + focus-on-new + add/remove.
                                   Used three times by EditModal (Story Notes, Hidden Lore, DM Notes).
                                   Exports `newItem` for parents seeding initial state
    MediaSection.jsx               Inspiration grid: DnD-reorder image tiles + parallel-safe upload
                                   (uses a ref to track latest items so concurrent uploads don't clobber)
    ConnectionsSection.jsx         chip list + node picker with click-outside-to-dismiss
    TypePicker.jsx                 type dropdown (used inside EditModalHeader) + "Create new type…" row
    SectionLabel.jsx               tiny uppercase-tracked label utility used across sections
    ContextMenu.jsx                right-click menu on campaign nodes (Edit/Duplicate/Delete)
    CanvasContextMenu.jsx          right-click menu on empty canvas (Add card / Add text). Submenu uses
                                   a 16px invisible hover-bridge + 200ms hover-intent close delay
    CreateTypeModal.jsx            custom card type creation (label + icon + color picker)
    Lightbox.jsx                   shared <LightboxProvider>; any consumer calls useLightbox().open(value)
    MigrateImages.jsx              one-shot tool at #migrate to backfill base64 → Storage; safe to delete
                                   once no campaign has any base64 image entries
    LockOverlay.jsx                modal that freezes edits on prolonged save failure
    SyncIndicator.jsx              ambient bottom-left "Edited just now" / "Can't save" chip
    EditModal.test.jsx             10 happy-path tests pinning down EditModal behavior (open/populate,
                                   debounced auto-save, connection add/remove, Esc to close, avatar upload)

  store/
    useTypeStore.js                Zustand store for node types; persists to localStorage under key "dnd-node-types"
                                   NOTE: built-in types are also seeded into Supabase per campaign. Custom-type
                                   persistence to the DB is a later sprint; currently localStorage-only.
    useCanvasUiStore.js            Zustand store for transient canvas UI flags (anySelected, anyHovered,
                                   hoveredEdgeNodeIds). Cards subscribe via narrow selectors so a hover event
                                   only re-renders cards whose computed state actually changed.
    useSyncStore.js                Zustand store for write-success/failure tracking (drives SyncIndicator + LockOverlay)

  utils/
    labelUtils.js                  sortKey(), labelInitial()
    edgeRouting.js                 getNodeCenter(), getBorderIntersection(), getSpreadBorderPoints()

supabase/
  schema.sql                       full DB schema + RLS policies — run once in the Supabase SQL Editor
  migrations/
    001_node_types_per_user.sql    moves node_types from per-campaign to per-user ownership
    002_card_media_bucket.sql      creates the card-media Storage bucket + SECURITY DEFINER RLS helper

public/
  avatars/                         static avatar images for the sample Strahd data

docs/
  decisions/                       ADRs covering architecture calls (Supabase, modular sections, image storage, etc.)

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
    avatar: string | null,          // Supabase Storage path (e.g. "<campaignId>/<cardId>/avatar-…full.webp"),
                                    // OR a /avatars/* external URL for the bundled Strahd sample data.
                                    // Legacy base64 data URIs render fine via useImageUrl but no new ones are written.
    summary: string,
    storyNotes: string[],           // from node_sections where kind='narrative'
    hiddenLore: string[],           // from node_sections where kind='hidden_lore'
    dmNotes: string[],              // from node_sections where kind='dm_notes'
    media: Array<                   // from node_sections where kind='media'
      | string                      //   legacy: a base64 data URI or a /avatars/* URL (still rendered, but new
                                    //   uploads use the structured shape below)
      | {                           //   current shape per ADR-0005:
          path: string,             //     Supabase Storage path
          alt: string,              //     accessibility text (currently always '' on upload)
          uploaded_at: string,      //     ISO timestamp at upload time
        }
    >,
    locked: boolean,                // in-memory only (lock feature scoped out of V1)
    // UI-only (not persisted):
    isEditing: boolean,
    connectionDots: { x, y, color }[],
    // NOTE: anySelected, anyHovered, and hoveredEdgeNodeIds USED to live here.
    // They moved into useCanvasUiStore so a hover event mutates one atomic value
    // instead of forcing a re-render of every card. CampaignNode now subscribes
    // to those values directly via narrow Zustand selectors.
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

### Hooks layer (`src/hooks/`)

`App.jsx` was 700+ lines after Sprint 1; the post-Sprint-1 refactor pulled four focused hooks out of it. They were extracted so Sprint 1.5 Realtime work had clean places to land instead of more sediment in App.jsx:

- `useSpacebarPan()` — keyboard listeners; returns the `isPanning` boolean.
- `useCampaignData({ campaignId, setNodes, setEdges })` — owns the load lifecycle (types + nodes + connections + text) AND the Supabase Realtime subscriptions. Returns `{ loading, loadError }`.
- `useEdgeGeometry({ nodes, edges, setNodes, setEdges })` — recomputes spread border points + connection-dot positions on node movement. Pure derivation; mutates state via the supplied setters.
- `useNodeHoverSelection({ setEdges })` — returns the four ReactFlow handlers (`onSelectionChange`, `onNodeMouseEnter`, `onNodeMouseLeave`, `onEdgeMouseEnter`, `onEdgeMouseLeave`). All five mutate `useCanvasUiStore`; only `onEdgeMouseEnter`/`onEdgeMouseLeave` also touch the edges array (for stroke styling).

### Realtime sync (Sprint 1.5)

`useCampaignData` opens one Supabase channel per active campaign with four `postgres_changes` listeners — one each for `nodes`, `node_sections`, `connections`, and `text_nodes`. Incoming events are translated back into the React/React Flow shape via the existing marshalers (`dbNodeToReactFlow`, `dbTextNodeToReactFlow`) and merged into `setNodes` / `setEdges`. The channel is torn down when the campaign id changes or the hook unmounts.

- **DB-side filter:** `campaign_id=eq.${campaignId}` on three tables. `node_sections` has no `campaign_id` column, so it's filtered client-side by checking whether `node_id` is in local state; RLS already restricts to the user's own rows.
- **Required SQL (run once per project):** TWO setup steps — (a) the four tables must be members of the `supabase_realtime` publication; (b) the four tables must be set to `REPLICA IDENTITY FULL` so DELETE broadcasts include all columns. Without (b), the `campaign_id=eq.X` filter rejects DELETE events because the broadcast `old` row only carries the primary key. See both SQL blocks in the Sprint 1.5 + Sprint 1.5b entries of `CHANGELOG.md`. **Apply this `REPLICA IDENTITY FULL` pattern to any future table whose Realtime DELETE events need to pass an RLS or column-filter check.**
- **No echo filter (V1).** Self-writes round-trip through the channel and re-set identical values. If two tabs simultaneously edit the same field, the last write wins and a character may be dropped — accepted trade-off, revisit only if it becomes noticeable in practice.
- **UI-only state preservation:** the `text_nodes` UPDATE handler preserves `data.editing` so a remote update can't kick the local tab out of edit mode mid-keystroke. The `nodes` UPDATE handler preserves the in-memory `storyNotes/hiddenLore/dmNotes/media` arrays (those flow through `node_sections` events instead).

### Canvas UI store (`useCanvasUiStore`)

`anySelected`, `anyHovered`, and `hoveredEdgeNodeIds` are NOT per-node `data` fields — they're a Zustand store that every card subscribes to. The previous approach (`setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, anyHovered: true } })))`) rewrote every node on every hover and forced React Flow to re-render every card; tolerable at 10 cards, unusable at 500. With the store, a hover event mutates one atomic value and only cards whose computed value flips re-render. Use the `selectIsEdgeHighlighted(nodeId)` helper exported from the store for the per-card edge-highlight subscription.

### Image storage (per ADR-0005)

Card avatars and inspiration images live in the **`card-media` Supabase Storage bucket**, not as base64 inside the database. Two variants per upload (`.thumb.webp` 256px / 40% q, `.full.webp` 1920px / 80% q), generated client-side via Canvas at upload time. The DB stores only the path string (avatars) or `{path, alt, uploaded_at}` object (inspiration entries) — see the React shape above.

- `src/lib/imageStorage.js` owns transcode + upload + delete.
- `src/lib/useImageUrl.js` is the hook every renderer uses; it accepts a value of any shape and returns either a signed URL, a base64 string passthrough, or null.
- `src/components/Lightbox.jsx` is the single shared lightbox (provider + hook); CampaignNode and EditModal both call `useLightbox().open(value)`.
- **Bucket RLS uses a SECURITY DEFINER helper** (`public.user_owns_card_media_path`) instead of inlining the campaign-ownership lookup inside each policy. The inlined version silently fails — the cross-schema query from `storage.objects` to `public.campaigns` returns no rows even when the user owns the campaign, and every upload errors with "new row violates row-level security policy". The helper bypasses RLS on `public.campaigns` while still pinning the check to `auth.uid()`. See [supabase/migrations/002_card_media_bucket.sql](./supabase/migrations/002_card_media_bucket.sql) for the canonical version. **Apply this pattern to any future Storage bucket that needs cross-schema ownership checks.**
- `#migrate` is a temporary hash route to the migration tool ([src/components/MigrateImages.jsx](src/components/MigrateImages.jsx)) for backfilling any base64 entries; once a campaign has zero base64 entries the page reports "Nothing to migrate" and the route can be removed.

### Z-index lift (CampaignNode + index.css)

When a card is hovered, selected, or part of a hovered edge, it adds `.is-lifted` to its inner div. `index.css` uses `:has(.is-lifted)` to bump the React Flow wrapper's `z-index`, so neighboring cards don't visually cut through the lifted one. `:has()` requires modern Chromium / Safari / Firefox.

### How connections work

`App.jsx` orchestrates edge state via the hooks above. It does NOT use React Flow handles. Instead:

- `getSpreadBorderPoints()` computes where dots appear on each card border
- `getBorderIntersection()` computes the edge endpoints
- Edges carry `data.sourcePoint` / `data.targetPoint` (screen-space `{x, y}`) which `FloatingEdge` reads directly
- `syncedNodeIds` ref in EditModal tracks which connections have been created as RF edges, preventing duplicates

### EditModal decomposition (Sprint 1.6)

EditModal is the orchestration shell — it owns form state and composes sub-components. State (title, type, summary, bullet sections, media, thumbnail, localConns) lives in EditModal because the auto-save reads from all of them via one `useAutoSave` call. Sub-components are controlled (take `value` + `setter` props):

| Piece | Owns | Receives from EditModal |
|---|---|---|
| `<EditModalHeader>` | uploading-avatar state, file-picker ref, `titleRef` (focus on mount) | title/setTitle, type/setType, typeConfig, hdrText, TypeIcon, thumbnail/setThumbnail, campaignId, onClose, onCreateNewType |
| `<BulletSection>` | DnD context, sensors, refs for focus-on-new, add/remove/update logic | items, onChange, label, placeholder, dotColor, addLabel |
| `<MediaSection>` | DnD context, file-picker ref, `uploadingCount`, `currentItemsRef` (parallel-upload safety) | items, onChange, cardId, campaignId, slug |
| `<ConnectionsSection>` | picker open/close, click-outside dismissal, available-nodes filtering + sort | localConns, setLocalConns, allOtherNodes |
| `<TypePicker>` | dropdown open/close, hover state | type, setType, hdrText, onCreateNewType |
| `useAutoSave` | doSaveRef pattern, debounce timer | doSave callback, deps array, optional delay |
| `useMorphAnimation` | useLayoutEffect setup, RAF animate-in, animateClose | modalRef, backdropRef, originRect, onClose |

10 happy-path tests in `EditModal.test.jsx` pin behavior down. Run with `npm test`.

### How auto-save works (EditModal)

- `useAutoSave({ doSave, deps, delay })` debounces a save 400ms after any dep changes
- The hook stores `doSave` in a ref so the timer always calls the latest closure (with the latest state)
- Returns `flushSave()` for synchronous saves on close (Esc, click-backdrop)
- No Save / Cancel buttons — they were removed long ago

### React Flow v11 gotchas (real footguns we've hit)

Three issues we've hit in practice that future sessions need to know about. Each has a concrete workaround in the codebase.

1. **`useReactFlow().setNodes((nds) => nds.filter(...))` does not propagate removals to App's `useNodesState`.** RF v11's setNodes only emits `'reset'` changes for kept nodes when controlled-mode `onNodesChange` is wired up — never `'remove'` for nodes that disappeared from the array (unless you remove ALL nodes). The deleted node visually disappears from RF's internal store but App's state still has it; any subsequent re-render re-syncs and the "deleted" node reappears. **Workaround:** [`src/lib/CanvasOpsContext.jsx`](./src/lib/CanvasOpsContext.jsx) exposes App's `onDeleteNode` (which uses App's `setNodes` directly) to RF's custom node renderers. TextNode's trash button uses this.

2. **RF v11's NodeWrapper interferes with React's synthetic event delegation for SELECTED nodes.** `onMouseDown`/`onClick` on toolbar buttons inside a custom node fail to fire after the node has been selected. Native pointer events DO reach the buttons, but React's root-level event listener never sees them — something between the button and React's root is calling `stopPropagation` in the bubble phase. **Workaround:** the `NativeButton` wrapper inside [`src/nodes/TextNode.jsx`](./src/nodes/TextNode.jsx) attaches native `pointerdown` + `click` listeners directly to each toolbar button via a ref + `useEffect`, bypassing React's event delegation. Native `pointerdown` also calls `preventDefault()` so contenteditable focus isn't shifted mid-click (which would otherwise blur, fire save, and unmount the toolbar mid-click).

3. **Programmatic `el.focus()` on a freshly-mounted contenteditable inside a React Flow node is unreliable in Edge/Chromium.** Even with `tabindex=0`, `contenteditable=true`, the element connected, and `document.hasFocus()` returning true, `el.focus()` can be a silent no-op. **Workaround:** [`src/nodes/TextNode.jsx`](./src/nodes/TextNode.jsx) uses HTML `autoFocus` + a retry loop (up to 10 attempts at 50ms intervals) that bails as soon as `document.activeElement === el`.

If you find yourself fighting RF for any of these, don't reinvent — look at the existing workarounds first.

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
- [x] **Image storage** in Supabase Storage with thumb + full WebP variants; client-side transcode at upload; signed-URL rendering. EditModal's avatar + inspiration uploads write straight to Storage.
- [x] **Shared lightbox** — clicking a card avatar (canvas or modal) or any inspiration tile opens the same overlay.
- [x] **App.jsx refactor** — load lifecycle, edge geometry, hover/select, and spacebar pan all extracted into focused hooks under `src/hooks/`. Hover/select state moved into `useCanvasUiStore` so a hover event no longer re-renders every card.
- [x] Z-index lift — hovered/selected cards rise above their neighbors via a `:has(.is-lifted)` rule.
- [x] **Realtime sync** — Supabase Realtime channel in `useCampaignData` mirrors remote `nodes` / `node_sections` / `connections` / `text_nodes` INSERT/UPDATE/DELETE into local state. No echo filter in V1; self-writes round-trip harmlessly. Requires `REPLICA IDENTITY FULL` on each table for DELETE events to pass RLS + filter checks.
- [x] **EditModal decomposition** — 792-line component split into `<EditModalHeader>`, `<BulletSection>` (×3), `<MediaSection>`, `<ConnectionsSection>`, `<TypePicker>` + `useAutoSave` and `useMorphAnimation` hooks. EditModal itself is now 228 lines of orchestration.
- [x] **Component tests** — Vitest + React Testing Library + jsdom; `EditModal.test.jsx` covers 10 happy-path scenarios. Run with `npm test`.

## What Is NOT Built (roadmap)

See [`BACKLOG.md`](./BACKLOG.md) for the current backlog. It's tier-ranked
(Tier 1 quick wins, Tier 2 foundational, Tier 3 big features that need a
spike, Tier 4 polish), reviewed at the start of each sprint, and each item
carries a problem statement, success criteria, and dependencies. The
numbered Sprint 2 / 3 / 4 / 5 roadmap that previously lived here is retired
— sequential sprint plans don't survive contact with reality once the
backlog grows past a handful of items with real dependencies. Deferred
work (player view, sharing/collaboration, D&D Beyond integration, native
mobile apps) is captured in `project-brief.md` and the Market Research
roadmap.

## Cut from V1

- Lock / unlock cards (feature scoped out; `locked` state remains in-memory only)
- Duplicate-with-connections (plain duplicate is sufficient)

---

## Cut Scope Notes

**"Locked" state is in-memory only.** The Supabase schema has no `locked` column on `nodes`. If we reinstate the lock feature later, add a column and a migration. Until then, do not persist `data.locked`.

**Custom node types are still localStorage-only.** The `node_types` table persists the built-in five per campaign, but user-created custom types (via CreateTypeModal) only live in the browser's localStorage. Migrating custom types to Supabase is a later task; flag it if it becomes user-facing.

**Legacy base64 image entries are read-only.** `useImageUrl` still resolves base64 data URIs (so any old data renders), but EditModal no longer writes new base64 — uploads go to Storage. Once every campaign has zero base64 entries, the legacy branch in `useImageUrl` and the `MigrateImages` component can both be deleted in the same PR.

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
