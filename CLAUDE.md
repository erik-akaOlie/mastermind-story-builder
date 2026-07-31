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

**Presenting options & recommendations.** For any advisory turn — weighing approaches, triaging issues, scope calls, recommending a path — use this 5-part structure, in order:

1. **What I found (facts)** — observed reality from code/files/git/conversation; what exists vs. what doesn't.
2. **Why it matters** — what's at stake acting vs. not, and the tradeoffs in play.
3. **Options (A, B, C)** — distinct named paths, **each with its pros and cons**.
4. **Recommendation + why** — the call, with reasoning. Be willing to recommend; don't punt unless the choice genuinely needs Erik's domain judgment.
5. **Confidence** — high / medium-high / medium / low, with a one-line reason if low.

Skip it for pure execution, simple factual answers, quick clarifications, or status updates. If only one path is viable, say so rather than invent fake options. Don't surface decisions as a bare multiple-choice prompt — the reasoning must be visible. This complements the 7-part structure above: 7-part for deep architecture/systems-design dives, 5-part for everyday decisions.

Do not spend context budget analyzing your own behavior unless explicitly requested.

Do not confuse visible salience with structural invariance. Recommendations should be grounded in stable system references, not visually prominent elements.

## Definition of done — documentation (every session)

A session's work is not done until the docs reflect it, in the same session:

- **CHANGELOG.md** gets an entry for every user-facing commit (convention: committed, not deploy-gated).
- **BACKLOG.md / QA docs / ADRs** get updated whenever launch status, product decisions, accepted deferrals, or bug status change.

Added 2026-07-09 after CHANGELOG silently drifted ~6 weeks while the explicitly-named docs stayed current — name the doc or it drifts.

---

## Tech Stack (actual)

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + Vite | |
| Canvas | React Flow v11.11.4 | both `reactflow` and `@reactflow/core` are installed; use `reactflow` |
| Canvas → image | **html-to-image** | renders the React Flow viewport to a PNG for workspace auto-snapshots (`lib/workspaceSnapshot.js`) |
| Styling | Tailwind CSS v3 | rem units throughout; `html { font-size: 100% }` |
| Icons | **Phosphor Icons** (`@phosphor-icons/react`) | design doc says Lucide — **ignore that, we use Phosphor** |
| Drag-to-reorder | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | used in the Inspector for bullets and images |
| State management | Zustand v5 | Several focused in-memory stores under `src/store/` — see the File Map. All are caches over Supabase, not persistence layers. Workspace data lives in React state hydrated from Supabase. |
| Auth + Database | **Supabase** (Postgres + Auth + RLS) | `@supabase/supabase-js` client; schema in `supabase/schema.sql` |
| Image storage | **Supabase Storage** (`workspace-media` + `profile-media` buckets) | both private; clients request signed URLs per render. workspace-media holds card avatars + content images. **Content images get tiered variants** — `thumb`/`full` (WebP) for display + a high-res `printable` artifact (JPEG opaque / PNG transparent, ≤4096px); UI-identity images (node thumbnails) get `thumb`/`full` only. **Transparency drives the whole format family** (transparent → PNG everywhere). profile-media holds user profile avatars (single 256×256 variant). See ADR-0005 + its 2026-06-18 amendment (tiered variants), and migration 003 (profile-media). |
| Behavioral analytics | **PostHog Cloud** (`posthog-js`) | session replay + named events, scoped to `is_test_user=true` users only. Loaded via dynamic import (Vite splits into its own chunk; non-testers never download it). See ADR-0009. |

Firebase was previously installed but never wired; it has been uninstalled. Do not reintroduce.

---

## Environment Variables

Loaded from `.env` at the project root. See `.env.example`.

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable / anon public key>
VITE_POSTHOG_KEY=phc_<project token>
```

`VITE_POSTHOG_HOST` was **retired 2026-07-28** (ADR-0009 amendment):
analytics traffic now goes through a first-party reverse proxy at `/relay`
so ad-blockers don't silently swallow tester sessions. The PostHog region
(US) is hardcoded in `vercel.json` (production rewrites) and
`vite.config.js` (dev proxy) — change BOTH, plus `ui_host` in
`analytics.js`, if the PostHog project ever moves regions.

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
                                   <Profile /> at #profile; DEV-ONLY #ftue-preview and
                                   #empty-picker-preview routes (gated on import.meta.env.DEV →
                                   dead-code-eliminated from production builds)

  dev/
    FtuePreview.jsx                DEV-ONLY design-QA harness (#ftue-preview, no auth): renders the REAL
                                   FtueIntro over the REAL BottomToolbar on the canvas color, with a live
                                   viewport readout — inspect/screenshot the FTUE at any window size
                                   without signing in. Verified absent from the production bundle (grep
                                   dist for FTUE-PREVIEW-HARNESS). Keep narrowly dev-only.

  lib/                             infrastructure & data-access layer
    supabase.js                    single shared Supabase client (reads env vars)
    AuthContext.jsx                session + signIn/signUp/signOut context. signOut calls
                                   useUndoStore.clearAllForUser(userId) before Supabase clears the session
                                   so a different next user can't inherit prior undo history.
    WorkspaceContext.jsx            active-workspace-id context (URL ?w=) + invalid-workspace
                                   recovery (null row while signed in → clear id, REPLACE dead URL,
                                   one-shot workspaceNotice rendered by the picker — see the Auth
                                   flow section); also exposes
                                   leaveWorkspace(nextId)/registerBeforeLeave(fn): App registers a
                                   canvas-snapshot capture, run behind a "Saving changes…" spinner
                                   overlay while the canvas is still mounted before navigating away.
                                   UserMenu's Home + switcher route leaves through leaveWorkspace.
    ProfileContext.jsx             single source of truth for the signed-in user's public.profiles row
                                   (avatar_path, display_name, future user-level metadata). Loaded once
                                   per user, exposed via useProfile() with { profile, loading, error,
                                   updateProfile, refresh }. Mirrors AuthProvider / WorkspaceProvider.
    profile.js                     CRUD for the public.profiles row: getProfile, setAvatarPath,
                                   clearAvatar (nulls column + best-effort storage delete), setDisplayName.
    workspaces.js                  CRUD for workspaces + listNodeTypes. listWorkspacesWithActivity()
                                   calls the list_workspaces_with_activity() RPC (migration 011) →
                                   each workspace + last_activity_at (true newest edit across content)
                                   for the picker's "Last modified" sort.
    handDrawn.js                   the "handwritten guidance" product pattern's pure SVG path helpers
                                   (handArrowPath, handArrowPathWavy, arrowheadPath) — Caveat text +
                                   loose curved arrow from an instruction to its control, always
                                   COMPUTED from live element measurements. Born in FtueIntro (which
                                   re-exports them so its tests keep pinning that surface); second
                                   consumer is CampaignPicker's empty-library guide. Geometry only —
                                   each surface supplies its own colors (FTUE: white on canvas;
                                   picker: gray on light page).
    canvasColor.js                 single source of truth for the canvas background color
                                   (DEFAULT_CANVAS_COLOR #031a15 + getWorkspaceCanvasColor(workspace),
                                   ready for per-workspace colors). Used by the snapshot background and
                                   the picker's empty-state tile.
    workspaceSnapshot.js           captureGraphSnapshot(nodes): renders the WHOLE React Flow graph (all
                                   nodes, not just the viewport) to a PNG via html-to-image, for the
                                   auto-generated fallback cover. App registers it as a before-leave hook.
    workspaceSort.js               pure client-side workspace sort + localStorage persistence (3 single-
                                   choice options); unit-tested in workspaceSort.test.js.
    nodes.js                       CRUD for nodes + node_sections; shape-marshaling. Includes
                                   buildDeleteCardSnapshot + restoreCardWithDependents for undo's delete-card
                                   round-trip.
    connections.js                 CRUD for connections (edges)
    textNodes.js                   CRUD for text annotations; includes restoreTextNode for undo's delete-text
                                   round-trip.
    lines.js                       CRUD for free-standing straight-line annotations (ADR-0019): two absolute
                                   canvas anchors (A/B) + style (weight default 8 / dashed / dash length /
                                   dash gap / color), own `lines` table (migration 015) — an organization
                                   tool, structurally NOT a relationship (never references nodes). Exports
                                   LINE_PAD/LINE_DEFAULTS + pure helpers (linePositionFor, snapToAxis for
                                   Shift 4-axis constraint, dbLineToReactFlow, buildLineDbRow; unit-tested
                                   in lines.test.js).
    imageStorage.js                Storage helpers for all image domains. UI-identity card images
                                   (node thumbnail): thumb/full WebP → workspace-media (uploadCardImage,
                                   cardImagePipeline). Content/handout images (Image Section + Album):
                                   thumb/full display + a high-res `printable` artifact → workspace-media
                                   (uploadContentImage, contentImagePipeline). Profile avatars: single
                                   256×256 WebP → profile-media. Transparency is auto-detected (imageHasAlpha)
                                   and drives format: transparent → PNG (display + printable), opaque → WebP
                                   display + JPEG printable. pathForVariant swaps the display token while
                                   preserving the .webp/.png ext; the printable path is stored explicitly.
                                   getImageUrl(path, variant, bucket) is bucket-aware. Pure helpers
                                   (hasAlphaInImageData, collectImagePathsToDelete, etc.) are unit-tested.
    clipboardImage.js              Higher-fidelity paste resolver. On paste, gathers every image candidate
                                   (clipboardData files/items, text/html data: URIs, navigator.clipboard.read())
                                   inspects each for alpha + dimensions, and picks the best (prefer real
                                   transparency, then resolution). Pure chooseBestImageCandidate is unit-tested.
                                   Used by UploadImageModal so a paste keeps transparency when the clipboard
                                   actually carries it (Photoshop "Copy" flattens; drag/file-pick preserves).
    useImageUrl.js                 hook resolving avatar/media values to renderable URLs (handles base64,
                                   external https, and Storage paths). Signature: useImageUrl(input,
                                   {variant, bucket}); a string second arg is treated as {variant} for
                                   backward compat. Default bucket is 'workspace-media'.
    migrateCardToBlocks.js         PURE converter (block-editor Phase 1, ADR-0016): one card's legacy
                                   fielded content → the two new BlockNote zones. Card View ← Summary +
                                   "Discoverable Lore" (was Story Notes). GM's Eyes Only ← "Notes" (Hidden
                                   Lore then DM Notes, merged) + Image Album (Image Section images, JSON-
                                   stringified verbatim) + a live-reading Connections block. Does NOT take
                                   connections (they stay first-class rows; the block reads them live), so
                                   it structurally cannot lose/dupe one. No side effects → fully unit-tested
                                   for zero loss (migrateCardToBlocks.test.js, written test-first).
    blockMigration.js              Orchestration over the pure converter: loads every card the user owns
                                   (RLS-scoped), classifies each (new / stale / up-to-date via order-
                                   insensitive jsonEqual), writes ONLY the card_view/gm_only rows
                                   idempotently (B1: delete-then-insert just those two kinds), then reads
                                   them back and verifies no-loss (A1, checkNoLoss). NEVER touches legacy
                                   rows; NEVER deletes data. runBlockMigration({dryRun}) returns a report
                                   {total, toMigrate, migrated, verified, skipped, failed[], nothingToMigrate}.
                                   checkNoLoss + jsonEqual + classifyCard are exported + unit-tested
                                   (blockMigration.test.js proves the verifier CATCHES loss, not just passes).
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
                                   analytics call can't crash the host feature. Since 2026-07-28
                                   (ADR-0009 amendment) api_host is the same-origin '/relay' proxy
                                   (vercel.json rewrites in prod, vite.config.js proxy in dev) so
                                   ad-blockers don't swallow tester sessions; disclosed in the signup
                                   recording notice.
    betaConfig.js                  reads the single beta_config launch-switch row (isBetaOpen). Anon-
                                   readable; fail-safe defaults to OPEN if the read fails. Migration 014.
    waitlist.js                    joinWaitlist() — anon insert into public.waitlist with plain-English
                                   dup/format errors. Overflow signups when beta_open is false.
    howHeardOptions.js             shared "How did you hear?" option list (Discord, Reddit, YouTube,
                                   LinkedIn, Friend / word of mouth, Other) used by signup + waitlist.

  lib/undo/                        Undo-system command-pattern dispatcher (per ADR-0006)
    index.js                       exports ACTION_TYPES, deepEqual, and the four dispatcher functions
                                   (canApplyInverse / canApplyForward / applyInverse / applyForward). Routes
                                   each entry to its per-type handler via a Map<type, handlers> lookup.
    _shared.js                     deepEqual + universals
    _cardHelpers.js, _connectionHelpers.js, _listItemHelpers.js, _textNodeHelpers.js, _lineHelpers.js
                                   family-specific helpers (drift checks, persist-call shapes)
    createCard.js, editCardField.js, moveCard.js, deleteCard.js,
    addConnection.js, removeConnection.js,
    addListItem.js, removeListItem.js, editListItem.js, reorderListItem.js,
    createTextNode.js, editTextNode.js, moveTextNode.js, deleteTextNode.js,
    createLine.js, editLine.js, moveLine.js, deleteLine.js
                                   one file per action type, each exporting
                                   { canApplyInverse, canApplyForward, applyInverse, applyForward }

  hooks/                           reusable hooks extracted from App.jsx and the Inspector
    useSpacebarToolSwitch.js       spacebar = temporary while-held tool switch (bottom toolbar,
                                   2026-07-10; replaced useSpacebarPan): writes `spacebarHeld` into
                                   useToolStore; the flip itself is the pure effectiveTool()
                                   derivation (non-Hand tools → Hand, Hand → Pointer), so key
                                   release restores the prior tool by construction. Keeps the
                                   typing exemption; clears the flag on window blur.
    useOneShotPlacement.js         toolbar Chunk 2 (2026-07-15): one-shot placement for the Node /
                                   Text Block tools + Esc-to-cancel for ALL creation tools. No
                                   overlay — a document CAPTURE-phase pointerdown listener
                                   intercepts primary clicks aimed at .react-flow__pane (nodes are
                                   pane children, so a click over a card still places), converts to
                                   flow coords, and calls App's creator; right-click / wheel / app
                                   chrome are untouched while armed, so menus open normally and the
                                   tray stays clickable. Detaches during spacebar suspension (the
                                   click should pan). Exports suppressNextClick (shared with
                                   LinePlacementOverlay). TOUCH (Chunk 3, 2026-07-16): a finger
                                   places on LIFT, not press — the press is NOT swallowed (RF touch
                                   gestures stay live while armed); moving past 10px or a second
                                   finger abandons the placement with the tool staying armed, so
                                   two-finger pan/zoom never drops an accidental node.
    useMobilePortrait.js           conservative phone detection (toolbar Chunk 3): true ONLY when
                                   touch-primary AND portrait AND ≤640px all hold at once — a
                                   touchscreen laptop, a narrow desktop window, a tablet, and a
                                   phone held sideways all stay false. Consumers: BottomToolbar
                                   (mobile tray), SyncIndicator (hide passive state), FeedbackChipBar
                                   (raise above the tray).
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
    useLongPressContextMenu.js     iOS long-press parity (iPhone QA Finding A, 2026-07-08): a ~500ms
                                   stationary touch/pen hold on the pane or a node opens the Canvas Tool
                                   Menu / node menu via App's shared open functions — iOS Safari never
                                   fires contextmenu on touch. Cancels on >10px move, second finger, or
                                   early lift; dedupes both directions against Android's native
                                   contextmenu; swallows the release click so the menu stays open.
                                   Ignores mouse pointers and text-editing surfaces.

  nodes/
    CampaignNode.jsx               renders a node as a colored card; subscribes to useCanvasUiStore; adds .is-lifted
                                   class so :has() in index.css promotes the wrapper z-index
    TextNode.jsx                   freestanding text annotation blocks (persists directly via lib/textNodes).
                                   The font-size preset menu renders in a document.body portal at
                                   the context-menu tier (fixed z-[9999]), placed by placeDropdown
                                   (CanvasToolbar.jsx) — flip-above + in-window clamp — because an
                                   in-canvas z-index can never beat fixed chrome (QA-1 fix,
                                   2026-07-16)
    LineNode.jsx                   free-standing line annotation (ADR-0019). Position = padded bbox top-left
                                   (lib/lines.js linePositionFor); anchors are absolute canvas coords in
                                   data. Only the widened invisible hit-stroke + endpoint handles take
                                   pointer events (clicks land near the line, not its whole box); endpoint
                                   drags re-anchor live via CanvasOps (setLineAnchors / commitLineAnchors)
                                   and commit ONE editLine undo entry on release; Shift snaps to the 4 axes
                                   through the fixed endpoint. Handle + hit sizes counter-scale with zoom.
                                   Cap policy: solid = round, dashed = BUTT (round caps extend each dash by
                                   weight/2 per end, visually coupling weight to dash length — never
                                   reintroduce round caps on dashed strokes).
    QuickConnectButtons.jsx        the four per-side connection-creation buttons shown on a hovered/
                                   selected card (24px sky-600 circles just outside each edge, zoom-
                                   compensated, NATIVE pointer listeners per the RF v11 selected-node
                                   footgun). Icons are outward-facing CARETS (CaretUp/Right/Down/Left
                                   at 18/24 of the button + per-side aria-labels, 2026-07-29 —
                                   deliberately NOT Arrow*: the direction means "drag outward from
                                   this edge"; a full arrow would imply the RELATIONSHIP is
                                   directional, and connections aren't). Presentation pinned by
                                   QuickConnectButtons.test.jsx; interaction logic in lib/quickConnect.js.
    iconRegistry.js                70+ Phosphor icons with keywords; getIcon(), recommendIcons()

  edges/
    FloatingEdge.jsx               straight-line edge renderer; reads sourcePoint/targetPoint from edge.data

  components/
    Login.jsx                      email+password auth form
    CampaignPicker.jsx             post-login landing; responsive GALLERY GRID of workspaces (open/
                                   create/rename/delete + per-tile cover via "…" menu). Top row has a
                                   "Sort by" control (left) + a New-workspace control (right) that
                                   container-morphs from a secondary button into a "name your workspace"
                                   frame. Phone-narrow viewports (useIsNarrowViewport, MB-4) get their
                                   own band: stacked two-line sort (bottom-aligned with the pill), the
                                   pill morphs IN PLACE into a full-row name input (sort hides while
                                   creating, returns after the 300ms retract on cancel), and a Cancel/
                                   Create action row slides open beneath (grid 0fr↔1fr), pushing the
                                   gallery down; page top padding tightens 48→24px. Desktop unchanged.
                                   Wrapped in UploadImageProvider for cover uploads. EMPTY-LIBRARY
                                   STATE (2026-07-30): at zero workspaces the closed New-workspace
                                   button promotes to the PRIMARY treatment (sky fill, white text) and
                                   EmptyLibraryGuide renders — the Caveat instruction with an
                                   INTENTIONAL two-line hierarchy ("Add a new workspace" at 2× /
                                   "to get started"; the break is designed, never responsive) +
                                   a hand-drawn arrow (lib/handDrawn.js) to the button
                                   ([data-empty-guide-target] on both branches' closed buttons).
                                   Everything is measured, never fixed (re-measured on resize,
                                   scroll, AND after webfont load — Caveat shifts metrics
                                   post-paint). Arrow rules (Erik 2026-07-30, all in the pure
                                   exported emptyGuideArrowGeometry): ADAPT-BEFORE-REMOVE — tail
                                   prefers the text's right edge, re-attaches to its TOP edge when
                                   that no longer fits, null ONLY when anchors are unmeasurable or
                                   no vertical room in any form; EQUAL breathing room at both ends
                                   via a gap LADDER (32→24→16 — both ends always equal, compress
                                   before ever dropping the arrow; a real 617×290 Android landscape
                                   missed both forms by single digits at rigid 32, diagnosed via a
                                   temporary on-device debug strip — removed after diagnosis);
                                   the arrow bridges a relationship — never let it belong to one
                                   element; startDir points straight OUT of the text so the
                                   tail's tangent extended backward intersects the message. SHORT
                                   viewports adapt on the height axis (Erik's Android landscape QA):
                                   available height < 320 → compact type scale (the narrow sizes,
                                   2:1 intact) and the 48px min-rise accepts a landscape phone's
                                   shallow sweep — never demand tall-layout rise. The guide unmounts while
                                   `creating`. `previewEmpty` prop is DEV-ONLY (honored only when
                                   import.meta.env.DEV) for the #empty-picker-preview harness.
                                   Pinned by CampaignPicker.test.jsx.
    WorkspaceThumbnail.jsx         canonical workspace cover image; one place owns the render precedence
                                   cover_image_url → snapshot_path → bare canvas color. Used by the picker
                                   tiles (16:9) and the UserMenu switcher (circle).
    WorkspaceSortMenu.jsx          picker sort dropdown: Alphabetical / Date created / Last modified
                                   (single choice each). Pure presentation over lib/workspaceSort.js.
                                   `stacked` prop (MB-4, phone-narrow only): two-line left-justified
                                   trigger — "Sort by" label over the active choice.
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
    ConnectionsSection.jsx         LEGACY (unmounted at the ADR-0016 E4 cutover, kept intact):
                                   the old chip list + "+ Add connection" node picker. The live
                                   Connections panel is editor/ConnectionsBlock.jsx, which since
                                   2026-07-29 has BOTH doors: display/delete chips AND add via
                                   editor/AddConnectionControl.jsx — a chip-height circular plus
                                   that morphs into a search input (portal menu via placeDropdown;
                                   same searchNodes() as the [[ autocomplete, now with a limit
                                   param + "+N more" overflow hint; canonical onAddConnection from
                                   EditorContext, so dedup/undo/Realtime ride the existing flow;
                                   legacy connection_started/completed/abandoned funnel restored).
                                   Key events stop propagation so BlockNote never sees search
                                   keystrokes. This legacy file remains as historical reference
                                   only — safe to delete in a future cleanup pass.
    TypePicker.jsx                 type dropdown (used inside InspectorHeader) + "Create new type…" row
    SectionLabel.jsx               tiny uppercase-tracked label utility used across sections
    ContextMenu.jsx                right-click menu on canvas elements — nodes, text blocks, lines
                                   (Duplicate/Delete only; Edit + Lock rows removed 2026-07-10 — opening
                                   lives on double-click/repoint, lock is scoped out of V1)
    CanvasContextMenu.jsx          right-click / long-press menu on empty canvas (Add node / Add text /
                                   Add line — three EQUAL rows, no dividers) — "Canvas Tool Menu" in
                                   product language. Icons per the Figma toolbar set: Article (fill) /
                                   TextT / exported LineToolIcon (plain diagonal SVG — deliberately no
                                   endpoint dots, which would read as a node connection). Desktop: hover
                                   opens the type submenu (16px invisible hover-bridge + 200ms
                                   hover-intent close delay), click quick-adds the first type.
                                   Touch-primary (useTouchPrimary): tap on "Add node" expands the type list
                                   INLINE (accordion) instead — hover handlers no-op so synthetic tap-hover
                                   can't open the side panel; rows grow to 44px tap targets (MB-3)
    LinePlacementOverlay.jsx       the "draw a line" mode, mounted while the Line tool is armed
                                   (toolbar or Canvas Tool Menu — useToolStore owns arming since
                                   toolbar Chunk 2, 2026-07-15). Reworked from a full-screen
                                   pointer-owning surface to a pointer-events-none FLOW-SPACE preview
                                   + document CAPTURE listeners intercepting only primary clicks
                                   aimed at .react-flow__pane — right-click (normal menus), wheel
                                   pan/zoom, and app chrome stay live while armed. One state machine
                                   covers desktop click-move-click AND touch press-drag-lift. Esc is
                                   the ONLY cancel (Erik 2026-07-15; right-click-cancel removed —
                                   pre-anchor right-click opens menus normally, mid-gesture it's
                                   ignored, as are chrome clicks and the spacebar: sets
                                   placementGestureActive at anchor A). EDGE-PAN after anchor A
                                   (cursor at the window edge pans the camera; marquee auto-pan
                                   constants) is how an off-screen anchor B is reached. TOUCH
                                   (Chunk 3): a second finger mid-drag DISCARDS the gesture (pan
                                   intent — tool stays armed; the pan attempt itself is lost, a
                                   known first-cut limitation); a press on [data-placement-cancel]
                                   (the armed mobile Line button) passes through mid-gesture so its
                                   tap can cancel the half-drawn line (the phone Esc stand-in);
                                   pointercancel falls back to click-move-click. CRITICAL: the
                                   ownership rules are mirrored on capture-phase TOUCHSTART too —
                                   RF's drag/zoom is d3-based and listens to touch events, so
                                   swallowing only pointerdown let a touch-draw over an existing
                                   line GRAB and drag it (QA-1 regression, fixed + regression-
                                   tested 2026-07-16). Never remove the touchstart listener while
                                   the pointer listeners exist.
    LineStyleToolbar.jsx           floating contextual styling for ONE selected line (AlignmentToolbar
                                   pattern: screen-layer child of <ReactFlow> + placeFloatingToolbar).
                                   Weight · dash length+gap (dashed only) as direct TYPE-IN fields
                                   (Enter/blur commits, invalid reverts, out-of-range clamps — matches the
                                   text block's editable px field) · solid/dashed toggle · delete. Every
                                   committed change = one discrete editLine undo entry.
    BottomToolbar.jsx              bottom-center tool tray (approved first cut 2026-07-10; sizing
                                   finalized in Erik's QA-3 pass — constants in the file header).
                                   Invisible 288×72 hotspot; at rest a 48×44 tab shows the active
                                   tool as a 32px sky chip DISPLAY (8px side/top borders, 4px
                                   bottom); mouse-in grows the tab into the full 288×72 tray
                                   (Pointer · Hand · divider · Node · Text Block · Line, 40px
                                   buttons / 20px icons) with the chip sliding into the active
                                   slot DURING THE MORPH ONLY — tool selection is an instant
                                   on/off, never a slide (Erik: a sliding highlight reads as the
                                   toolbar reorganizing). Tray top radius 12. Inspector-aware
                                   centering: docked Inspector → slides to the display-area center
                                   (viewportFraming band constants); closed/floating → window
                                   center. Unlike the camera, the toolbar follows the Inspector
                                   LIVE rather than reserving the band while closed. Hover detection = document mousemove
                                   hit-test, so the hotspot never eats canvas clicks while collapsed;
                                   a held primary button suppresses pop-open during drags. Custom
                                   tooltips (native title was ~70% reliable). The chip shows the
                                   EFFECTIVE tool so a held spacebar flips it live (except
                                   mid-placement-gesture — placementGestureActive suppresses the
                                   flip). Chunk 2 (2026-07-15): creation tools are live one-shots —
                                   clicking Node/Text/Line arms the tool; placement lives in
                                   useOneShotPlacement + LinePlacementOverlay and reverts to Pointer
                                   after placing. No z-index games needed: placement intercepts only
                                   pane-targeted clicks, so the tray stays clickable while armed.
                                   Chunk 3 (2026-07-16, rev 2 after phone-QA round 1): phone-
                                   PORTRAIT variant (useMobilePortrait) — always visible, fully
                                   expanded: Node · Text Block · Line · divider · Undo · Redo
                                   (40px buttons FLUSH — gaps only around the divider — 24px
                                   icons, 8px pad → 233×56; constants at top of file; 40px is
                                   FINAL per Erik's on-device QA, deliberately below the 44px
                                   guideline — see the constant's comment). Undo/Redo (QA-1 scope amendment) disable on empty
                                   stacks — same useUndoStore as Ctrl+Z, App passes onUndo/onRedo.
                                   Tap the armed tool again to disarm (mobile Esc stand-in); the
                                   armed Line button carries data-placement-cancel so its tap can
                                   end a half-drawn line. Touch-primary WITHOUT phone-portrait
                                   (tablets, landscape) still renders nothing. Exports
                                   MOBILE_TRAY_CLEARANCE_PX for FeedbackChipBar's raised position.
                                   NOT the same file as CanvasToolbar.jsx — that's the shared shell
                                   for floating contextual toolbars. FTUE chunk 1 (2026-07-16):
                                   `forceExpanded` prop holds the desktop tray open while the FTUE
                                   intro shows; the creation buttons on BOTH trays carry
                                   data-ftue-target="node|text|line" — the intro's arrows are
                                   anchored to these measured rects, so keep the attributes when
                                   restructuring the trays.
    FtueIntro.jsx                  the handwritten first-run introduction. BOTH variants teach the
                                   content-vs-structure model (mobile: Figma 265:229, Erik's 2026-07-17
                                   mockup; desktop ADOPTED the same composition 2026-07-29 via Erik's
                                   Figma 286-148 mockup): "Welcome" hero, canonical mission line "Use
                                   the tools below to build your workspace" (SHARED wording — never
                                   changes at the breakpoint), two-column tool legend ("add content
                                   with / Nodes" primary-white, "or structure and organize with /
                                   Labels & Lines" secondary-gray) + THREE hand-drawn SVG arrows
                                   COMPUTED from the legend-name rects to the measured
                                   [data-ftue-target] toolbar buttons (never hardcoded; remeasured on
                                   resize; arrival tangents AIMED at icon centers; desktop node+text
                                   arrows carry startDir straight-down for the two-motion read).
                                   Caveat brand font (`font-hand` + `leading-hand` on wrapped text).
                                   DESKTOP LAYOUT = one flex column ending at the tray top, driven by
                                   the TWO-DIMENSIONAL scale (ftueScaleFor/ftuePx, pure + unit-
                                   tested): kW interpolates every type size + designed gap between
                                   its full value and what the MOBILE SYSTEM ITSELF renders at 640px
                                   (breakpoint crossing ≈ 1px event); cH height-compresses short
                                   windows (short-but-wide gets compressed vertical values). The
                                   arrow zone + mission→legend gap are DESIGNED distances (floors,
                                   never residual leftover space — the mockup specifies
                                   RELATIONSHIPS, not pixels); residual height goes only above the
                                   mission (top : hero-pause = 2 : 1). Hierarchy provably can't
                                   invert (test sweeps 30 window shapes). Windows ≤640px wide render
                                   the MOBILE layout regardless of input type (useIsNarrowViewport).
                                   "Labels" = the FTUE-ONLY introduction name for text blocks
                                   (DECIDED, Erik 2026-07-17; extended to desktop 2026-07-29 with
                                   the legend): placement copy says "Now place the label…" on BOTH
                                   variants; after the FTUE the object is a TEXT BLOCK everywhere —
                                   NO product-wide rename. Two derived states: welcome ⇄ per-tool
                                   placement copy (derived from activeTool, NOT effectiveTool, so
                                   spacebar suspension doesn't flicker it). Visibility is App's
                                   derivation (canvas empty AND flag unset); flag semantics in
                                   useFtueStore.js. Design-QA via the dev-only #ftue-preview harness
                                   (src/dev/FtuePreview.jsx). Deferred polish logged in BACKLOG:
                                   breakpoint positional drift (~35px hero / ~40-70px columns),
                                   arrow curve character, narrow-AND-short mobile-branch overlap
                                   (19px at 620×500 — mobile's fixed offsets don't height-compress).
    CreateTypeModal.jsx            custom card type creation (label + icon + color picker)
    Lightbox.jsx                   shared <LightboxProvider>; any consumer calls useLightbox().open(value)
    MigrateImages.jsx              one-shot tool at #migrate to backfill base64 → Storage; safe to delete
                                   once no workspace has any base64 image entries
    MigrateBlocks.jsx              one-shot tool at #migrate-blocks (block-editor Phase 1, ADR-0016).
                                   Dry-run preview (default; proves conversion readiness, writes nothing)
                                   + explicit two-click "Apply for real" (writes + read-back verify; proves
                                   saved data survived the DB round-trip). Renders runBlockMigration's report
                                   with all counts + per-failure detail. Auth-gated; legacy rows untouched;
                                   never deletes. Remove once legacy cleanup
                                   ships (separate tool + ADR).
    AnalyticsBootstrap.jsx         mounted inside <ProfileProvider> in main.jsx. Watches profile.id +
                                   profile.is_test_user; on change, calls initAnalytics(profile) (which
                                   itself bails for non-testers). Renders nothing.
    LockOverlay.jsx                modal that freezes edits on prolonged save failure
    SyncIndicator.jsx              ambient "Edited just now" / "Can't save" chip; positioned by FeedbackChipBar.
                                   Phone portrait hides ONLY the passive "Edited Nm ago" state (Chunk 3,
                                   deferred not permanent); "Offline" / "Can't save" are trust-related and
                                   render on every device
    FeedbackChipBar.jsx            bottom-left feedback strip composing SyncIndicator + chip-toast slot;
                                   overflow:hidden mask makes the slot the slide-in surface. Phone portrait
                                   raises the whole strip above the always-present mobile tray
                                   (MOBILE_TRAY_CLEARANCE_PX from BottomToolbar) so feedback is never covered
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
    useToolStore.js                Zustand store for the active canvas tool ('pointer' | 'hand' |
                                   'node' | 'text' | 'line') + the spacebarHeld flag + (Chunk 2)
                                   placementGestureActive — true while a placement gesture is
                                   mid-flight (line anchor A placed, B pending); set/cleared by
                                   LinePlacementOverlay. Exports the pure effectiveTool(activeTool,
                                   spacebarHeld, placementGestureActive) derivation — the while-held
                                   spacebar switch never mutates activeTool, so release restores it
                                   by construction, and a mid-flight gesture makes the spacebar a
                                   no-op. Introduced with the bottom toolbar (2026-07-10).
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
    useFtueStore.js                Zustand store + semantics for the FTUE introduction's per-workspace
                                   "completed" flag. localStorage (`mastermind:ftue-done:<workspaceId>`)
                                   — deliberately UX state, NOT a DB column (Erik 2026-07-16; revisit
                                   only if beta demands cross-device). Timeline semantics: only a LOCAL
                                   successful create completes it (noteLocalCreate — called by App's
                                   three creators after persist+recordAction; Realtime inserts never
                                   complete it); undoing a create that EMPTIES the canvas rewinds
                                   (noteUndoResult — wired at both undo call sites, Ctrl+Z + toolbar,
                                   with the PRE-undo node count); delete-to-empty stays completed;
                                   redo of a create completes again (noteRedoResult). Fires ftue_shown /
                                   ftue_completed / ftue_rewound analytics.

  utils/
    labelUtils.js                  sortKey(), labelInitial()
    edgeRouting.js                 getNodeCenter(), getBorderIntersection(), getSpreadBorderPoints()
    altitude.js                    zoom↔altitude math (card↔bead threshold, hysteresis, dynamic
                                   minZoom) + Bead View visual constants
    viewportFraming.js             virtual framing envelope + entry-viewport math (MB-8) + the
                                   empty-workspace entry zoom floor (emptyWorkspaceEntryZoomFloor,
                                   FTUE chunk 1: an empty workspace enters card-side of the live
                                   threshold so the first-created node is a card, never a bead;
                                   occupied workspaces keep pure envelope-fit)

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
    004–013                        is_test_user flag + default flip, campaign→workspace rename, card-media
                                   rename, terms-acceptance, unique connection pairs, workspace snapshot/
                                   activity/last-opened, node hide-avatar (see each file for specifics)
    014_beta_launch_ops.sql        Mox free-beta launch ops (ADR-0017): beta_config (single-row seat cap
                                   + open flag; anon-readable, no write policy), waitlist (anon insert-only
                                   + unique/format guards), profiles.how_heard column, and handle_new_user
                                   extended to capture display_name + how_heard and auto-flip beta_open at
                                   the seat cap (soft cap — never rejects the current signup)

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
| `profiles` | one row per user — canonical home for app-level user metadata (`avatar_path`, `display_name`, `is_test_user`, `how_heard` (signup attribution, added in migration 014), future fields). Auto-created by an `auth.users` INSERT trigger; backfilled in migration 003. `is_test_user` added in migration 004; default flipped to `true` in migration 005 for the invite-only stage. **For the Mox free-beta stage this default is retained** — recording stays on for free beta users under disclosed in-app consent (see [ADR-0017](./docs/decisions/0017-mox-free-beta-launch.md)); ADR-0009's "revert before public launch + tester allowlist" plan applies only to a future fully-public, non-capped launch. Gates whether PostHog loads for that user (ADR-0009 / ADR-0017) |
| `workspaces` | one row per workspace; owned by a user. `cover_image_url` = user-supplied custom cover (display `.full` path); `snapshot_path` = auto-generated canvas snapshot used as the fallback cover (migration 010). A workspace-specific `updated_at` trigger bumps only on name/description/cover changes, so snapshot writes don't count as "modified." `list_workspaces_with_activity()` (migration 011) returns each row + `last_activity_at` for the picker's "Last modified" sort. |
| `node_types` | card types per user (built-in five + any custom); `is_system` flags the built-ins. Per-user scope was introduced in migration 001 — every workspace a user owns shares the same set of types. |
| `nodes` | cards on the canvas (label, summary, avatar_url, position, type_id) |
| `node_sections` | modular sections inside each card: `kind` ∈ `narrative` \| `hidden_lore` \| `dm_notes` \| `media` \| `custom`; `content` is JSONB |
| `connections` | edges between two nodes in the same workspace |
| `text_nodes` | free-floating text annotations on the canvas |
| `lines` | free-standing straight-line annotations (migration 015, ADR-0019): two absolute anchors (`a_x/a_y/b_x/b_y`) + style (`stroke_width` — client default 8; the applied migration's column default of 4 is inert since the app always supplies it — `dashed`, `dash_length`, `dash_gap`, `color` — no color UI yet). Organization tool — never references nodes, structurally cannot become a connection. Realtime publication member + REPLICA IDENTITY FULL; counted in `list_workspaces_with_activity` |
| `beta_config` | single-row launch switch (`seat_limit`, `beta_open`) read pre-auth by the login screen; anon-readable, **no write policy** (flip only via the dashboard). `handle_new_user` auto-flips `beta_open` off at the seat cap. Migration 014 (ADR-0017). |
| `waitlist` | overflow signups when the beta is closed (email + how-heard); **anon insert-only**, unique email + email-format CHECK. Migration 014. |

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

Node/text-block CREATION is optimistic too (QA-1 fix, 2026-07-16 — awaiting the insert first meant seconds of nothing on slow networks): the id is generated client-side (`safeRandomUUID`), the element is added to state immediately, and the insert runs behind it with a rollback (state filter) on failure. The Realtime INSERT echo dedups by id. Two invariants preserved deliberately: the undo entry is recorded only AFTER the insert lands (the dispatcher's existence checks rely on the row being in DB), and the Inspector opens only after the persist (its auto-save UPDATEs the row; an update racing a not-yet-landed insert is a silent lost write).

---

## Key Conventions

### Spacing & sizing — 8pt grid (hard rule)

All pixel values — font sizes, padding, margins, widths, gaps — follow this decision hierarchy:

- **Start with a value divisible by 8.**
- Move to a value divisible by **4** only when the design requirement cannot be satisfied with an 8pt increment.
- Move to a value divisible by **2** only when the requirement cannot be satisfied with either an 8pt or 4pt increment.
- Never use arbitrary values (10, 14, 18, 22, 26, 30…) without explicit, written justification in the same change.
- Measurements extracted from Figma are **observations of design intent, not implementation requirements** — reconcile every extracted value to this hierarchy before implementing. Where a mockup and this rule conflict, **this rule wins.**

This is a hard constraint, in the same category as the chunking, browser-verification, and data-loss-protection rules — apply it in every session.

### System CTA color

`#0284C7` (Tailwind `sky-600`) for all card-type-agnostic action buttons (login, "Create" in CreateTypeModal, "New workspace" in CampaignPicker). **Never reuse a card-type color for system UI.**

### Brand "direct-to-user" voice font — Caveat (`font-hand`)

**Caveat** (Google font, loaded alongside Inter in `index.css`; Tailwind token `hand` in `tailwind.config.js`) is the brand voice for moments the experience speaks to the user as a person — warm, handwritten, personal-note energy. First surface: the FTUE introduction (`FtueIntro.jsx`). Reuse it for future guidance/personal-note surfaces; **never** for regular UI chrome, form copy, or content the user authors. **Leading rule:** any Caveat text that WRAPS uses the `leading-hand` token (0.85 — 85% of the font size; Caveat's generous built-in vertical padding makes sub-1.0 leading read as natural handwriting) so a wrapped sentence still reads as one handwritten note, not loose paragraph copy; single-line Caveat needs no leading class. Established by Erik 2026-07-16.

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
- Active workspace id lives in the URL as `?w=<id>` (WorkspaceContext; the old `mastermind:activeWorkspaceId` localStorage key is LEGACY and actively deleted on mount) — refresh, bookmarks, deep links across sign-in, and back/forward all work off the URL. **Invalid-workspace recovery (bug-2 fix, 2026-07-31):** when signed in and settled, the provider fetches the workspace row (`.maybeSingle()`); a definitive null (deleted OR access lost — indistinguishable under RLS, so copy says "no longer available") clears the id, REPLACES the dead `?w=` history entry (Back can't loop into it), and sets a one-shot `workspaceNotice` the picker renders. Thrown (transient) errors never eject the user; pre-auth nothing is fetched, so deep links survive the sign-in round-trip. KNOWN LIMITATION: a tab with the canvas already open when the workspace is deleted elsewhere gets no live signal — it discovers via failing writes (now surfaced with honest copy via `toastSaveFailed`'s offline-aware wording). Pinned by `WorkspaceContext.test.jsx`.

### Workspace creation

`createWorkspace(name, description)` in `lib/workspaces.js` inserts the workspace row. Built-in node types are seeded **per user** (not per workspace) — `ensureBuiltinTypes()` runs from `useWorkspaceData` on app load and is idempotent, so this function does not seed types itself.

### Hooks layer (`src/hooks/`)

`App.jsx` was 700+ lines after Sprint 1; the post-Sprint-1 refactor pulled four focused hooks out of it. They were extracted so Sprint 1.5 Realtime work had clean places to land instead of more sediment in App.jsx:

- `useSpacebarToolSwitch()` — keyboard listeners for the spacebar's temporary tool switch (replaced `useSpacebarPan` with the bottom toolbar, 2026-07-10); writes `spacebarHeld` into `useToolStore`. App derives `isPanning = effectiveTool(activeTool, spacebarHeld, placementGestureActive) === 'hand'` (the third arg makes the spacebar a no-op while a line gesture is mid-flight, toolbar Chunk 2).
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

Card avatars and content images live in the **`workspace-media` Supabase Storage bucket**, not as base64 inside the database, generated client-side via Canvas at upload time. Per ADR-0005's **2026-06-18 amendment (tiered variants)**, the variant set depends on the image's category:

- **UI-identity images** (node thumbnail): `thumb` (256px) + `full` (1600px) display variants only. WebP.
- **Content/handout images** (Image Section + Album): the same `thumb`/`full` display variants **plus a high-res `printable` artifact** (≤4096px long edge) for download/print. Future paywall gates the printable variant only.
- **Transparency drives the whole format family** (auto-detected via `imageHasAlpha`): a transparent source → **PNG** for all variants; an opaque source → **WebP** display + **JPEG** printable (~0.92).

The DB stores the display path string (avatars) or, for content entries, `{path, alt, uploaded_at, printable_path, printable_format, printable_width, printable_height, printable_bytes}` (JSONB; no migration — `path` stays the `.full` display path so rendering is unchanged). `pathForVariant` swaps the display token (`full`↔`thumb`) while preserving the actual `.webp`/`.png` extension; the printable path has a variable `.jpg`/`.png` ext and is **stored explicitly, never derived**. `deleteCardImage` accepts a string (legacy/UI) or an entry object and removes all present variants (legacy-safe).

- `src/lib/imageStorage.js` owns transcode + upload + delete. Exports `BUCKET_WORKSPACE` and `BUCKET_PROFILE` as the single source of truth for bucket names.
- `src/lib/useImageUrl.js` is the hook every renderer uses; it accepts a value of any shape and returns either a signed URL, a base64 string passthrough, or null. Defaults to `BUCKET_WORKSPACE`.
- `src/components/Lightbox.jsx` is the single shared lightbox (provider + hook); CampaignNode and the Inspector both call `useLightbox().open(value)`.
- **Bucket RLS uses a SECURITY DEFINER helper** (`public.user_owns_workspace_media_path`) instead of inlining the workspace-ownership lookup inside each policy. The inlined version silently fails — the cross-schema query from `storage.objects` to `public.workspaces` returns no rows even when the user owns the workspace, and every upload errors with "new row violates row-level security policy". The helper bypasses RLS on `public.workspaces` while still pinning the check to `auth.uid()`. See [supabase/migrations/002_card_media_bucket.sql](./supabase/migrations/002_card_media_bucket.sql) (original) and [supabase/migrations/007_rename_card_media_bucket.sql](./supabase/migrations/007_rename_card_media_bucket.sql) (renamed in place). **Apply this pattern to any future Storage bucket that needs cross-schema ownership checks.**
- `#migrate` is a temporary hash route to the migration tool ([src/components/MigrateImages.jsx](src/components/MigrateImages.jsx)) for backfilling any base64 entries; once a workspace has zero base64 entries the page reports "Nothing to migrate" and the route can be removed.

### Profile avatars (per migration 003)

User profile avatars live in a **separate `profile-media` Supabase Storage bucket**, distinct from `workspace-media`. Why separate: profile photos are user-scoped (path: `{user_id}/avatar-{timestamp_ms}.webp`), not workspace-scoped, so the access rules differ. Single 256×256 WebP variant — profile avatars never render larger than ~64px in real UI.

- `public.profiles` is the canonical home for app-level user metadata. One row per `auth.users` row, linked 1:1 by `id`. Currently holds `avatar_path`, `display_name` (the latter has no UI yet — schema-ready for future surfaces), and `is_test_user` (added in migration 004; default flipped from false to true in migration 005 — appropriate for the invite-only stage; **retained for the Mox free-beta stage per [ADR-0017](./docs/decisions/0017-mox-free-beta-launch.md)** — recording stays on for free beta users under disclosed in-app consent. The "revert before public launch" plan applies only to a future fully-public, non-capped launch. Gates PostHog loading per ADR-0009 / ADR-0017). Auto-created by an `on_auth_user_created` trigger so app code can assume every signed-in user has a profile row; backfilled in migration 003 for users that pre-date the trigger.
- `src/lib/profile.js` is the data-access layer: `getProfile`, `setAvatarPath`, `clearAvatar`, `setDisplayName`. `clearAvatar` updates the DB column first, then best-effort deletes the storage object — the user-visible state is correct even if the storage delete fails (orphan-cleanup per ADR-0005 §7).
- `src/lib/ProfileContext.jsx` is the shared store. One `getProfile()` per signed-in user, exposed via `useProfile() → { profile, loading, error, updateProfile, refresh }`. Profile.jsx and UserAvatar.jsx both subscribe so an avatar change on the Profile page propagates to the top-left chip immediately, without a reload.
- **The `profile-media` bucket does NOT need a SECURITY DEFINER helper** because its RLS check is same-schema: `(storage.foldername(name))[1] = auth.uid()::text`. The cross-schema gymnastics that `workspace-media` needs only kick in when storage policies have to JOIN against tables in `public`. Profile-bucket policies live entirely against the path prefix and `auth.uid()` — pure storage, no cross-schema lookups.
- The same `UploadImageModal` handles card images and profile avatars. Domain switching is via the `pipeline` prop — `cardImagePipeline` (UI-identity card), `contentImagePipeline` (content/handout, emits the printable + a structured entry object), or `profileAvatarPipeline`, all from `imageStorage.js`. The modal doesn't know the domain. Its **paste** path uses `clipboardImage.js`'s resolver to pick the highest-fidelity clipboard representation (preferring real transparency); it also supports **drag-and-drop** of a file (preserves alpha, like the file picker) and shows a non-blocking note when a pasted content image arrives flattened.
- **`ImageCropper` uses a crop-box interaction model** (Option B rewrite, 2026-06-18): the image is drawn **static** (fit-contain) and the user **moves/resizes a crop box** over it — the inverse of the old "fixed frame, drag the image" model. All geometry is pure + unit-tested in [`src/components/cropGeometry.js`](src/components/cropGeometry.js).
  - Per-mode output: `image-section` (content) = free aspect, source crop ≤4096px; `thumbnail` = 5:4 locked, 560×448; `profile-avatar` = 1:1 locked, 512×512.
  - Handles: four corners every mode; **four mid-edge handles in free-aspect (content) mode only**. Modifiers (all modes): **Ctrl/Alt** scales from the box center, **Shift** locks the ratio while scaling (no-op in fixed-ratio modes).
  - `computeCroppedBlob()` returns **PNG** (lossless) so the upload pipeline owns all final format/quality decisions — emitting JPEG here would flatten transparency before detection runs.
- The **lightbox** ([`src/components/Lightbox.jsx`](src/components/Lightbox.jsx)) offers a compound **Download** control for content images — display version (shown image) vs. printable artifact — labeled with dimensions (and the printable's file size, from the stored metadata).

### Behavioral analytics (per ADR-0009, migration 004)

Session replay + named events via PostHog Cloud. The whole subsystem revolves around the `is_test_user` boolean on `public.profiles`. **Default note:** the column defaulted `false` in ADR-0009's original design, but migration 005 flipped the default to `true`; for the Mox free-beta stage recording stays **on** for free beta users under disclosed in-app consent (in-flow notice + Terms/Privacy clickwrap) — see [ADR-0017](./docs/decisions/0017-mox-free-beta-launch.md), which supersedes ADR-0009's "revert before public launch" assumption.

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

**Visibility (present-state rule, Erik 2026-07-31).** App renders the rail only while the canvas currently has content: `!loading && nodes.length > 0` (App.jsx render site — `nodes` holds ALL object kinds: cards, text blocks, lines). Current state, never history: delete-to-empty re-hides it even after the FTUE completed; any create/undo/remote insert brings it back; `!loading` prevents hydration/switch flashes. Pan/zoom stay live while hidden, and the 64px reserved framing band is unchanged (camera-centering rule). Appearance is instant — first cut. Verified desktop + Android; iPhone unverified.

**Two visual states, driven by mouse position over the rail's container plus drag-in-progress.** Rest: narrow track tucked toward the canvas edge, icons / thumb / label hidden, current-zoom marker simplified to bar + right chevron at half stroke. Active: track widens, icons fade in, thumb appears, label fades in, current-zoom marker becomes the full chevron-bar-chevron at full stroke. The transition is a 220 ms CSS animation on every property (width, position, opacity, stroke width, gradient width).

**Threshold drag.** The thumb is pointer-captured. Its TOP edge tracks the down-trigger zoom (Card→Bead boundary); its BOTTOM edge tracks the up-trigger zoom (= down-trigger × `MORPH_HYSTERESIS_RATIO`). Dragging writes a new `thresholdGridGapMm` to the store. [App.jsx subscribes to that value via `useCanvasUiStore.subscribe(...)`](./src/App.jsx) and re-runs the shared `evaluateAltitude` helper the zoom-driven trigger uses — so a drag that crosses the user's current zoom morphs the canvas in real time, not on the next pan or zoom.

**Highlight semantics differ between states by design.**
- *Active:* highlight top sits at the down-trigger position (= thumb top) and extends UP behind the thumb in BOTH altitudes. Square top corners; the thumb tucks over them. The highlight here reads as "Card View region defined by the current threshold" — the indicator's position vs the thumb tells the user which side they're on.
- *Rest:* no thumb, so the highlight has to reflect the actual altitude on its own. Top edge tracks `altitude`: down-trigger position in Card View (highlight covers the dead-band), up-trigger position in Bead View (highlight is below the indicator). Fully rounded corners.

When the user hovers in/out while in Bead View, the highlight top animates by one dead-band's worth — the visible price of one element representing two different things cleanly.

**Bbox stability for the threshold marker.** `computeMinZoom` uses canonical card dimensions (256 × 180) for every card-type node regardless of what RF currently measures, so a morph between card and bead form doesn't shrink the bounding box (which would otherwise move `dynamicMinZoom`, which would otherwise scoot the threshold thumb up and down the rail every time the user crossed the boundary). Text nodes keep their measured dimensions since they're user-resizable and don't morph.

**Pointer-events trade-off.** The 64 px rail container is `pointer-events: auto` so it captures mouse-enter / mouse-leave reliably without making the user aim for a 4 px line. Cost: marquee-select can't be initiated from the leftmost 64 px of the canvas. Acceptable for an edge-mounted nav tool; the rail slides out of the way on mouse-leave so the expectation of marquee-select is reasonably managed. **DESKTOP ONLY** — see the mobile model below.

**Mobile portrait (explicit touch model, 2026-07-16).** Phones have no hover, and iOS fake tap-hover is nondeterministic — for weeks that made the engaged state (threshold thumb included) unreachable-at-random ("zoom tool opens without the slider"). On `useMobilePortrait`: hover handlers no-op; the 64 px container is `pointer-events: none` (the dead-column fix — left-edge canvas content is tappable again); the ONLY closed-state tap target is a 24 px touch strip over the rail line (tunable, 48 px while open). Tap the strip → opens (never jumps zoom); while open the thumb drags as on desktop and a strip tap jumps zoom; a pointerdown outside the rail closes it via a document listener that never swallows the event (the underlying canvas tap proceeds normally). Scrim: 40 px closed / 96 px open (vs desktop 96/160). Closed visuals per Erik's Figma mockup (265-226): hairline 2 px track + 2 px highlight (desktop rest keeps 4/4), and the zoom marker is an 8 px notch CENTERED on the rail with the arrowhead tip 8 px right of center (`mobileNotch` variant in ZoomIndicatorSvg); open reuses the desktop ACTIVE geometry. Pinned by `AltitudeRail.test.jsx` — including that desktop hover is unchanged.

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

4. **RF v11 has a BUILT-IN spacebar pan activation: `panActivationKeyCode` defaults to `'Space'`.** Internally RF computes `panOnDrag = spacePressed || panOnDragProp` — so while Space is held, RF forces pan mode ON no matter what the prop says. This was invisible while our spacebar behavior agreed with it (space = pan), then broke the bottom toolbar's Hand+spacebar→Pointer switch (chip flipped, drags kept panning). **Workaround:** `panActivationKeyCode={null}` on `<ReactFlow>` (App.jsx) — `useSpacebarToolSwitch` + `useToolStore` are the single owners of the spacebar. Never remove that prop while the tool system exists.

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
- [x] **Beta signup / launch-ops cluster** (ADR-0017, migration 014) — capped signup with soft-cap
  auto-flip + overflow waitlist; "how did you hear?" on both flows; required display name at signup;
  in-flow session-recording notice + beta-promise copy on the signup screen; PostHog identify enriched
  with email + display_name + how_heard. DB-level behaviors verified in prod; the email confirmation
  round-trip (Supabase Site URL), the PostHog-side display of the enriched props, and custom SMTP are
  **not yet verified/configured** — see BACKLOG "Custom SMTP for auth email — LAUNCH BLOCKER."
- [x] Workspace CRUD (create, list, rename, delete, switch)
- [x] RLS policies on every table
- [x] 5 built-in node types seeded per user on first sign-in
- [x] Canvas cards with header, avatar, summary, bullet body, connection dots
- [x] Inspector (card editor): title, type, avatar/thumbnail, summary, story notes, hidden lore, DM notes, media, connections
- [x] Auto-save (400ms debounce, flush on close) — writes to Supabase
- [x] Drag-to-reorder bullets and images in edit modal
- [x] Image lightbox in edit modal
- [x] Right-click canvas → "Add node" (type submenu) / "Add text" / "Add line" — three equal rows (persists to DB)
- [x] Right-click element (node / text block / line) → Duplicate / Delete (persists to DB; Edit + Lock rows removed 2026-07-10)
- [x] Freestanding text nodes (contenteditable, rich text, resize, formatting toolbar, all persisted)
- [x] Canvas pan (spacebar + drag), zoom, marquee selection, shift-click multi-select
- [x] Floating edge routing (border intersection points, dot spreading)
- [x] Luminance-based text color on all type-colored backgrounds
- [x] Zoom-compensated card titles (inverse scale, capped at 5×)
- [x] Dynamic icon visibility at extreme zoom-out (no feedback-loop flicker)
- [x] Icon registry with keyword-based recommendations
- [x] Position persistence on node drag-stop; text node resize persistence on mouseup
- [x] **Image storage** in Supabase Storage; client-side transcode at upload; signed-URL rendering. **Tiered variants** (ADR-0005 2026-06-18 amendment): UI-identity images get `thumb`/`full` WebP; content/handout images additionally get a high-res `printable` artifact (≤4096px) for download/print. **Transparency auto-detected** and drives format (transparent → PNG family; opaque → WebP display + JPEG printable). **Crop-box cropper** (static image, movable/resizable box; corner + content-only edge handles; Ctrl/Alt center-scale, Shift ratio-lock; pure geometry unit-tested in `cropGeometry.js`). **Higher-fidelity paste resolver** + **drag-and-drop** upload (`clipboardImage.js`). **Lightbox compound download** (display vs printable, with sizes). The Inspector's avatar + content uploads write straight to Storage.
- [x] **Shared lightbox** — clicking a card avatar (canvas or modal) or any inspiration tile opens the same overlay.
- [x] **App.jsx refactor** — load lifecycle, edge geometry, hover/select, and spacebar pan all extracted into focused hooks under `src/hooks/`. Hover/select state moved into `useCanvasUiStore` so a hover event no longer re-renders every card.
- [x] Z-index lift — hovered/selected cards rise above their neighbors via a `:has(.is-lifted)` rule.
- [x] **Realtime sync** — Supabase Realtime channel in `useWorkspaceData` mirrors remote `nodes` / `node_sections` / `connections` / `text_nodes` INSERT/UPDATE/DELETE into local state. No echo filter in V1; self-writes round-trip harmlessly. Requires `REPLICA IDENTITY FULL` on each table for DELETE events to pass RLS + filter checks.
- [x] **Inspector decomposition** — the card editor is an orchestration shell composing `<InspectorHeader>`, `<BulletSection>` (×3), `<MediaSection>`, `<ConnectionsSection>`, `<TypePicker>` + `useAutoSave` and `useMorphAnimation` hooks.
- [x] **Float-or-dock Inspector** — the card editor (renamed from EditModal → Inspector, 2026-05-30) opens as a draggable floating modal or a docked bottom-right panel; single-click repoints it to another card, the header drag-detaches between modes, mode persists to localStorage, and the close morph flies toward the node's live position. Non-functional top-right search placeholder reserves the 80px band the docked panel respects. Node-selection dimming softened 0.15→0.45. See [ADR-0015](./docs/decisions/0015-float-or-dock-inspector.md).
- [x] **Component tests** — Vitest + React Testing Library + jsdom; `Inspector.test.jsx` covers open/populate, auto-save, connections, close, avatar upload, per-item bullet undo, repoint commit, docked close, and directional close. Run with `npm test`.
- [x] **Undo / redo** — Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y reverses recent workspace actions. Per-tab, per-(user × workspace), capped at 75. Conflict-aware in both directions (refuses + toasts when state has drifted from another tab's Realtime updates). 15 action types covered (line family added 2026-07-10); sessionStorage-backed for F5 protection. Word-style typing exemption: `Ctrl+Z` inside an input/textarea/contenteditable is left to the browser. See [ADR-0006](./docs/decisions/0006-undo-redo.md).
- [x] **Bottom-left feedback strip** — `FeedbackChipBar` composes the existing `SyncIndicator` (light, ambient "Edited Nm ago") with a chip-toast slot (dark, transient action feedback). Toasts slide in from behind the chip via CSS @keyframes (no JS state ping-pong, no entry delay), masked by an `overflow:hidden` container so no toast pixels are visible left of the chip's left edge. Undo/redo toasts lead with a Phosphor curved-arrow icon (`ArrowUUpLeft` / `ArrowUUpRight`) followed by the entry's label. 2s visible, 300ms fadeout, hover pauses both phases (including freezing the visual opacity transition mid-fadeout). Replaces Sonner for these toasts; persist-fail uses the same chip family with a sticky id.
- [x] **Sign-out cleanup** — `AuthContext.signOut` calls `useUndoStore.clearAllForUser(userId)` before Supabase clears the session, wiping the in-memory undo stack AND every `mastermind:undo:${userId}:*` sessionStorage entry across any workspaces the user touched in this tab.
- [x] **Profile avatars** — Profile page lets the user upload, replace, and remove a profile photo (1:1 crop, 256×256 WebP, stored in the new `profile-media` Supabase Storage bucket). `public.profiles` row holds `avatar_path` + `display_name` (latter has no UI yet). Auto-create trigger on `auth.users` INSERT so every sign-up gets a profile row. Shared `ProfileContext` so the top-left UserAvatar chip updates immediately when the photo changes — same source of truth as the Profile page header. Cropper gains a `profile-avatar` mode (square frame, 256×256 output); UploadImageModal becomes pipeline-agnostic via `cardImagePipeline()` / `profileAvatarPipeline()` factories so the same UI shell handles both image domains. See migration 003.
- [x] **Behavioral analytics + session replay** — PostHog Cloud wired (per ADR-0009). Loads only when `profile.is_test_user === true` via dynamic import (separate Vite chunk; non-testers download zero bytes of `posthog-js`). 16 named events fire at action sites across `App.jsx`, `ConnectionsSection`, `TypePicker`, and `useUndoShortcuts`. `AuthContext.signOut` resets the session so it doesn't bleed across users on the same browser. Three safety guards (conditional load, try/catch on every public call, early bail) ensure non-testers see zero behavioral or performance impact. Password fields are protected by a `.ph-mask` class + PostHog's default `type=password` masking + the fact that the login screen renders pre-init. Migration 004 adds the `is_test_user` boolean column.
- [x] **Altitude rail** — Left-edge instrument that reads navigation state (current zoom, threshold, dynamic minZoom, altitude) and writes back exactly one value (`thresholdGridGapMm`). Two visual states: ambient line at rest, expanded controls (icons + draggable thumb + label + bar-chevron marker) on hover. The thumb's vertical extent IS the hysteresis dead-band; dragging it retunes the Card↔Bead threshold and morphs the canvas in real time (App.jsx subscribes to `thresholdGridGapMm` and re-runs the shared `evaluateAltitude` helper). Highlight semantics differ by state — active reads as "threshold structure," rest reads as "current altitude" — so the rail never lies about which side of the dead-band the user is on. Hue-matched dark scrim behind the UI scales wider when active. See [ADR-0010 addendum (2026-05-15)](./docs/decisions/0010-zoom-progressive-disclosure.md).
- [x] **Block-editor card content (BlockNote)** — Card content lives in a BlockNote block editor, not fixed form fields (ADR-0016). **Phase 1** shipped the data migration: a pure converter (`migrateCardToBlocks`) turns each card's Summary / Story Notes / Hidden Lore / DM Notes / Image Section images into two new `node_sections` kinds — `card_view` (Summary + "Discoverable Lore") and `gm_only` ("Notes" = Hidden Lore + DM Notes merged, + Image Album + a live-reading Connections block). The `#migrate-blocks` one-shot tool (`MigrateBlocks.jsx`) runs it: dry-run preview by default, explicit apply that writes idempotently (only the two new kinds) then reads back and verifies zero loss. No DB migration needed (the `kind` column is unconstrained). **Connections are NOT copied into block content** — they stay first-class rows; the block reads them live. **Phase 2 shipped the editor itself** — the Inspector lazy-loads the BlockNote editor (`src/components/editor/CardZones.jsx`, its own chunk, loaded only when a card opens) and reads/writes `card_view` + `gm_only` live; at the "E4 cutover" the Inspector's `EDITABLE_FIELDS` narrowed to `label`/`type`/`avatar` + connections. **Legacy section rows (`narrative`/`hidden_lore`/`dm_notes`/`media`) are no longer read by the UI but are NOT deleted** — legacy cleanup is a future, separate tool + ADR. No-loss is proven test-first (`migrateCardToBlocks.test.js`) and the verifier is proven to catch loss (`blockMigration.test.js`); real run migrated + verified all 108 cards in Erik's campaign, 0 failures.
- [x] **Workspace picker overhaul** — CampaignPicker is now a responsive gallery grid. (1) **New-workspace control**: a secondary-button frame (top-right) that container-morphs (grows width + height) into a full-width "name your workspace" frame with the input + Cancel + Create materializing inside; sits in a fixed-height band so the grid never shifts. (2) **Custom covers**: per-tile Set/Change/Remove via the "…" menu, uploaded through `UploadImageModal` in the `workspace-cover` cropper mode (16:9, 1536×864) → `workspaceCoverPipeline` (thumb/full WebP), stored in `cover_image_url` (no migration; the column pre-existed). (3) **Auto-snapshot fallback cover**: on leaving a workspace, the WHOLE canvas graph is captured (html-to-image, all nodes) behind a "Saving changes…" spinner and stored in `snapshot_path` (migration 010 + a workspace-only `updated_at` trigger so snapshots don't count as edits). Render precedence cover → snapshot → bare canvas color (no more letter placeholder). Circular thumbnails added to the UserMenu workspace switcher (shared `WorkspaceThumbnail`). (4) **Sort**: Alphabetical / Date created / Last modified, client-side + localStorage; "Last modified" uses the real newest-edit timestamp from `list_workspaces_with_activity()` (migration 011). **Requires migrations 010 + 011.**
- [x] **Edge-hover dual-expand + stabilized session (Bead View)** — Hovering a connection line in Bead View expands **both** endpoint nodes into readable cards (Part B of the edge-hover work; Part A shipped the highlight-only pass in `d360640`). Tied to [ADR-0010](./docs/decisions/0010-zoom-progressive-disclosure.md). Three layers:
  - **Dual-expand machinery.** The single-expanded-node model was generalized to a keyed collection: `useCanvasUiStore.expandedNodes` is now a `Map<id, record>` (each card publishes/clears its own entry, so two never contend); `CampaignNode.isExpanded` gains an edge-highlight clause; `useEdgeGeometry.formOf` looks up per-node; `App.jsx` fires the per-node line-fade morph by diffing a *set* of expanded ids; `QuickConnectLine` reads the map. The clamp/drift/counter-scale and `nodeMorphPhases` were already per-node, so they came along unchanged.
  - **Hover stabilization (`useEdgeHoverSession.js`).** Expanding tall cards re-routes the hovered line off the cursor and slides cards under it, which made naive React-Flow edge hover flicker and steal. Fix: **separate activation from persistence.** React Flow's `onEdgeMouseEnter` (after a 200ms dwell) *starts* a session via `beginEdgeSession({edgeId, sourceId, targetId, aFlow, bFlow})` — plain data, so a future custom picker can call the same seam. Once active, the **session** owns deactivation via its own screen-space hit-test against a **UNION** alive region (no contiguity assumed): the frozen original corridor + the live re-routed line (from `edgesRef`) + the band between them (two triangles over the 4 endpoints) + both card rects. It **ignores** React Flow's leave event; exits only on leaving that union for `EDGE_SESSION_EXIT_GRACE_MS` (~150ms). Session-expanded cards are `pointer-events:none` (scoped to edge-hover expansion only, gated on `isEdgeHighlighted`, so selection/node-hover expansion keep normal pointer behavior). RF `interactionWidth` widened (40, tunable) as an activation aid only. "Ignore other edges during a session" is a single localized guard — the seam where Pass 2 (nearest-edge arbitration) plugs in.
  - **Geometry fidelity.** (a) Card-view dot declustering is now **screen-constant** like bead view — `getSpreadBorderPoints` takes a `minGap`/`cornerPad` param and `useEdgeGeometry` feeds `(dot+pad)/zoom`, so aligned connection dots no longer collapse together when zoomed out. (b) **Pairwise card repulsion**: two close cards push apart on expansion (visual-only offset added to the transform + published center, never `node.position`; restored on collapse). Repulsion reads each partner's published **natural** (pre-clamp, pre-repel) center to stay loop-free, and chooses its push axis from the **beads' dominant separation axis** (`|dx|` vs `|dy|`) so side-by-side beads stay side-by-side and stacked stay stacked, with a viewport-overflow fallback that keeps the upper node's card higher. Decoupled from the viewport-clamp (purely additive). Constants (`EDGE_*`, `REPEL_PAD_FRACTION`) centralized in `altitude.js`. Deferred (future-compatible, not built): click-to-pin, Pass 2 nearest-edge arbitration / zoom-adaptive corridor.
- [x] **Line tool — free-standing canvas annotations (ADR-0019, migration 015)** — Straight two-anchor lines for organizing the canvas visually without creating false node relationships. Own `lines` table (never references nodes); rendered as a `lineNode` RF node whose position is the padded anchor-bbox top-left (`linePositionFor`, translation-invariant so whole-node drag = anchor translation). Placement via the bottom toolbar's Line tool OR Canvas Tool Menu → "Add line" (both arm through `useToolStore` since toolbar Chunk 2, 2026-07-15) → `LinePlacementOverlay` (desktop click-move-click, touch press-drag-lift; **Shift constrains to the 4 axes** through the fixed anchor via `snapToAxis` — drawing AND endpoint re-anchoring; **Esc is the only cancel** — right-click-cancel removed in Chunk 2: pre-anchor it opens the normal menus, mid-gesture it's ignored; **edge-pan after anchor A** replaces the old pan/zoom freeze — the preview is flow-space anchored, so wheel pan/zoom works mid-draw too). Selection shows `LineStyleToolbar` (weight default 8 + dash length/gap as direct type-in fields, solid/dashed toggle, delete) + draggable endpoint handles; right-click a line for Duplicate/Delete (same simplified menu as nodes + text blocks). Full undo family (create/move/edit/deleteLine), batch-delete + multi-duplicate membership, Realtime mirroring, activity-sort inclusion. Deliberately narrow: no curves, no polylines, no color UI (column exists, default only). React Flow attribution removed in the same pass (MIT verified; maintainer request only — revisit if we ever subscribe to RF Pro).

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
| Media feature naming | Code, UI, and docs say "Image Album" (the live block-editor block), "Image Section" (the legacy fielded section), and `MediaSection.jsx`; migration content seeds an "Inspiration" heading. | **The product feature is the MEDIA GALLERY** (Erik, 2026-07-30): images today, envisioned to hold video, audio, and potentially files. "Inspiration" is a seeded example heading above one Media Gallery — never the feature name. | Full front-to-back naming alignment is deliberately POST-LAUNCH (Erik: getting the product in front of users outranks terminology alignment — see the BACKLOG item). Until that pass, use "Media Gallery" in product/design discussions and new docs; treat the older names in code and historical docs as implementation debt, and don't rewrite history entries. |

When code drifts from design intent in a way that can't be cleanly resolved in the same pass, add a row here documenting: the area, the current reality, the design-doc state, and why it's logged. Then update [`docs/design/design-system.md`](./docs/design/design-system.md) or write an ADR to close the gap when convenient.

When code drifts from design intent in a way that can't be cleanly resolved in the same pass, add a row here documenting: the area, the current reality, the design-doc state, and why it's logged. Then update [`docs/design/design-system.md`](./docs/design/design-system.md) or write an ADR to close the gap when convenient.
