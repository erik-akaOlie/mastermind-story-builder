# Changelog

A running log of meaningful changes to MasterMind: Story Builder. Append-only. Newest at top.

## [Unreleased]

### Inspector — float-or-dock card editing surface (2026-05-30)

The card-editing surface (formerly "EditModal") is now the **Inspector**,
and it can live in two places: an undocked floating modal that morphs out
of the clicked card (the previous behavior), or a docked panel pinned to
the bottom-right of the canvas. A single click on another card while the
Inspector is open **repoints** it at the new card instead of closing and
reopening — the same surface re-binds to a new card via an inspector-
instance model rather than a teardown/rebuild cycle. A detach gesture pops
a docked Inspector back into a floating modal, and the Inspector remembers
which mode it was last in so the next open honors the user's preference.
Close is directional: a docked Inspector slides down off the bottom edge,
a floating Inspector morphs back into its origin card.

Alongside the Inspector work, a non-functional **search bar placeholder**
landed in the top-right (visual scaffolding for the real search feature),
and the node-selection dimming was softened so unselected cards recede but
stay readable.

**Added**
- Undocked draggable Inspector — the floating modal can be grabbed and
  repositioned (Chunk 1).
- Single-click repoint + inspector-instance model — clicking a different
  card while the Inspector is open re-binds the existing surface to the new
  card instead of closing and reopening
  ([`src/App.jsx`](./src/App.jsx),
  [`src/components/Inspector.jsx`](./src/components/Inspector.jsx),
  [`src/hooks/useMorphAnimation.js`](./src/hooks/useMorphAnimation.js),
  [`src/nodes/CampaignNode.jsx`](./src/nodes/CampaignNode.jsx)).
- Docked mode — Inspector can dock as a bottom-right overlay panel
  ([`src/components/Inspector.jsx`](./src/components/Inspector.jsx),
  [`src/components/InspectorHeader.jsx`](./src/components/InspectorHeader.jsx),
  [`src/index.css`](./src/index.css)).
- Detach gesture, mode memory, and directional close — docked detaches to
  floating; the last-used mode is remembered across opens; close animation
  matches the current mode (slide-down docked, morph-to-card floating).
- Top-right search bar placeholder + smoother hover morph
  ([`src/components/SearchBar.jsx`](./src/components/SearchBar.jsx),
  [`src/components/HoverReveal.jsx`](./src/components/HoverReveal.jsx),
  [`src/components/UserMenu.jsx`](./src/components/UserMenu.jsx)). The
  search bar is visual-only — no query logic yet.
- 3 Inspector tests covering repoint commit, docked close, and directional
  close ([`src/components/Inspector.test.jsx`](./src/components/Inspector.test.jsx)).

**Changed**
- Node-selection dimming softened from `0.15` to `0.45` opacity in
  [`src/nodes/CampaignNode.jsx`](./src/nodes/CampaignNode.jsx) — testers
  found the original dim too aggressive; unselected cards now recede but
  stay legible.

**Renamed**
- `EditModal.jsx` → `Inspector.jsx`, `EditModalHeader.jsx` →
  `InspectorHeader.jsx`, `EditModal.test.jsx` → `Inspector.test.jsx`
  (components `EditModal` → `Inspector`, `EditModalHeader` →
  `InspectorHeader`); App state `editingNode` → `inspectorNode`. The "edit
  modal" terminology is retired in favor of "the Inspector" throughout code
  comments and docs.

### Legal — agreements, in-app policy pages, and self-serve account deletion (2026-05-26 – 2026-05-27)

Pre-tester-invite legal groundwork. New users now agree to the Terms of
Service and Privacy Policy at signup, both documents are readable in-app at
`/#terms` and `/#privacy`, and users can delete their own account end-to-end
without contacting anyone.

**Added**
- Terms of Service + Privacy Policy drafts under
  [`docs/legal/`](./docs/legal/).
- In-app `/#terms` and `/#privacy` hash routes
  ([`src/components/LegalDocPage.jsx`](./src/components/LegalDocPage.jsx),
  [`src/components/TermsOfServicePage.jsx`](./src/components/TermsOfServicePage.jsx),
  [`src/components/PrivacyPolicyPage.jsx`](./src/components/PrivacyPolicyPage.jsx),
  wired in [`src/main.jsx`](./src/main.jsx)).
- Signup-time agreement to ToS + Privacy Policy
  ([`src/components/Login.jsx`](./src/components/Login.jsx),
  [`src/lib/AuthContext.jsx`](./src/lib/AuthContext.jsx)); acceptance
  recorded on the profile row.
- Self-serve account deletion — a Supabase Edge Function
  ([`supabase/functions/delete-account/index.ts`](./supabase/functions/delete-account/index.ts))
  that tears down the user's data and auth record, fronted by a "Delete
  account" button with an email-confirmation modal in
  [`src/components/Profile.jsx`](./src/components/Profile.jsx).

**Changed**
- The in-app delete flow is now the **primary** account-deletion path in the
  policy docs ([`docs/legal/privacy-policy.md`](./docs/legal/privacy-policy.md),
  [`docs/legal/terms-of-service.md`](./docs/legal/terms-of-service.md)).

**Migration/SQL**
- [`supabase/migrations/008_profiles_terms_acceptance.sql`](./supabase/migrations/008_profiles_terms_acceptance.sql)
  — adds terms-acceptance tracking to `public.profiles`.

### campaign → workspace rename (2026-05-18 – 2026-05-19)

Closes [ADR-0012](./docs/decisions/0012-rename-campaign-to-workspace.md). The
architectural object previously called "campaign" is now "workspace"
throughout the data-access layer, contexts, hooks, DB queries, Realtime
subscriptions, persistence keys, tests, and user-facing copy. Representation-
level holdouts (`CampaignNode.jsx`, the `'campaignNode'` RF type id,
`CampaignPicker.jsx`) are deliberately retained per ADR-0012's entity-vs-
representation principle and logged as Known Divergences.

The Storage bucket was renamed in the same pass: `card-media` →
`workspace-media`. A render regression on 2026-05-18 — hardcoded bucket-name
string literals left pointing at the old name — was fixed by routing every
consumer through the `BUCKET_WORKSPACE` constant in
[`src/lib/imageStorage.js`](./src/lib/imageStorage.js).

**Changed**
- `lib/campaigns.js` → [`src/lib/workspaces.js`](./src/lib/workspaces.js);
  `CampaignContext` / `useCampaignData` → `WorkspaceContext` /
  `useWorkspaceData`.
- DB queries, Realtime filters, props, and user-facing copy updated to
  workspace terminology.
- Persistence keys migrated (`mastermind:activeWorkspaceId`) with a
  backwards-compat shim for the old localStorage key.
- Tests updated to the new names.

**Fixed**
- Image-render regression from hardcoded bucket strings — all bucket-name
  references now flow through `BUCKET_WORKSPACE` / `BUCKET_PROFILE`; no
  hardcoded literals remain.

**Migration/SQL**
- [`supabase/migrations/006_rename_campaigns_to_workspaces.sql`](./supabase/migrations/006_rename_campaigns_to_workspaces.sql)
  — renames the `campaigns` table → `workspaces` and dependent columns.
- [`supabase/migrations/007_rename_card_media_bucket.sql`](./supabase/migrations/007_rename_card_media_bucket.sql)
  — renames the bucket to `workspace-media` and its RLS policies/helper in
  place; drops the deprecated `card-media` policies (the bucket itself is
  retained briefly as a rollback artifact, scheduled for deletion).

**Note**
- `card-media` is deprecated, not deleted — clients can no longer read or
  write it. Permanent deletion is a deferred Stage 5 cleanup task.

### Zoom progressive disclosure — Bead View + Altitude Rail (2026-05-12 – 2026-05-15)

Implements [ADR-0010](./docs/decisions/0010-zoom-progressive-disclosure.md)
and its 2026-05-15 addendum. The canvas zoom-out limit no longer caps below
the threshold needed to see a meaningful slice of a campaign at once. As the
user zooms past a tuned altitude, every card morphs from its full rectangular
form into a compact circular **bead**; zooming back in morphs it home. A
left-edge **Altitude Rail** visualizes navigation state and lets the user
retune the morph threshold by dragging.

**Added**
- Altitude state + zoom-threshold trigger driving the Card↔Bead morph; a
  production threshold, dynamic minZoom, and reduced-motion handling
  (Bead View Chunks A–F).
- Card↔bead morph visual: a card collapses to a circular bead with a label
  initial as the no-thumbnail fallback (revises ADR-0010 in commit 401303a).
- Circular connection-point routing for beads;
  [`src/utils/edgeRouting.js`](./src/utils/edgeRouting.js) refactored to take
  rect params so card and bead geometry share one routing path. Crowded-bead
  dot distribution sorts by natural angle and anchors to the natural
  midpoint.
- Hover-expand: hovering a bead temporarily expands it to card form, with
  edges re-routing to the expanded card's visible edges and a per-node morph
  signal; drag-with-frozen-clamp + drop-drift handling so a bead can be
  repositioned while expanded.
- [`src/components/AltitudeRail.jsx`](./src/components/AltitudeRail.jsx) —
  left-edge instrument that reads navigation state (current zoom, threshold,
  dynamic minZoom, altitude) and writes back exactly one value
  (`thresholdGridGapMm`). Two visual states (ambient line at rest, expanded
  controls on hover); the draggable thumb's vertical extent IS the hysteresis
  dead-band, and dragging it retunes the threshold and morphs the canvas in
  real time. Includes click-to-zoom, log-normalized scale, hue-matched scrim,
  and a11y.

**Changed**
- Bbox stability: `computeMinZoom` uses canonical card dimensions
  (256 × 180) for every card-type node regardless of measured size, so a
  card↔bead morph doesn't shift the bounding box and scoot the threshold
  thumb up and down the rail.

**Trade-offs accepted**
- The 64px rail container is `pointer-events: auto`, so marquee-select can't
  be initiated from the leftmost 64px of the canvas — acceptable for an
  edge-mounted nav tool that slides out of the way on mouse-leave.

### Behavioral analytics + session replay — PostHog Cloud, tester-gated (2026-05-11)

Implements [ADR-0009](./docs/decisions/0009-behavioral-analytics-session-replay.md).
Session replay plus ~16 named events via PostHog Cloud, restricted to invited
testers. The whole subsystem revolves around an `is_test_user` boolean on
`public.profiles` — false for everyone by default. Non-testers download zero
bytes of `posthog-js`.

**Added**
- [`src/lib/analytics.js`](./src/lib/analytics.js) — all PostHog
  interaction. `posthog-js` is fetched via dynamic `import()` (its own Vite
  chunk, ~64 KB gzipped) only after `profile.is_test_user === true` is
  confirmed. Three safety guards: conditional load, try/catch on every public
  function, and early-bail on `track()`/`resetAnalytics()` when init never
  ran.
- [`src/components/AnalyticsBootstrap.jsx`](./src/components/AnalyticsBootstrap.jsx)
  — mounted inside `<ProfileProvider>`; watches the profile and fires the
  idempotent `initAnalytics(profile)` on load.
- ~16 named events wired at action sites across
  [`src/App.jsx`](./src/App.jsx), `ConnectionsSection`, `TypePicker`, and
  [`src/hooks/useUndoShortcuts.js`](./src/hooks/useUndoShortcuts.js). Three
  events use windowing/timer logic (`zoom_changed`, `pan_burst`,
  `card_repositioned_quickly`).
- Password protection layered, not selector-based: the login screen renders
  pre-init, PostHog's default `type=password` masking, and a `.ph-mask`
  class honored by `maskInputFn`/`maskTextFn` even when the user toggles the
  show-password eye.

**Changed**
- `AuthContext.signOut` now also calls `resetAnalytics()` so a tester's
  PostHog session/identity can't bleed across users on the same browser.
- Per the ADR revision (commit cb85d5d): **no content masking** in the
  canvas — the words testers type are themselves research signal.

**Migration/SQL**
- [`supabase/migrations/004_is_test_user_flag.sql`](./supabase/migrations/004_is_test_user_flag.sql)
  — adds the `is_test_user` boolean to `public.profiles` (default false).
- [`supabase/migrations/005_default_test_user_true.sql`](./supabase/migrations/005_default_test_user_true.sql)
  — flips the default to true for the invite-only stage. **Revert before
  public launch.**

**Note**
- `VITE_POSTHOG_KEY` must be set at **build time** — Vite substitutes the
  literal at build, and an empty value lets Rollup dead-code-eliminate the
  dynamic `posthog-js` import entirely.

### Profile avatars + `public.profiles` table (2026-05-09)

Users can now upload, replace, and remove a profile photo from a Profile
page. Profile avatars get a 1:1 crop, a single 256×256 WebP variant, and live
in a dedicated `profile-media` Storage bucket distinct from card media.
Introduces `public.profiles` as the canonical home for app-level user
metadata, auto-created per user by an `auth.users` INSERT trigger.

**Added**
- [`public.profiles`](./supabase/migrations/003_profiles_and_profile_media.sql)
  — one row per user (`avatar_path`, `display_name` — no UI yet —
  timestamps), linked 1:1 to `auth.users`, with an `on_auth_user_created`
  trigger plus a backfill for pre-existing users.
- [`src/lib/profile.js`](./src/lib/profile.js) — data-access layer
  (`getProfile`, `setAvatarPath`, `clearAvatar`, `setDisplayName`).
  `clearAvatar` nulls the DB column first, then best-effort deletes the
  Storage object.
- [`src/lib/ProfileContext.jsx`](./src/lib/ProfileContext.jsx) — shared store
  (`useProfile() → { profile, loading, error, updateProfile, refresh }`) so
  the Profile page header and the top-left UserAvatar chip share one source
  of truth; an avatar change propagates without a reload.
- Profile page UI ([`src/components/Profile.jsx`](./src/components/Profile.jsx))
  and UserAvatar integration ([`src/components/UserAvatar.jsx`](./src/components/UserAvatar.jsx)),
  routed at `/#profile` in [`src/main.jsx`](./src/main.jsx).
- Shared image pipeline: `UploadImageModal` becomes domain-agnostic via
  `cardImagePipeline()` / `profileAvatarPipeline()` factories in
  [`src/lib/imageStorage.js`](./src/lib/imageStorage.js); `ImageCropper`
  gains a `profile-avatar` mode (square 256×256 frame + output).

**Migration/SQL**
- [`supabase/migrations/003_profiles_and_profile_media.sql`](./supabase/migrations/003_profiles_and_profile_media.sql)
  — creates the `profiles` table + trigger + backfill and the `profile-media`
  Storage bucket with same-schema RLS (path prefix `= auth.uid()`; no
  SECURITY DEFINER helper needed since there's no cross-schema lookup).

### Sprint 3 — Image upload + cropper (2026-05-08)

A new Upload Image modal replaces the old direct-to-Storage file
picker for both card thumbnails and image-section tiles. Users can
pick a file or paste from the clipboard, position and scale the
image inside a crop frame, and Save commits a single coherent
upload. Per [ADR-0007](./docs/decisions/0007-deferred-image-persistence.md),
no Storage or DB writes happen until the user explicitly Saves;
Cancel discards everything cleanly.

Two cropping modes:

- **Image-section mode** (e.g., the "Inspiration" section). Frame
  defaults to the source image's natural aspect ratio (clamped to
  1:3–3:1). Four corner handles on the frame let the user reshape it
  freely within those bounds; default anchor is the opposite corner,
  Ctrl/Alt switches to symmetric (anchor at frame center). Image
  cover-fits the frame; mouse wheel zooms within cover-min and 5x
  cover. Saved output capped at the 1920×1080 strict box.
- **Thumbnail mode** (the card avatar). Frame is a fixed 280×224
  rectangle centered in the cropper canvas. No frame corner handles.
  Source larger than the frame enters at native pixel size with its
  top-left aligned to the frame's top-left, bleeding right and
  bottom. Source smaller scales up to cover. The image gets four
  corner handles for uniform scaling; same modifier convention as
  image-section. Saved output is exactly 280×224.

The card thumbnail's pencil edit-button is replaced by a Phosphor
`Swap` icon. Clicking opens the Upload Image modal pre-loaded with
the existing thumbnail; from there the user can re-crop, paste a
new image, or click an in-cropper "Remove image" button. Remove
clears the cropper to the empty state and marks the modal as
pending-removal — the user has to press Save to commit (which
deletes the old variants from Storage), or Cancel to discard.
Empty-state thumbnail click opens the modal in fresh-upload mode.

Image-section tiles keep their existing × / + flow — no in-place
replace. To swap a tile, the user removes (×) and uploads a new
one (+).

**Added**
- [`src/components/UploadImageModal.jsx`](./src/components/UploadImageModal.jsx)
  — the modal itself. Document-level paste listener (capture phase)
  so it fires before any focused input's paste handler. Esc handler
  also uses capture phase + `stopImmediatePropagation` so closing
  the upload modal doesn't bubble up and close the parent EditModal.
  OS-aware paste-key label (Cmd+V on Mac, Ctrl+V elsewhere).
- [`src/components/UploadImageProvider.jsx`](./src/components/UploadImageProvider.jsx)
  — context that lets components inside an EditModal open the
  modal. Mirrors LightboxProvider.
- [`src/components/ImageCropper.jsx`](./src/components/ImageCropper.jsx)
  — the cropper component. `forwardRef` so the parent modal can ask
  for the cropped Blob on Save via `computeCroppedBlob()`. Pointer
  events with capture for drag tracking; native wheel listener
  (`{ passive: false }`) so `preventDefault` on zoom doesn't trip
  React 18's passive-by-default behavior on root-level synthetic
  listeners. Cropper canvas has a slightly grey background
  (`bg-gray-100`) so pure-white images keep visible edges against
  the crop surface.
- [ADR-0007](./docs/decisions/0007-deferred-image-persistence.md)
  — records the deferred-save pattern: image data is held in
  browser memory between paste/pick and Save; no Storage or DB
  writes until the user explicitly commits. Deliberate exception to
  ADR-0003's optimistic-write rule, scoped to the
  staging-not-commitment user state of the upload modal.

**Changed**
- [`src/components/MediaSection.jsx`](./src/components/MediaSection.jsx)
  — the +Add button now opens the Upload Image modal via
  `useUploadImage().open(...)` instead of triggering a hidden file
  input directly. Removed the parallel-upload tracking
  (`uploadingCount`, spinner placeholders, `currentItemsRef`) — the
  modal handles one image at a time and shows its own progress.
- [`src/components/EditModalHeader.jsx`](./src/components/EditModalHeader.jsx)
  — pencil edit-button replaced with Phosphor `Swap`. Empty-state
  avatar click and Swap button click both route through the Upload
  Image modal in thumbnail mode. Removed the local upload-progress
  state and the file input.
- [`src/components/Inspector.jsx`](./src/components/Inspector.jsx)
  — wrapped in `<UploadImageProvider>` so MediaSection and
  EditModalHeader can reach the modal.

**Trade-offs accepted**
- **Replace asymmetry between thumbnail and image-section.** The
  thumbnail supports single-click replace via the Swap button;
  image-section tiles don't (they use × + + only). Justified by
  frequency: swapping a card's avatar is routine, replacing an
  image-section tile is rare and the existing × → + flow is two
  single clicks anyway.
- **No re-cropping a previously-saved image without supplying a
  new file.** The cropper is reached only via fresh upload
  (image-section) or via Swap (thumbnail). When re-cropping a saved
  thumbnail, the user is working with the previously-cropped,
  capped output — the original source is not retained.
- **No drag-and-drop, no web-address upload.** File picker +
  clipboard paste only.
- **Multi-image clipboards take the first silently.** Multiple
  images on the clipboard aren't a supported batch path.
- **Storage orphan window on undo of a removal/replace.** Replace
  and remove paths delete the old image's two variants best-effort.
  If the user undoes the resulting `editCardField` action, the
  database reference is restored but Storage no longer has the file
  — the rendered avatar will fail to load. The orphan-cleanup
  script (ADR-0005 §7) is the long-term fix for the inverse
  direction; tightening the Save → DB-update → Storage-delete
  ordering is on the table if this becomes an issue in practice.

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
