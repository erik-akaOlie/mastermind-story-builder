# CLAUDE.md — Implementation Context for AI Sessions

Source of truth for any AI session working on this codebase. When this file conflicts with [`docs/design/design-system.md`](./docs/design/design-system.md), **this file wins** — the design doc captures original intent; this file captures current reality. When [`docs/product/vision.md`](./docs/product/vision.md), [`docs/product/roadmap.md`](./docs/product/roadmap.md), or [`docs/product/tenets.md`](./docs/product/tenets.md) differ, this file wins for implementation specifics.

---

## Product

**Name:** MasterMind: Story Builder
**One-liner:** A visual canvas for building a story world as an interconnected web of cards — see the whole at once, trace connections, spot gaps and opportunities.
**V1 user:** Game masters building tabletop-RPG campaigns — the currently-evidenced instance of a broader user (people building an invented fictional world and developing a story within it). See [ADR-0013](./docs/decisions/0013-product-positioning.md). Real-world use today is Erik building a D&D campaign for his family, so family-scale daily use is the practical design target.
**Working model:** Erik drives product direction, UX, and project management; Claude writes code, owns architecture, audits for best practices every sprint.

---

## Working agreement — architecture & design-system decisions

When Erik challenges a recommendation, do not shift into apology, self-analysis, trust-repair language, or long explanations about reasoning process unless he explicitly asks for them.

Instead:

- Re-evaluate the problem using system invariants and existing architectural constraints.
- Explicitly identify overlooked variables, dependencies, and downstream impacts.
- Verify assumptions against existing code, ADRs, and established project principles before recommending alternatives when the decision materially affects the system.
- Keep responses concise, technical, and solution-oriented.
- Prioritize structural correctness, scalability, maintainability, and long-term system coherence over intuitively appealing or visually salient answers.
- Avoid speculative recommendations that have not been validated against the broader system.
- Do not optimize for sounding thoughtful. Optimize for being rigorous, practically correct, and architecturally consistent.

For architecture and systems-design discussions, use this structure by default when appropriate:

1. **Problem framing**
2. **Invariants and constraints**
3. **Variables/dependencies**
4. **Candidate approaches**
5. **Elimination reasoning**
6. **Recommended approach**
7. **Tradeoffs/risks**

Do not spend context budget analyzing your own behavior unless explicitly requested.

Do not confuse visible salience with structural invariance. Recommendations should be grounded in stable system references, not visually prominent elements.

---

## Tech Stack (actual)

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + Vite | |
| Canvas | React Flow v11.11.4 | both `reactflow` and `@reactflow/core` are installed; use `reactflow` |
| Styling | Tailwind CSS v3 | rem units throughout; `html { font-size: 100% }` |
| Icons | **Phosphor Icons** (`@phosphor-icons/react`) | design doc says Lucide — **ignore that, we use Phosphor** |
| Drag-to-reorder | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | used in the Inspector for bullets and images |
| State management | Zustand v5 | Several focused in-memory stores under `src/store/` — see the File Map. All are caches over Supabase, not persistence layers. Workspace data lives in React state hydrated from Supabase. |
| Auth + Database | **Supabase** (Postgres + Auth + RLS) | `@supabase/supabase-js` client; schema in `supabase/schema.sql` |
| Image storage | **Supabase Storage** (`workspace-media` + `profile-media` buckets) | both private; clients request signed URLs per render. workspace-media holds card avatars + inspiration images (two variants per upload). profile-media holds user profile avatars (single 256×256 variant). See ADR-0005 (workspace-media) and migration 003 (profile-media). |
| Behavioral analytics | **PostHog Cloud** (`posthog-js`) | session replay + named events, scoped to `is_test_user=true` users only. Loaded via dynamic import (Vite splits into its own chunk; non-testers never download it). See ADR-0009. |

Firebase was previously installed but never wired; it has been uninstalled. Do not reintroduce.

---

## Environment Variables

Loaded from `.env` at the project root. See `.env.example`.

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable / anon public key>
VITE_POSTHOG_KEY=phc_<project token>
VITE_POSTHOG_HOST=https://us.i.posthog.com    # or https://eu.i.posthog.com
```

Never use or reference the Supabase `service_role` key in client code.

`VITE_POSTHOG_KEY` must be set at **build time**, not just at runtime. Vite
substitutes `import.meta.env.VITE_POSTHOG_KEY` with its literal value during
the build. If the value is empty, the early-bail branch in
[`src/lib/analytics.js`](./src/lib/analytics.js) becomes the only statically
reachable code path and Rollup dead-code-eliminates the dynamic
`import('posthog-js')` — the PostHog chunk is never emitted and analytics
cannot work even if a tester signs in later. Any CI/production build pipeline
must inject the env var; Erik's local `.env` already has it.

---

## File Map

```
src/
  App.jsx                          canvas orchestration: composes hooks, renders ReactFlow + menus + modal
  index.css                        Tailwind base + RF overrides + .is-lifted z-index rule
  main.jsx                         entry; wraps app in AuthProvider → WorkspaceProvider → ProfileProvider →
                                   Root gatekeeper; hash routes to <MigrateImages /> at #migrate and to
                                   <Profile /> at #profile

  lib/                             infrastructure & data-access layer
    supabase.js                    single shared Supabase client (reads env vars)
    AuthContext.jsx                session + signIn/signUp/signOut context. signOut calls
                                   useUndoStore.clearAllForUser(userId) before Supabase clears the session
                                   so a different next user can't inherit prior undo history.
    WorkspaceContext.jsx            active-workspace-id context; persists to localStorage
    ProfileContext.jsx             single source of truth for the signed-in user's public.profiles row
                                   (avatar_path, display_name, future user-level metadata). Loaded once
                                   per user, exposed via useProfile() with { profile, loading, error,
                                   updateProfile, refresh }. Mirrors AuthProvider / WorkspaceProvider.
    profile.js                     CRUD for the public.profiles row: getProfile, setAvatarPath,
                                   clearAvatar (nulls column + best-effort storage delete), setDisplayName.
    workspaces.js                  CRUD for workspaces + listNodeTypes
    nodes.js                       CRUD for nodes + node_sections; shape-marshaling. Includes
                                   buildDeleteCardSnapshot + restoreCardWithDependents for undo's delete-card
                                   round-trip.
    connections.js                 CRUD for connections (edges)
    textNodes.js                   CRUD for text annotations; includes restoreTextNode for undo's delete-text
                                   round-trip.
    imageStorage.js                Storage helpers for both image domains. Card images: transcode → two
                                   WebP variants → upload to workspace-media. Profile avatars: single 256×256
                                   WebP variant → upload to profile-media. getImageUrl(path, variant,
                                   bucket) is bucket-aware. Two pipeline factories — cardImagePipeline()
                                   and profileAvatarPipeline() — bundle {upload, delete, getUrl} so
                                   UploadImageModal stays domain-agnostic.
    useImageUrl.js                 hook resolving avatar/media values to renderable URLs (handles base64,
                                   external https, and Storage paths). Signature: useImageUrl(input,
                                   {variant, bucket}); a string second arg is treated as {variant} for
                                   backward compat. Default bucket is 'workspace-media'.
    errorReporting.js              persistWrite() retry wrapper; on final failure, fires toastSaveFailed
                                   (chip-toast, no longer Sonner)
    feedbackToasts.jsx             public push API for undo / redo / conflict / save-fail chip toasts.
                                   Wraps useFeedbackToastStore so .js modules can fire toasts without JSX.
    CanvasOpsContext.jsx           context exposing App-level ops (onDeleteNode) to RF custom node
                                   renderers. Workaround for RF v11's `useReactFlow().setNodes` not
                                   propagating removals to App's `useNodesState`. See file header.
    analytics.js                   PostHog wiring (per ADR-0009). Module-scope state holds the loaded
                                   posthog instance after init. initAnalytics(profile) bails immediately
                                   when profile.is_test_user !== true, otherwise dynamic-imports
                                   posthog-js (its own Vite chunk) and calls posthog.init() +
                                   posthog.identify(profile.id). track(eventName, props) and
                                   resetAnalytics() both no-op when init never ran. All three public
                                   functions wrap their PostHog calls in try/catch so a misbehaving
                                   analytics call can't crash the host feature.

  lib/undo/                        Undo-system command-pattern dispatcher (per ADR-0006)
    index.js                       exports ACTION_TYPES, deepEqual, and the four dispatcher functions
                                   (canApplyInverse / canApplyForward / applyInverse / applyForward). Routes
                                   each entry to its per-type handler via a Map<type, handlers> lookup.
    _shared.js                     deepEqual + universals
    _cardHelpers.js, _connectionHelpers.js, _listItemHelpers.js, _textNodeHelpers.js
                                   family-specific helpers (drift checks, persist-call shapes)
    createCard.js, editCardField.js, moveCard.js, deleteCard.js,
    addConnection.js, removeConnection.js,
    addListItem.js, removeListItem.js, editListItem.js, reorderListItem.js,
    createTextNode.js, editTextNode.js, moveTextNode.js, deleteTextNode.js
                                   one file per action type, each exporting
                                   { canApplyInverse, canApplyForward, applyInverse, applyForward }

  hooks/                           reusable hooks extracted from App.jsx and the Inspector
    useSpacebarPan.js              spacebar-held-down panning state
    useWorkspaceData.js             load lifecycle for the active workspace (types + nodes + edges + text)
                                   AND Supabase Realtime subscriptions that mirror remote INSERT/UPDATE/DELETE
                                   into setNodes/setEdges. Calls useUndoStore.setScope() so undo rehydrates
                                   on F5 and re-scopes when the active workspace switches.
    useEdgeGeometry.js             recomputes spread border points + connection-dot positions when nodes move
    useNodeHoverSelection.js       returns the four ReactFlow hover/select handlers, all backed by useCanvasUiStore
    useAutoSave.js                 debounced save with explicit flush; used by the Inspector
    useMorphAnimation.js           modal-from-card morph in/out (useLayoutEffect setup, RAF animate-in,
                                   returned animateClose for exit); used by the Inspector. Also supports
                                   `skipOpenMorph` (quick opacity fade for a repoint, no grow-from-card)
                                   and `getCloseRect` (reads the node's CURRENT screen rect at close so the
                                   exit morph flies toward where the node is now, post-pan/reposition)
    useUndoShortcuts.js            global Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y listener with the Word-style typing
                                   exemption (Ctrl+Z inside an input/textarea/contenteditable is left to the
                                   browser; outside it reverses the last workspace action)

  nodes/
    CampaignNode.jsx               renders a node as a colored card; subscribes to useCanvasUiStore; adds .is-lifted
                                   class so :has() in index.css promotes the wrapper z-index
    TextNode.jsx                   freestanding text annotation blocks (persists directly via lib/textNodes)
    iconRegistry.js                70+ Phosphor icons with keywords; getIcon(), recommendIcons()

  edges/
    FloatingEdge.jsx               straight-line edge renderer; reads sourcePoint/targetPoint from edge.data

  components/
    Login.jsx                      email+password auth form
    CampaignPicker.jsx             post-login landing; list/create/rename/delete workspaces
    UserAvatar.jsx                 circular profile button with dropdown (sign-out, etc.)
    UserMenu.jsx                   top-left breadcrumb chip + UserAvatar overlay on the canvas; the
                                   breadcrumb home button uses HoverReveal to expand circle→pill on hover
    SearchBar.jsx                  top-right non-functional search placeholder (circle → pill on hover via
                                   HoverReveal). Search logic is NOT built yet. Exports `SEARCH_BAND_REM = 5`
                                   (the 80px top band the docked Inspector leaves clear)
    HoverReveal.jsx                shared circle→pill hover-morph wrapper (CSS grid 0fr↔1fr, 200ms,
                                   interruptible — reverses from the current frame). Used by SearchBar +
                                   the UserMenu breadcrumb
    Inspector.jsx                  the card-editing surface (formerly EditModal). Orchestration shell:
                                   form state + auto-save trigger + composes the section pieces below.
                                   Renders in two modes — undocked (draggable floating modal that morphs
                                   from the card) and docked (bottom-right overlay panel). Owns drag/dock/
                                   detach gestures, repoint commit, and directional close. See the
                                   "Inspector" section below + ADR-0015
    InspectorHeader.jsx            avatar + title + TypePicker + close/collapse button (the type-colored
                                   band). The band is the drag handle; title input is content-sized via
                                   CSS `field-sizing`. Docked close is a down-chevron (collapse), undocked
                                   is an X
    BulletSection.jsx              reusable section: DnD-reorder bullets + focus-on-new + add/remove.
                                   Used three times by the Inspector (Story Notes, Hidden Lore, DM Notes).
                                   Exports `newItem` for parents seeding initial state
    MediaSection.jsx               Inspiration grid: DnD-reorder image tiles + parallel-safe upload
                                   (uses a ref to track latest items so concurrent uploads don't clobber)
    ConnectionsSection.jsx         chip list + node picker with click-outside-to-dismiss
    TypePicker.jsx                 type dropdown (used inside InspectorHeader) + "Create new type…" row
    SectionLabel.jsx               tiny uppercase-tracked label utility used across sections
    ContextMenu.jsx                right-click menu on canvas card nodes (Edit/Duplicate/Delete)
    CanvasContextMenu.jsx          right-click menu on empty canvas (Add card / Add text). Submenu uses
                                   a 16px invisible hover-bridge + 200ms hover-intent close delay
    CreateTypeModal.jsx            custom card type creation (label + icon + color picker)
    Lightbox.jsx                   shared <LightboxProvider>; any consumer calls useLightbox().open(value)
    MigrateImages.jsx              one-shot tool at #migrate to backfill base64 → Storage; safe to delete
                                   once no workspace has any base64 image entries
    AnalyticsBootstrap.jsx         mounted inside <ProfileProvider> in main.jsx. Watches profile.id +
                                   profile.is_test_user; on change, calls initAnalytics(profile) (which
                                   itself bails for non-testers). Renders nothing.
    LockOverlay.jsx                modal that freezes edits on prolonged save failure
    SyncIndicator.jsx              ambient "Edited just now" / "Can't save" chip; positioned by FeedbackChipBar
    FeedbackChipBar.jsx            bottom-left feedback strip composing SyncIndicator + chip-toast slot;
                                   overflow:hidden mask makes the slot the slide-in surface
    FeedbackChip.jsx               pill-shaped toast body (dark gray-900 + white text + optional Phosphor icon)
    ChipToast.jsx                  single chip-toast w/ CSS @keyframes slide-in, opacity fadeout, hover-pause
    Inspector.test.jsx             tests pinning down Inspector behavior (open/populate, debounced
                                   auto-save, connection add/remove, Esc to close, avatar upload, per-item
                                   bullet undo, repoint commit, docked-mode close, directional close)

  store/
    useTypeStore.js                Zustand store for node types — in-memory cache hydrated from the `node_types`
                                   table on app load (via useWorkspaceData → listNodeTypes → hydrate). Built-in and
                                   custom types alike live as rows in `node_types` owned per user; CreateTypeModal
                                   writes new custom types straight to the DB. The legacy `dnd-node-types`
                                   localStorage key is actively cleaned up on store init for users who had it from
                                   the old persist-middleware build.
    useCanvasUiStore.js            Zustand store for transient canvas UI flags (anySelected, anyHovered,
                                   hoveredEdgeNodeIds). Cards subscribe via narrow selectors so a hover event
                                   only re-renders cards whose computed state actually changed.
    useSyncStore.js                Zustand store for write-success/failure tracking (drives SyncIndicator + LockOverlay)
    useUndoStore.js                Zustand store for the undo/redo stacks; per-tab, per-(user × workspace);
                                   sessionStorage-backed under `mastermind:undo:${userId}:${workspaceId}`;
                                   capped at 75. clearAllForUser() called on sign-out wipes every entry under
                                   the user's prefix.
    useFeedbackToastStore.js       Zustand store for the chip-toast queue: lifecycle (visible → exiting →
                                   removed), pause/resume per toast, sticky-id replace for persist-fail.

  utils/
    labelUtils.js                  sortKey(), labelInitial()
    edgeRouting.js                 getNodeCenter(), getBorderIntersection(), getSpreadBorderPoints()

supabase/
  schema.sql                       full DB schema + RLS policies — run once in the Supabase SQL Editor
  migrations/
    001_node_types_per_user.sql    moves node_types from per-workspace to per-user ownership
    002_card_media_bucket.sql      creates the workspace-media Storage bucket + SECURITY DEFINER RLS helper
    003_profiles_and_profile_media.sql
                                   creates the public.profiles table (avatar_path + display_name +
                                   timestamps), the on_auth_user_created trigger that auto-creates a
                                   profile row per new sign-up, the profile-media Storage bucket, and
                                   same-schema RLS policies pinning every object to its owner's
                                   auth.uid() prefix

public/
  avatars/                         static avatar images for the sample Strahd data

docs/
  product/                         vision, roadmap, tenets, glossary (source of truth for product narrative)
  design/                          design-system.md (interaction patterns, visual grammar)
  decisions/                       ADRs covering architecture calls (Supabase, modular sections, image storage, etc.)
  strategy/                        competitive analysis, plain-English summary, founder notes (context, not authoritative)
    archive/                       superseded strategy docs (banner-marked)
```

---

## Data Model

### Supabase schema (summary)

| Table | Purpose |
|---|---|
| `auth.users` | Supabase-managed; referenced by `workspaces.owner_id` and `profiles.id` |
| `profiles` | one row per user — canonical home for app-level user metadata (`avatar_path`, `display_name`, `is_test_user`, future fields). Auto-created by an `auth.users` INSERT trigger; backfilled in migration 003. `is_test_user` added in migration 004; default flipped to `true` in migration 005 for the invite-only stage (revert before public launch). Gates whether PostHog loads for that user (ADR-0009) |
| `workspaces` | one row per workspace; owned by a user |
| `node_types` | card types per user (built-in five + any custom); `is_system` flags the built-ins. Per-user scope was introduced in migration 001 — every workspace a user owns shares the same set of types. |
| `nodes` | cards on the canvas (label, summary, avatar_url, position, type_id) |
| `node_sections` | modular sections inside each card: `kind` ∈ `narrative` \| `hidden_lore` \| `dm_notes` \| `media` \| `custom`; `content` is JSONB |
| `connections` | edges between two nodes in the same workspace |
| `text_nodes` | free-floating text annotations on the canvas |

Full DDL in `supabase/schema.sql`. Every table has RLS enabled; policies require that the row's workspace belongs to the current `auth.uid()`.

### React shape (what handlers work with)

The data layer marshals DB rows back to the flatter React shape the canvas expects. See `src/lib/nodes.js`.

```js
// Canvas node, in the React/React Flow shape (representation-level — note CampaignNode.jsx file name and the 'campaignNode' RF type id are retained for now per ADR-0012)
{
  id: string,
  type: 'campaignNode',
  position: { x: number, y: number },
  data: {
    id: string,                     // duplicated for convenience
    label: string,
    type: 'character' | 'location' | 'item' | 'faction' | 'story' | string,
    avatar: string | null,          // Supabase Storage path (e.g. "<workspaceId>/<cardId>/avatar-…full.webp"),
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

`#0284C7` (Tailwind `sky-600`) for all card-type-agnostic action buttons (login, "Create" in CreateTypeModal, "New workspace" in CampaignPicker). **Never reuse a card-type color for system UI.**

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

Used in: Inspector header, type selector chips, connection chips, CampaignNode header, UserAvatar.

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

- `src/main.jsx` wraps the app in `AuthProvider` → `WorkspaceProvider` → `ProfileProvider` → `Root`.
- `Root` gatekeeper: loading → null; not signed in → `<Login />`; signed in with no active workspace → `<CampaignPicker />` (file name retained per ADR-0012 — the picker is the user-facing surface, "Workspace" is the architectural name); signed in with active workspace → `<App /> + <UserMenu />`.
- Active workspace id is persisted in localStorage (`mastermind:activeWorkspaceId`) so refresh returns to the same workspace.

### Workspace creation

`createWorkspace(name, description)` in `lib/workspaces.js` inserts the workspace row. Built-in node types are seeded **per user** (not per workspace) — `ensureBuiltinTypes()` runs from `useWorkspaceData` on app load and is idempotent, so this function does not seed types itself.

### Hooks layer (`src/hooks/`)

`App.jsx` was 700+ lines after Sprint 1; the post-Sprint-1 refactor pulled four focused hooks out of it. They were extracted so Sprint 1.5 Realtime work had clean places to land instead of more sediment in App.jsx:

- `useSpacebarPan()` — keyboard listeners; returns the `isPanning` boolean.
- `useWorkspaceData({ workspaceId, setNodes, setEdges })` — owns the load lifecycle (types + nodes + connections + text) AND the Supabase Realtime subscriptions. Returns `{ loading, loadError }`.
- `useEdgeGeometry({ nodes, edges, setNodes, setEdges })` — recomputes spread border points + connection-dot positions on node movement. Pure derivation; mutates state via the supplied setters.
- `useNodeHoverSelection({ setEdges })` — returns the four ReactFlow handlers (`onSelectionChange`, `onNodeMouseEnter`, `onNodeMouseLeave`, `onEdgeMouseEnter`, `onEdgeMouseLeave`). All five mutate `useCanvasUiStore`; only `onEdgeMouseEnter`/`onEdgeMouseLeave` also touch the edges array (for stroke styling).

### Realtime sync (Sprint 1.5)

`useWorkspaceData` opens one Supabase channel per active workspace with four `postgres_changes` listeners — one each for `nodes`, `node_sections`, `connections`, and `text_nodes`. Incoming events are translated back into the React/React Flow shape via the existing marshalers (`dbNodeToReactFlow`, `dbTextNodeToReactFlow`) and merged into `setNodes` / `setEdges`. The channel is torn down when the workspace id changes or the hook unmounts.

- **DB-side filter:** `workspace_id=eq.${workspaceId}` on three tables. `node_sections` has no `workspace_id` column, so it's filtered client-side by checking whether `node_id` is in local state; RLS already restricts to the user's own rows.
- **Required SQL (run once per project):** TWO setup steps — (a) the four tables must be members of the `supabase_realtime` publication; (b) the four tables must be set to `REPLICA IDENTITY FULL` so DELETE broadcasts include all columns. Without (b), the `workspace_id=eq.X` filter rejects DELETE events because the broadcast `old` row only carries the primary key. See both SQL blocks in the Sprint 1.5 + Sprint 1.5b entries of `CHANGELOG.md`. **Apply this `REPLICA IDENTITY FULL` pattern to any future table whose Realtime DELETE events need to pass an RLS or column-filter check.**
- **No echo filter (V1).** Self-writes round-trip through the channel and re-set identical values. If two tabs simultaneously edit the same field, the last write wins and a character may be dropped — accepted trade-off, revisit only if it becomes noticeable in practice.
- **UI-only state preservation:** the `text_nodes` UPDATE handler preserves `data.editing` so a remote update can't kick the local tab out of edit mode mid-keystroke. The `nodes` UPDATE handler preserves the in-memory `storyNotes/hiddenLore/dmNotes/media` arrays (those flow through `node_sections` events instead).

### Canvas UI store (`useCanvasUiStore`)

`anySelected`, `anyHovered`, and `hoveredEdgeNodeIds` are NOT per-node `data` fields — they're a Zustand store that every card subscribes to. The previous approach (`setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, anyHovered: true } })))`) rewrote every node on every hover and forced React Flow to re-render every card; tolerable at 10 cards, unusable at 500. With the store, a hover event mutates one atomic value and only cards whose computed value flips re-render. Use the `selectIsEdgeHighlighted(nodeId)` helper exported from the store for the per-card edge-highlight subscription.

### Image storage (per ADR-0005, renamed in ADR-0012)

> **Active bucket: `workspace-media`.** This is the single active storage location for application media assets (card avatars + inspiration images + future container-scoped assets like workspace thumbnails / background images). All consumer code must import the bucket name via `BUCKET_WORKSPACE` from [`src/lib/imageStorage.js`](src/lib/imageStorage.js) rather than hardcoding the string — hardcoded literals caused the post-rename image-render regression on 2026-05-18.
>
> **Deprecated bucket: `card-media`.** Retained only as a temporary rollback artifact from the 2026-05-18 campaign → workspace rename. **No new code should read from or write to `card-media`.** Its policies were dropped in migration 007; clients can't access it. Scheduled for permanent deletion after 1–2 weeks of stable usage of the new bucket (see BACKLOG: "Drop deprecated card-media bucket + helper function").

Card avatars and inspiration images live in the **`workspace-media` Supabase Storage bucket**, not as base64 inside the database. Two variants per upload (`.thumb.webp` 256px / 40% q, `.full.webp` 1920px / 80% q), generated client-side via Canvas at upload time. The DB stores only the path string (avatars) or `{path, alt, uploaded_at}` object (inspiration entries) — see the React shape above.

- `src/lib/imageStorage.js` owns transcode + upload + delete. Exports `BUCKET_WORKSPACE` and `BUCKET_PROFILE` as the single source of truth for bucket names.
- `src/lib/useImageUrl.js` is the hook every renderer uses; it accepts a value of any shape and returns either a signed URL, a base64 string passthrough, or null. Defaults to `BUCKET_WORKSPACE`.
- `src/components/Lightbox.jsx` is the single shared lightbox (provider + hook); CampaignNode and the Inspector both call `useLightbox().open(value)`.
- **Bucket RLS uses a SECURITY DEFINER helper** (`public.user_owns_workspace_media_path`) instead of inlining the workspace-ownership lookup inside each policy. The inlined version silently fails — the cross-schema query from `storage.objects` to `public.workspaces` returns no rows even when the user owns the workspace, and every upload errors with "new row violates row-level security policy". The helper bypasses RLS on `public.workspaces` while still pinning the check to `auth.uid()`. See [supabase/migrations/002_card_media_bucket.sql](./supabase/migrations/002_card_media_bucket.sql) (original) and [supabase/migrations/007_rename_card_media_bucket.sql](./supabase/migrations/007_rename_card_media_bucket.sql) (renamed in place). **Apply this pattern to any future Storage bucket that needs cross-schema ownership checks.**
- `#migrate` is a temporary hash route to the migration tool ([src/components/MigrateImages.jsx](src/components/MigrateImages.jsx)) for backfilling any base64 entries; once a workspace has zero base64 entries the page reports "Nothing to migrate" and the route can be removed.

### Profile avatars (per migration 003)

User profile avatars live in a **separate `profile-media` Supabase Storage bucket**, distinct from `workspace-media`. Why separate: profile photos are user-scoped (path: `{user_id}/avatar-{timestamp_ms}.webp`), not workspace-scoped, so the access rules differ. Single 256×256 WebP variant — profile avatars never render larger than ~64px in real UI.

- `public.profiles` is the canonical home for app-level user metadata. One row per `auth.users` row, linked 1:1 by `id`. Currently holds `avatar_path`, `display_name` (the latter has no UI yet — schema-ready for future surfaces), and `is_test_user` (added in migration 004; default flipped from false to true in migration 005 — appropriate for the invite-only stage, revert before public launch; gates PostHog loading per ADR-0009). Auto-created by an `on_auth_user_created` trigger so app code can assume every signed-in user has a profile row; backfilled in migration 003 for users that pre-date the trigger.
- `src/lib/profile.js` is the data-access layer: `getProfile`, `setAvatarPath`, `clearAvatar`, `setDisplayName`. `clearAvatar` updates the DB column first, then best-effort deletes the storage object — the user-visible state is correct even if the storage delete fails (orphan-cleanup per ADR-0005 §7).
- `src/lib/ProfileContext.jsx` is the shared store. One `getProfile()` per signed-in user, exposed via `useProfile() → { profile, loading, error, updateProfile, refresh }`. Profile.jsx and UserAvatar.jsx both subscribe so an avatar change on the Profile page propagates to the top-left chip immediately, without a reload.
- **The `profile-media` bucket does NOT need a SECURITY DEFINER helper** because its RLS check is same-schema: `(storage.foldername(name))[1] = auth.uid()::text`. The cross-schema gymnastics that `workspace-media` needs only kick in when storage policies have to JOIN against tables in `public`. Profile-bucket policies live entirely against the path prefix and `auth.uid()` — pure storage, no cross-schema lookups.
- The same `UploadImageModal` handles both card images and profile avatars. Domain switching is via the `pipeline` prop — built by `cardImagePipeline({...})` or `profileAvatarPipeline({...})` from `imageStorage.js`. The modal does not know what kind of image it is editing. New image domains in the future drop in by adding a third factory.
- `ImageCropper` adds a `profile-avatar` mode alongside the existing `image-section` and `thumbnail` modes. Behavior is identical to thumbnail (image-corner handles, no frame reshape, cover-fit on entry, fixed-pixel save) but with a 256×256 square frame and 256×256 saved output.

### Behavioral analytics (per ADR-0009, migration 004)

Session replay + named events via PostHog Cloud, restricted to invited testers. The whole subsystem revolves around the `is_test_user` boolean on `public.profiles` — false for everyone by default.

- [`src/lib/analytics.js`](./src/lib/analytics.js) owns all PostHog interaction. Three safety guards keep non-tester users completely insulated:
  - **Conditional load.** `posthog-js` is fetched via dynamic `import()`. Vite splits it into its own chunk (~64 KB gzipped) that non-testers never request. The check is `profile?.is_test_user !== true` and runs *before* the import. **Build-time invariant:** `VITE_POSTHOG_KEY` must be set during `vite build` — see the Environment Variables section for why.
  - **Try/catch on every public function.** A misbehaving PostHog call cannot bubble up into the feature code that fired it. Errors log a one-line warning to the dev console and otherwise vanish.
  - **Early bail.** `track()` and `resetAnalytics()` return immediately if init never ran. No event queue, no memory accumulation for non-testers.
- [`src/components/AnalyticsBootstrap.jsx`](./src/components/AnalyticsBootstrap.jsx) is mounted inside `<ProfileProvider>` in `main.jsx`. It uses `useProfile()` to watch the profile, then `useEffect` fires `initAnalytics(profile)` on profile load. `initAnalytics` is itself idempotent — bails if already started.
- `AuthContext.signOut` calls `resetAnalytics()` alongside the existing undo-store cleanup, so a different user signing in on the same browser cannot inherit the previous tester's PostHog session/identity.
- **Password protection** is layered, not selector-based:
  - The login screen renders *before* the profile loads, which is *before* `initAnalytics` can run. The form is therefore never captured.
  - PostHog's default `maskInputOptions.password = true` auto-masks `<input type="password">` in replays.
  - `<PasswordInput>` toggles `type=password` ↔ `type=text` when the user clicks the eye to show their password. The input carries the `.ph-mask` class, which the `maskInputFn` and `maskTextFn` config options in `analytics.js` honor regardless of input type — the value stays masked even when visible.
  - `resetAnalytics()` on sign-out closes the session, so any subsequent sign-in screen rendered in the same browser isn't captured either.
- Named events (~16) are wired at action sites. App.jsx owns most; `ConnectionsSection`, `TypePicker`, and `useUndoShortcuts` own the rest. Three events use windowing/timer logic rather than raw streams: `zoom_changed` + `pan_burst` share `onMoveEnd` (one call per discrete gesture, so no debounce needed), and `card_repositioned_quickly` checks a `Map<cardId, createdAtMs>` populated by `addCardNode` and self-cleaning after 10 s. Threshold constants live at the top of `App.jsx` for easy tuning after the first observation cycle.
- **No content masking.** Per the ADR revision, everything a tester does in the canvas is captured, including the actual content they type. The research questions are about *how DMs build campaigns*, so the words they choose are themselves signal.

### Z-index lift (CampaignNode + index.css)

When a card is hovered, selected, or part of a hovered edge, it adds `.is-lifted` to its inner div. `index.css` uses `:has(.is-lifted)` to bump the React Flow wrapper's `z-index`, so neighboring cards don't visually cut through the lifted one. `:has()` requires modern Chromium / Safari / Firefox.

### Altitude rail (per ADR-0010 addendum, 2026-05-15)

The left-edge altitude rail ([`src/components/AltitudeRail.jsx`](./src/components/AltitudeRail.jsx)) is the first concrete altitude visualization shipped under the "altitude view among many" architecture. It reads navigation state from `useCanvasUiStore` + altitude.js, and writes back exactly one value — `thresholdGridGapMm` — when the user drags the thumb. It never reaches into the morph machinery.

**Two visual states, driven by mouse position over the rail's container plus drag-in-progress.** Rest: narrow track tucked toward the canvas edge, icons / thumb / label hidden, current-zoom marker simplified to bar + right chevron at half stroke. Active: track widens, icons fade in, thumb appears, label fades in, current-zoom marker becomes the full chevron-bar-chevron at full stroke. The transition is a 220 ms CSS animation on every property (width, position, opacity, stroke width, gradient width).

**Threshold drag.** The thumb is pointer-captured. Its TOP edge tracks the down-trigger zoom (Card→Bead boundary); its BOTTOM edge tracks the up-trigger zoom (= down-trigger × `MORPH_HYSTERESIS_RATIO`). Dragging writes a new `thresholdGridGapMm` to the store. [App.jsx subscribes to that value via `useCanvasUiStore.subscribe(...)`](./src/App.jsx) and re-runs the shared `evaluateAltitude` helper the zoom-driven trigger uses — so a drag that crosses the user's current zoom morphs the canvas in real time, not on the next pan or zoom.

**Highlight semantics differ between states by design.**
- *Active:* highlight top sits at the down-trigger position (= thumb top) and extends UP behind the thumb in BOTH altitudes. Square top corners; the thumb tucks over them. The highlight here reads as "Card View region defined by the current threshold" — the indicator's position vs the thumb tells the user which side they're on.
- *Rest:* no thumb, so the highlight has to reflect the actual altitude on its own. Top edge tracks `altitude`: down-trigger position in Card View (highlight covers the dead-band), up-trigger position in Bead View (highlight is below the indicator). Fully rounded corners.

When the user hovers in/out while in Bead View, the highlight top animates by one dead-band's worth — the visible price of one element representing two different things cleanly.

**Bbox stability for the threshold marker.** `computeMinZoom` uses canonical card dimensions (256 × 180) for every card-type node regardless of what RF currently measures, so a morph between card and bead form doesn't shrink the bounding box (which would otherwise move `dynamicMinZoom`, which would otherwise scoot the threshold thumb up and down the rail every time the user crossed the boundary). Text nodes keep their measured dimensions since they're user-resizable and don't morph.

**Pointer-events trade-off.** The 64 px rail container is `pointer-events: auto` so it captures mouse-enter / mouse-leave reliably without making the user aim for a 4 px line. Cost: marquee-select can't be initiated from the leftmost 64 px of the canvas. Acceptable for an edge-mounted nav tool; the rail slides out of the way on mouse-leave so the expectation of marquee-select is reasonably managed.

**Scrim color.** The dark backdrop behind the rail uses RGB (3, 9, 8) at scaled alpha, not pure black. The canvas BG is `#031a15` (with vignette darkening edges to ~`#061210`) — pure black composites toward neutral gray over that green-tinted dark, which reads as a foreign panel. The hue-matched tint darkens-in-hue and blends as a deepening of the canvas color.

### How connections work

`App.jsx` orchestrates edge state via the hooks above. It does NOT use React Flow handles. Instead:

- `getSpreadBorderPoints()` computes where dots appear on each card border
- `getBorderIntersection()` computes the edge endpoints
- Edges carry `data.sourcePoint` / `data.targetPoint` (screen-space `{x, y}`) which `FloatingEdge` reads directly
- `syncedNodeIds` ref in the Inspector tracks which connections have been created as RF edges, preventing duplicates

### Inspector — the card-editing surface (float-or-dock, per ADR-0015)

The Inspector (component file `Inspector.jsx`; formerly `EditModal.jsx` — renamed
2026-05-30) is the surface for editing one card. It opens in one of two modes and
the user can move between them at will:

- **Undocked** — a draggable floating modal that morphs in from the clicked card
  (grow-from-card). The whole type-colored header band is the drag handle. Drag the
  right edge within `DOCK_SNAP_PX` (96px) of the viewport edge to arm docking;
  release to dock.
- **Docked** — a fixed-width overlay panel pinned bottom-right (`DOCKED_WIDTH` 30rem,
  `DOCKED_RIGHT` 1rem margin, flush to the bottom, top at the `SEARCH_BAND_REM` 80px
  search band). Rises in from the bottom via CSS `@keyframes`. Drag the header
  `DETACH_PX` (24px) to detach back to a floating modal — the gesture is continuous
  (window listeners persist across the mode flip; the modal repositions under the
  cursor).

**Key behaviors:**
- **Repoint.** While the Inspector is open, a single plain click on another card
  swaps its contents to that card in place (position preserved, quick opacity fade
  via `skipOpenMorph` rather than a re-morph). Outgoing edits are committed first
  (flush save + undo) via `commitSession`, exposed to App through `commitApiRef` and
  guarded by `committedRef` for idempotency. Content is keyed by `topicNodeId` so
  React remounts cleanly on swap. Multi-select gestures (shift/ctrl/cmd-click,
  marquee) do NOT repoint.
- **Open vs select.** When the Inspector is closed, a single click just selects the
  card; double-click opens it. When open, single-click repoints (above).
- **Close is control-only.** Clicking the canvas does NOT close the Inspector — there
  is no backdrop/scrim. Close via the header control (an X when undocked; a
  down-chevron "collapse to edge" when docked) or Esc. Deleting the card whose
  contents are shown also closes it.
- **Directional close.** The close morph reads the node's CURRENT screen rect
  (`getCloseRect` → `useMorphAnimation`) so the modal flies toward where the node is
  now, even after panning or repositioning — not where it was when opened.
- **Mode memory.** The chosen mode persists to localStorage (`mastermind:inspector-mode`,
  via `readInspectorMode`/`writeInspectorMode` in App.jsx). Mode only — an undocked
  Inspector always recenters on open.
- **Inspector-instance state** lives in App as `inspectorNode`
  `{ topicNodeId, node, position, mode, isRepoint, ... }`, with `topicNodeId`
  independent of canvas selection so a future multi-inspector world is an array of
  these rather than a rewrite.

It remains an orchestration shell: form state (title, type, summary, bullet sections,
media, thumbnail, localConns) lives in the Inspector because one `useAutoSave` call
reads from all of them. Sub-components are controlled (take `value` + `setter` props):

| Piece | Owns | Receives from the Inspector |
|---|---|---|
| `<InspectorHeader>` | uploading-avatar state, file-picker ref, `titleRef` (focus on mount), `onPointerDown` drag handle | title/setTitle, type/setType, typeConfig, hdrText, TypeIcon, thumbnail/setThumbnail, workspaceId, docked, onClose, onCreateNewType |
| `<BulletSection>` | DnD context, sensors, refs for focus-on-new, add/remove/update logic | items, onChange, label, placeholder, dotColor, addLabel |
| `<MediaSection>` | DnD context, file-picker ref, `uploadingCount`, `currentItemsRef` (parallel-upload safety) | items, onChange, cardId, workspaceId, slug |
| `<ConnectionsSection>` | picker open/close, click-outside dismissal, available-nodes filtering + sort | localConns, setLocalConns, allOtherNodes |
| `<TypePicker>` | dropdown open/close, hover state | type, setType, hdrText, onCreateNewType |
| `useAutoSave` | doSaveRef pattern, debounce timer | doSave callback, deps array, optional delay |
| `useMorphAnimation` | useLayoutEffect setup, RAF animate-in, animateClose, skipOpenMorph, getCloseRect | modalRef, backdropRef, originRect, skipOpenMorph, getCloseRect, onClose |

`Inspector.test.jsx` pins behavior down across both modes (open/populate, auto-save,
connections, close, avatar upload, per-item bullet undo, repoint commit, docked close,
directional close). Run with `npm test`.

### How auto-save works (Inspector)

- `useAutoSave({ doSave, deps, delay })` debounces a save 400ms after any dep changes
- The hook stores `doSave` in a ref so the timer always calls the latest closure (with the latest state)
- Returns `flushSave()` for synchronous saves on close (Esc / close control) and on repoint (before the topic node swaps)
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
2. Add to `BUILT_IN_TYPES` in `src/lib/workspaces.js` so it gets seeded on first sign-in for any user that doesn't already have it (via `ensureBuiltinTypes`)
3. Add the Phosphor icon name to `iconRegistry.js` if not already there

Custom user-created types are persisted per-user as rows in the `node_types` table. `CreateTypeModal` calls `createCustomType()` (in `lib/workspaces.js`) which inserts the row, then appends to the in-memory `useTypeStore` cache via `addType()`.

---

## What Is Built

- [x] Supabase auth (email+password), login screen, sign-out, avatar dropdown
- [x] Workspace CRUD (create, list, rename, delete, switch)
- [x] RLS policies on every table
- [x] 5 built-in node types seeded per user on first sign-in
- [x] Canvas cards with header, avatar, summary, bullet body, connection dots
- [x] Inspector (card editor): title, type, avatar/thumbnail, summary, story notes, hidden lore, DM notes, media, connections
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
- [x] **Image storage** in Supabase Storage with thumb + full WebP variants; client-side transcode at upload; signed-URL rendering. The Inspector's avatar + inspiration uploads write straight to Storage.
- [x] **Shared lightbox** — clicking a card avatar (canvas or modal) or any inspiration tile opens the same overlay.
- [x] **App.jsx refactor** — load lifecycle, edge geometry, hover/select, and spacebar pan all extracted into focused hooks under `src/hooks/`. Hover/select state moved into `useCanvasUiStore` so a hover event no longer re-renders every card.
- [x] Z-index lift — hovered/selected cards rise above their neighbors via a `:has(.is-lifted)` rule.
- [x] **Realtime sync** — Supabase Realtime channel in `useWorkspaceData` mirrors remote `nodes` / `node_sections` / `connections` / `text_nodes` INSERT/UPDATE/DELETE into local state. No echo filter in V1; self-writes round-trip harmlessly. Requires `REPLICA IDENTITY FULL` on each table for DELETE events to pass RLS + filter checks.
- [x] **Inspector decomposition** — the card editor is an orchestration shell composing `<InspectorHeader>`, `<BulletSection>` (×3), `<MediaSection>`, `<ConnectionsSection>`, `<TypePicker>` + `useAutoSave` and `useMorphAnimation` hooks.
- [x] **Float-or-dock Inspector** — the card editor (renamed from EditModal → Inspector, 2026-05-30) opens as a draggable floating modal or a docked bottom-right panel; single-click repoints it to another card, the header drag-detaches between modes, mode persists to localStorage, and the close morph flies toward the node's live position. Non-functional top-right search placeholder reserves the 80px band the docked panel respects. Node-selection dimming softened 0.15→0.45. See [ADR-0015](./docs/decisions/0015-float-or-dock-inspector.md).
- [x] **Component tests** — Vitest + React Testing Library + jsdom; `Inspector.test.jsx` covers open/populate, auto-save, connections, close, avatar upload, per-item bullet undo, repoint commit, docked close, and directional close. Run with `npm test`.
- [x] **Undo / redo** — Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y reverses recent workspace actions. Per-tab, per-(user × workspace), capped at 75. Conflict-aware in both directions (refuses + toasts when state has drifted from another tab's Realtime updates). 14 action types covered; sessionStorage-backed for F5 protection. Word-style typing exemption: `Ctrl+Z` inside an input/textarea/contenteditable is left to the browser. See [ADR-0006](./docs/decisions/0006-undo-redo.md).
- [x] **Bottom-left feedback strip** — `FeedbackChipBar` composes the existing `SyncIndicator` (light, ambient "Edited Nm ago") with a chip-toast slot (dark, transient action feedback). Toasts slide in from behind the chip via CSS @keyframes (no JS state ping-pong, no entry delay), masked by an `overflow:hidden` container so no toast pixels are visible left of the chip's left edge. Undo/redo toasts lead with a Phosphor curved-arrow icon (`ArrowUUpLeft` / `ArrowUUpRight`) followed by the entry's label. 2s visible, 300ms fadeout, hover pauses both phases (including freezing the visual opacity transition mid-fadeout). Replaces Sonner for these toasts; persist-fail uses the same chip family with a sticky id.
- [x] **Sign-out cleanup** — `AuthContext.signOut` calls `useUndoStore.clearAllForUser(userId)` before Supabase clears the session, wiping the in-memory undo stack AND every `mastermind:undo:${userId}:*` sessionStorage entry across any workspaces the user touched in this tab.
- [x] **Profile avatars** — Profile page lets the user upload, replace, and remove a profile photo (1:1 crop, 256×256 WebP, stored in the new `profile-media` Supabase Storage bucket). `public.profiles` row holds `avatar_path` + `display_name` (latter has no UI yet). Auto-create trigger on `auth.users` INSERT so every sign-up gets a profile row. Shared `ProfileContext` so the top-left UserAvatar chip updates immediately when the photo changes — same source of truth as the Profile page header. Cropper gains a `profile-avatar` mode (square frame, 256×256 output); UploadImageModal becomes pipeline-agnostic via `cardImagePipeline()` / `profileAvatarPipeline()` factories so the same UI shell handles both image domains. See migration 003.
- [x] **Behavioral analytics + session replay** — PostHog Cloud wired (per ADR-0009). Loads only when `profile.is_test_user === true` via dynamic import (separate Vite chunk; non-testers download zero bytes of `posthog-js`). 16 named events fire at action sites across `App.jsx`, `ConnectionsSection`, `TypePicker`, and `useUndoShortcuts`. `AuthContext.signOut` resets the session so it doesn't bleed across users on the same browser. Three safety guards (conditional load, try/catch on every public call, early bail) ensure non-testers see zero behavioral or performance impact. Password fields are protected by a `.ph-mask` class + PostHog's default `type=password` masking + the fact that the login screen renders pre-init. Migration 004 adds the `is_test_user` boolean column.
- [x] **Altitude rail** — Left-edge instrument that reads navigation state (current zoom, threshold, dynamic minZoom, altitude) and writes back exactly one value (`thresholdGridGapMm`). Two visual states: ambient line at rest, expanded controls (icons + draggable thumb + label + bar-chevron marker) on hover. The thumb's vertical extent IS the hysteresis dead-band; dragging it retunes the Card↔Bead threshold and morphs the canvas in real time (App.jsx subscribes to `thresholdGridGapMm` and re-runs the shared `evaluateAltitude` helper). Highlight semantics differ by state — active reads as "threshold structure," rest reads as "current altitude" — so the rail never lies about which side of the dead-band the user is on. Hue-matched dark scrim behind the UI scales wider when active. See [ADR-0010 addendum (2026-05-15)](./docs/decisions/0010-zoom-progressive-disclosure.md).

## What Is NOT Built (roadmap)

See [`BACKLOG.md`](./BACKLOG.md) for the current backlog. It's organized by
**Value Add** band (Quick Win, Foundational Progress, Strategic Bet,
Exploration — see [`docs/product/glossary.md`](./docs/product/glossary.md)),
reviewed at the start of each sprint, and each item carries a problem
statement, success criteria, and dependencies. Version-level scope (V1,
V2+, V3+, out) lives in [`docs/product/roadmap.md`](./docs/product/roadmap.md).
The numbered Sprint 2 / 3 / 4 / 5 roadmap that previously lived here is
retired — sequential sprint plans don't survive contact with reality once
the backlog grows past a handful of items with real dependencies. Deferred
work (AI features, wiki view, player view, pro-DM ops, integrations,
native mobile apps) is captured in `roadmap.md` with rationale.

## Cut from V1

- Lock / unlock cards (feature scoped out; `locked` state remains in-memory only)
- Duplicate-with-connections (plain duplicate is sufficient)

---

## Cut Scope Notes

**"Locked" state is in-memory only.** The Supabase schema has no `locked` column on `nodes`. If we reinstate the lock feature later, add a column and a migration. Until then, do not persist `data.locked`.

**Legacy base64 image entries are read-only.** `useImageUrl` still resolves base64 data URIs (so any old data renders), but the Inspector no longer writes new base64 — uploads go to Storage. Once every workspace has zero base64 entries, the legacy branch in `useImageUrl` and the `MigrateImages` component can both be deleted in the same PR.

---

## Relationship to `docs/design/design-system.md`

As of the Sprint 1 hygiene pass, the design system doc was updated to reflect current reality (Phosphor icons, Supabase backend, sections that are now built, lock feature cut, etc.). The 2026-05-05 doc reorganization renamed `design-document.md` → [`docs/design/design-system.md`](./docs/design/design-system.md).

Going forward:

- When a new divergence between design intent and implementation arises, **prefer updating the design system doc** to keep the two in sync.
- When the divergence is a deliberate design decision worth preserving with context, write an ADR in [`docs/decisions/`](./docs/decisions/) and link to it from both files.
- If a divergence is a tactical hack that'll be revisited, note it in this file under a "Known Divergences" table and document it precisely.

### Known Divergences

| Area | Current reality | Design state | Why logged |
|---|---|---|---|
| Canvas card component & RF type id | File: `src/nodes/CampaignNode.jsx`; React Flow type identifier: `'campaignNode'` | The architectural object was renamed `campaign` → `workspace` in ADR-0012; these are the file/component-level holdouts. | Representation-level names (the component that renders a node *as a card in the canvas*) deliberately kept per ADR-0012's entity-vs-representation principle. Cosmetic; safe to rename in a separate pass when the canvas card UI itself gets a redesign. |
| Picker component | File: `src/components/CampaignPicker.jsx` | Same as above. | File name retained because the picker is a user-facing surface still labeled as targeting the D&D campaign audience in V1. When product positioning broadens, the file name follows. |

When code drifts from design intent in a way that can't be cleanly resolved in the same pass, add a row here documenting: the area, the current reality, the design-doc state, and why it's logged. Then update [`docs/design/design-system.md`](./docs/design/design-system.md) or write an ADR to close the gap when convenient.

When code drifts from design intent in a way that can't be cleanly resolved in the same pass, add a row here documenting: the area, the current reality, the design-doc state, and why it's logged. Then update [`docs/design/design-system.md`](./docs/design/design-system.md) or write an ADR to close the gap when convenient.
