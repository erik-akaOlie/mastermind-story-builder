# Changelog

A running log of meaningful changes to MasterMind: Story Builder. Append-only. Newest at top.

## [Unreleased]

### Sprint 2 — Undo / redo + chip-style feedback toasts (2026-05-04)

Closes [ADR-0006](./docs/decisions/0006-undo-redo.md). Recovery from
accidental deletes / edits is now a Ctrl+Z away; a small bottom-left
"feedback strip" reports each undo and redo as a chip-style toast that
slides in from behind the SyncIndicator chip. Foundation for the
Sprint 5+ AI co-pilot (which will write into cards) to feel safe to
try, since bad output is reversible.

**Added**
- 14 action types covering everything destructive or modifying:
  `createCard`, `editCardField`, `moveCard`, `deleteCard`,
  `addConnection`, `removeConnection`, `addListItem`, `removeListItem`,
  `editListItem`, `reorderListItem`, `createTextNode`, `editTextNode`,
  `moveTextNode`, `deleteTextNode`. Each carries a DB-shape snapshot of
  what changed and how to reverse it; the dispatcher reads the top of
  the stack on Ctrl+Z and runs the inverse via the same `lib/*.js`
  write path that normal edits use.
- [`src/store/useUndoStore.js`](./src/store/useUndoStore.js) — per-tab,
  per-(user × campaign) past + future stacks capped at 75 entries.
  sessionStorage-backed so F5 mid-session preserves history; closing
  the tab clears it.
- [`src/lib/undo/`](./src/lib/undo/) — dispatcher + 14 per-type modules
  + 4 family helper files (card / connection / list-item / text-node)
  + a `_shared.js` for universal helpers like `deepEqual`. Each per-
  type module exports
  `{ canApplyInverse, canApplyForward, applyInverse, applyForward }`
  so the dispatcher is a thin `Map<type, handlers>` lookup.
- Conflict-aware in both directions. Both `undo` and `redo` validate
  current state matches what the entry expects (drift detection from
  e.g. another tab's Realtime updates) before applying. On mismatch:
  refuse, pop the orphan entry, fire a "Couldn't undo — this changed
  elsewhere" toast.
- Word-style typing exemption: while focused inside an
  input / textarea / contenteditable, `Ctrl+Z` is left to the browser
  (keystroke-level undo). Outside of those, `Ctrl+Z` reverses the last
  campaign action. `Ctrl+Shift+Z` and `Ctrl+Y` both work for redo.
- [`src/hooks/useUndoShortcuts.js`](./src/hooks/useUndoShortcuts.js)
  — keyboard listener with the typing exemption above.
- [`src/components/FeedbackChip.jsx`](./src/components/FeedbackChip.jsx),
  [`src/components/ChipToast.jsx`](./src/components/ChipToast.jsx),
  [`src/components/FeedbackChipBar.jsx`](./src/components/FeedbackChipBar.jsx)
  — the bottom-left feedback strip. The SyncIndicator chip stays
  light/frosted (ambient "Edited Nm ago"); toasts are dark gray-900
  with white text and slide in from behind the chip via CSS
  `@keyframes` (no JS state ping-pong, no entry delay). Undo/redo
  toasts lead with a Phosphor curved-arrow icon
  (`ArrowUUpLeft` / `ArrowUUpRight`) followed by the entry's label
  ("[↶] Move card"). Conflict and save-fail toasts render text-only on
  the same dark body. 2s visible, 300ms fade-out, hover pauses both
  the dismiss timer and (mid-fade) the visual opacity transition.
- [`src/store/useFeedbackToastStore.js`](./src/store/useFeedbackToastStore.js)
  — custom queue + lifecycle replacing Sonner for the chip toasts.
  Sonner couldn't carry the slide-from-behind-chip + masking pattern.
  When a new toast pushes, any existing visible toast immediately
  starts fading out (no horizontal stacking) so old and new cross-
  fade smoothly during the overlap. Sticky id (`persist-fail`)
  replaces in place so repeated save-failures collapse to one toast.
- [`src/lib/feedbackToasts.jsx`](./src/lib/feedbackToasts.jsx) —
  thin public API (`toastUndoSuccess`, `toastRedoSuccess`,
  `toastUndoConflict`, `toastRedoConflict`, `toastSaveFailed`) so
  `.js` modules can fire chip toasts without owning JSX.
- 31 new tests across `useUndoStore.test.js` and
  `useFeedbackToastStore.test.js` covering stack semantics, F5
  rehydrate end-to-end, conflict + failure paths, toast call paths,
  no-stacking supersession, sticky-id replace, lifecycle phase
  transitions, and pause/resume in both phases.
- [`src/lib/undoIntegration.test.js`](./src/lib/undoIntegration.test.js)
  — round-trip integration test for delete-card-with-everything
  (card + sections + connections), the riskiest action type's
  snapshot/restore cycle.

**Changed**
- The persist-write final-failure toast (in `errorReporting.js`)
  shifted off Sonner onto the same chip-toast system, so all
  bottom-left feedback shares one visual family. The `sonner` npm
  package is no longer imported anywhere — left installed for a
  separate cleanup commit.
- `AuthContext.signOut` now wipes the in-memory undo stack AND every
  sessionStorage `mastermind:undo:${userId}:*` entry (across any
  campaigns the user touched in this tab) before Supabase clears the
  session. Prevents a different user signing in next on the same tab
  from inheriting the prior user's undo history.
- The original 1044-line `src/lib/undoActions.js` and 1565-line
  `src/lib/undoActions.test.js` were each split per-type so the
  dispatcher reads as 14 small focused modules instead of a switch-
  on-type monolith. New action families (e.g. AI-generated batch
  writes when Sprint 5+ lands) drop in as a new file alongside
  rather than disentangling helpers from a grab-bag.

**Trade-offs accepted**
- **No live cross-tab sync.** Tab A's actions don't appear in Tab B's
  stack while both are open. Industry-standard behavior (Figma,
  Notion, Google Docs). If users ever ask, the V2 path is
  BroadcastChannel coordination.
- **No cross-tab-close survival.** Closing the tab loses its undo
  history. F5 is fine (sessionStorage handles it). The localStorage +
  multi-tab-coordination version is the V2 path if real users hit it.
- **Non-transactional delete-restore.** The 3-step restore (card →
  sections → connections) isn't atomic. A partial failure mid-restore
  could leave inconsistent state. `persistWrite`'s retry/lock-overlay
  flow makes this rare; if observed, swap the 3 inserts for one
  Postgres RPC `restore_card_with_dependents`.
- **Residual flicker on chained Ctrl+Z** (create → move → delete
  combos). Functionally correct — round-trip property holds, undo
  history intact — but a sub-frame visual stutter remains. Documented
  in `BACKLOG.md` as Tier 4 polish.

### Sprint 1.6 — EditModal refactor + first component tests (2026-04-28)

The 792-line EditModal was the largest single source of "fragile" code in the
project. Sprint 3 (modular sections UI) would have added more to it. Decomposed
into 5 focused components + 2 hooks, with 10 happy-path tests pinning down
behavior across the refactor.

**Added**
- 4 testing dev dependencies — `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
- [`vitest.config.js`](./vitest.config.js) — jsdom environment + globals.
- [`src/setupTests.js`](./src/setupTests.js) — jest-dom matchers, cleanup
  between tests, jsdom polyfills for `crypto.randomUUID` and `matchMedia`.
- [`src/components/EditModal.test.jsx`](./src/components/EditModal.test.jsx)
  — 10 happy-path tests covering open/populate, debounced auto-save (title +
  type + bullets + bullet removal), connection add/remove, Esc to close
  (with flush), and avatar upload (mocked).
- 5 new components extracted from EditModal:
  - [`src/components/EditModalHeader.jsx`](./src/components/EditModalHeader.jsx)
    — avatar + title + TypePicker + close button. Owns its own
    `uploadingAvatar` state and avatar upload handler.
  - [`src/components/BulletSection.jsx`](./src/components/BulletSection.jsx)
    — reusable section with DnD reorder, focus-on-new, add/remove/update.
    Exports `newItem` for parents that need to seed initial state.
  - [`src/components/MediaSection.jsx`](./src/components/MediaSection.jsx)
    — Inspiration grid with DnD reorder + parallel-safe upload (uses a
    ref to track the latest items so concurrent uploads don't clobber).
  - [`src/components/ConnectionsSection.jsx`](./src/components/ConnectionsSection.jsx)
    — chip list + picker with click-outside-to-dismiss.
  - [`src/components/TypePicker.jsx`](./src/components/TypePicker.jsx)
    — type dropdown with hover highlighting and "Create new type…" row.
  - [`src/components/SectionLabel.jsx`](./src/components/SectionLabel.jsx)
    — small uppercase-tracked label utility used at the top of each section.
- 2 new hooks:
  - [`src/hooks/useAutoSave.js`](./src/hooks/useAutoSave.js) — debounced
    save with explicit `flush()` for use on close.
  - [`src/hooks/useMorphAnimation.js`](./src/hooks/useMorphAnimation.js)
    — modal-from-card morph in/out animation with three phases (pre-paint
    setup via `useLayoutEffect`, animate-in via `useEffect`, animate-out
    via the returned `animateClose` function).

**Changed**
- `src/components/EditModal.jsx`: 792 → 228 lines (71% reduction). Now
  pure orchestration: form state declarations, hook calls, sub-component
  composition. State (title, type, summary, bullet sections, media,
  thumbnail, localConns) stays in EditModal so the auto-save useEffect
  can read all of it from one place.

**What this unblocks**
- Sprint 3 (modular sections UI) lands on small focused files instead of
  a 792-line behemoth.
- Sprint 5 (AI copilot inserting content) can hand each section a clean
  `items` + `onChange` interface.
- Future contributors can read EditModal end-to-end in one sitting.

### Sprint 1.5b — Cascade of polish + bug fixes (2026-04-28)

Sprint 1.5 (Realtime) shipped, but exposed several bugs and UX issues
underneath. All fixed in the same session and verified end-to-end.

**Fixed**
- **Multi-tab DELETE propagation** — Realtime DELETE events on RLS-protected
  tables silently dropped because Postgres' default `REPLICA IDENTITY` only
  sends the primary key in DELETE broadcasts, so the `campaign_id=eq.X`
  subscription filter doesn't match. Required SQL:

  ```sql
  alter table public.nodes          replica identity full;
  alter table public.node_sections  replica identity full;
  alter table public.connections    replica identity full;
  alter table public.text_nodes     replica identity full;
  ```
  Apply this pattern to any future table whose Realtime DELETE events need
  to pass an RLS check or column filter.
- **Right-click context menu position bug** — switched
  [`src/App.jsx`](./src/App.jsx) from the deprecated `rfInstance.project()`
  with manual `getBoundingClientRect` subtraction to
  `rfInstance.screenToFlowPosition({ x: clientX, y: clientY })`. The old
  pattern produced bad coordinates when DevTools or other panels shifted
  the viewport.
- **TextNode trash icon** broken on every edit session after the first.
  Two compounding causes:
  1. `useReactFlow().setNodes((nds) => nds.filter(...))` doesn't propagate
     removals to App's `useNodesState` — RF v11 only emits `'reset'` changes
     for kept nodes when controlled-mode `onNodesChange` is wired up, never
     `'remove'` for the missing one. Fix: new
     [`src/lib/CanvasOpsContext.jsx`](./src/lib/CanvasOpsContext.jsx)
     exposes App's `onDeleteNode` to descendants; TextNode's trash now
     routes through there.
  2. RF v11's NodeWrapper interferes with React's synthetic event delegation
     for selected nodes — `onMouseDown`/`onClick` on toolbar buttons fail to
     fire after the second-and-later edit sessions. Fix: new internal
     `NativeButton` wrapper in
     [`src/nodes/TextNode.jsx`](./src/nodes/TextNode.jsx) attaches
     native `pointerdown` + `click` listeners directly to each toolbar
     button, bypassing React's event system. Also calls `preventDefault()`
     on `pointerdown` so contenteditable focus isn't shifted mid-click.
- **Text-block focus on create** — programmatic `el.focus()` on a freshly-
  mounted contenteditable inside a React Flow node was a no-op in Edge
  even though `document.hasFocus()` was true and tabindex was set. Fix in
  [`src/nodes/TextNode.jsx`](./src/nodes/TextNode.jsx): added `autoFocus`
  attribute + a retry loop (up to 10 attempts at 50ms intervals) that
  bails as soon as `document.activeElement === el`.
- **Submenu hover gap on right-click → Add card → \[type\]** — the 4px gap
  between the primary menu and submenu let mouseleave fire mid-traversal.
  Fix in [`src/components/CanvasContextMenu.jsx`](./src/components/CanvasContextMenu.jsx):
  16px-wide invisible bridge overlapping both menus + 200ms hover-intent
  close delay (cancellable on re-enter).

**Added**
- [`src/lib/CanvasOpsContext.jsx`](./src/lib/CanvasOpsContext.jsx) — small
  context that exposes App-level operations (`onDeleteNode`) to React
  Flow's custom node renderers. See file header for the React Flow
  removal-propagation issue it works around.

### Sprint 1.5 — Realtime cross-tab sync (2026-04-27)

**Added**
- `useCampaignData` opens a Supabase Realtime channel per active campaign with
  four `postgres_changes` listeners (`nodes`, `node_sections`, `connections`,
  `text_nodes`). Incoming events translate back to React/React Flow shape via
  the existing marshalers (`dbNodeToReactFlow`, `dbTextNodeToReactFlow`) and
  merge into `setNodes` / `setEdges`. Channel teardown on campaign switch /
  unmount via `supabase.removeChannel`.
- `dbTextNodeToReactFlow` is now exported from `src/lib/textNodes.js` so the
  hook can reuse it for INSERT/UPDATE handlers.

**Database (run once per project)**
- The four data tables must be members of the `supabase_realtime` publication.
  Idempotent SQL block:

  ```sql
  do $$
  declare t text;
  begin
    foreach t in array array['nodes','node_sections','connections','text_nodes']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end$$;
  ```

  (Erik's project already had `nodes` published from a Supabase template; the
  idempotent form skips it cleanly.)

**Trade-offs accepted (V1)**
- No echo filter. Self-writes round-trip through the channel and re-set
  identical values — harmless for inserts/updates of the same data, but two
  tabs simultaneously typing the same field could drop a character. Revisit
  as 1.5b only if Erik notices it.
- `node_sections` has no `campaign_id` column, so the DB-side filter is
  omitted; RLS scopes events to the user's own rows and the handler
  client-side drops events whose `node_id` isn't in local state.
- `text_nodes` UPDATE handler preserves `data.editing` so a remote update
  can't kick the local tab out of edit mode mid-keystroke.

### Sprint 1 hygiene — Image storage migration + App.jsx refactor (2026-04-27)

**Added**
- Supabase Storage bucket `card-media` with row-level security gated by a
  `SECURITY DEFINER` helper (`public.user_owns_card_media_path`).
  See [`supabase/migrations/002_card_media_bucket.sql`](./supabase/migrations/002_card_media_bucket.sql).
- `src/lib/imageStorage.js` — browser-Canvas transcode → two WebP variants
  (`thumb` 256px / 40% q, `full` 1920px / 80% q) → Storage upload.
- `src/lib/useImageUrl.js` — single hook that resolves any image reference
  (legacy base64, external URL, or Storage path) to a renderable URL.
- `src/components/Lightbox.jsx` — single shared lightbox provider; the
  card avatar (canvas), modal avatar, and inspiration tiles all open it.
- `src/components/MigrateImages.jsx` — one-shot tool at `#migrate` to
  backfill any existing base64 image entries to Storage. Idempotent.
- `src/hooks/` directory with four extracted hooks:
  `useSpacebarPan`, `useCampaignData`, `useEdgeGeometry`, `useNodeHoverSelection`.
  These were carved out of App.jsx to give Sprint 1.5 Realtime work
  clean places to land.
- `src/store/useCanvasUiStore.js` — Zustand store for transient hover/select
  flags. Cards subscribe via narrow selectors; a hover event mutates one
  atomic value instead of forcing a re-render of every card.
- `:has(.is-lifted)` rule in [`src/index.css`](./src/index.css) so hovered /
  selected / edge-highlighted cards rise above neighboring cards spatially.
- ADR-0005 amendment documenting the SECURITY DEFINER lesson — the inlined
  cross-schema check fails silently in storage policies.

**Changed**
- EditModal's avatar + inspiration uploads no longer write base64 strings
  to the database. They transcode + upload via `imageStorage.uploadCardImage`
  and store either a path string (avatars) or a `{path, alt, uploaded_at}`
  object (inspiration entries) per ADR-0005.
- App.jsx shrank from ~700 lines to ~530 lines. The load lifecycle, edge
  geometry recompute, hover/select handlers, and spacebar-pan listeners
  all moved into `src/hooks/`. App.jsx now reads as orchestration.
- `anySelected`, `anyHovered`, and `hoveredEdgeNodeIds` no longer live on
  per-node `data`. They're in `useCanvasUiStore` and CampaignNode reads
  them via narrow Zustand selectors. This removes the O(N) re-render on
  every hover event that would have made 100+ cards sluggish.
- ADR-0005 status: Accepted → **Implemented (2026-04-27)**.
- Avatar header in EditModal: clicking the image now opens the lightbox;
  a small pencil button on hover triggers the file picker (was: clicking
  the image *was* the file picker, no way to view it full-size from inside
  the modal).
- Avatar on the canvas card: clicking now opens the lightbox.
- `main.jsx` Root gatekeeper accepts a `#migrate` hash route so the
  migration tool can be reached without breaking the existing
  loading → login → picker → app gate.

**Fixed**
- Image uploads previously failed with `new row violates row-level security
  policy` because the bucket's RLS expression inlined a cross-schema lookup
  against `public.campaigns`. Replaced with a `SECURITY DEFINER` helper.
- Hovered or selected cards used to be visually overlapped by neighboring
  cards (their bullets bled into the lifted card). The wrapper now gets a
  bumped z-index via `:has(.is-lifted)`.
- Modal avatar previously had no way to view the image full-size; the only
  click target opened the file picker. The pencil-button pattern preserves
  both actions.

**Docs**
- CLAUDE.md File Map updated for `src/hooks/`, `src/store/useCanvasUiStore.js`,
  the new `src/lib/` files, the new components, and the migration file.
- CLAUDE.md "What Is Built" updated; React-shape comment reflects the
  new `media` shape and notes that hover/select flags moved to the store.
- ADR-0005 status flipped to Implemented; an amendment captures the
  SECURITY DEFINER discovery so future Storage-bucket work doesn't
  rediscover it the hard way.

### Sprint 1 — Supabase persistence + auth

**Added**
- Email + password authentication via Supabase Auth (`src/lib/AuthContext.jsx`)
- Login / sign-up screen (`src/components/Login.jsx`)
- Campaign picker landing screen with list / create / rename / delete (`src/components/CampaignPicker.jsx`)
- Active-campaign context persisted to localStorage (`src/lib/CampaignContext.jsx`)
- Full Supabase schema with RLS policies on every table (`supabase/schema.sql`)
- Node + node_sections CRUD with flat-shape ↔ section-rows marshaling (`src/lib/nodes.js`)
- Connections CRUD (`src/lib/connections.js`)
- Text nodes CRUD (`src/lib/textNodes.js`)
- `campaigns.js` API with `createCampaign` that also seeds the five built-in `node_types`
- Profile avatar component with dropdown menu (sign out + email context) (`src/components/UserAvatar.jsx`)
- `UserMenu` overlay on the canvas with Campaigns button + UserAvatar
- `.env.example` template for Supabase credentials
- `docs/decisions/` with three ADRs covering the Sprint 1 architecture calls

**Changed**
- Rebranded from "DnD Campaign Mind Map" to "MasterMind: Story Builder"
- `App.jsx` refactored to load from Supabase on mount / campaign switch, and persist every state mutation back to Supabase (optimistic + fire-and-forget)
- `main.jsx` gatekeeper routes through: loading → login → campaign picker → app
- `CampaignNode` dynamic icon visibility rewritten as a deterministic `useMemo` using canvas `measureText`, eliminating feedback-loop flicker with `avatarSize`
- `TextNode` now persists content, font size, alignment, resize, and toolbar-delete directly to Supabase
- README.md and CLAUDE.md rewritten to reflect current state
- `package.json` name updated to `mastermind-story-builder`

**Removed**
- Lock / unlock cards feature (scoped out of V1; state is in-memory only)
- Duplicate-with-connections variant (plain duplicate is sufficient)
- `+ Strahd sample` button from CampaignPicker (one-time seeding completed)
- `src/lib/seedStrahd.js` (dead code after Strahd campaign was seeded)
- `src/nodes/nodeTypes.js` (legacy static NODE_TYPES; no imports reference it)
- `lucide-react` dependency (Phosphor is the only icon library; Lucide was never used)
- `firebase` dependency (never wired; replaced by Supabase)

**Docs**
- `project-brief.md` retitled to MasterMind: Story Builder; vision content unchanged
- `design-document.md` synced to current reality (Phosphor icons, Supabase backend, built features no longer marked "not yet built," Lock state noted as cut, roadmap consolidated)
- CLAUDE.md "Known Inaccuracies" table removed and replaced with a policy for how future divergences will be tracked (prefer updating design doc, or write an ADR for preserved-intent decisions)

**Fixed**
- Text node content disappearing on refresh (saves on blur now persist `contentHtml` to DB)
- Text node toolbar trash-icon delete not removing the DB row
- Card header icon flickering between visible/hidden during zoom due to `avatarSize` feedback loop
