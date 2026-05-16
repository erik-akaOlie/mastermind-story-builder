# BACKLOG.md — MasterMind: Story Builder

A living backlog. The numbered Sprint 2 / 3 / 4 / 5 roadmap that previously
lived in CLAUDE.md / README.md is retired in favor of this doc — sequential
sprint plans don't survive contact with reality once the backlog grows past
a handful of items with real dependencies.

Items are organized by **Value Add** band — the kind of value the work
delivers (Quick Win, Foundational Progress, Strategic Bet, Exploration). See
[`docs/product/glossary.md`](./docs/product/glossary.md) for vocabulary.
Version-level scope (V1, V2+, V3+, out) lives in [`docs/product/roadmap.md`](./docs/product/roadmap.md).

---

## How this works

- **Living doc.** Items get added, dropped, and re-ranked sprint over sprint.
  The current band placement captures *current* belief, not a contract.
- **Reviewed at the start of each sprint.** What's in the next sprint is
  decided then, with the latest information — not weeks in advance.
- **A "sprint" = 1–2 weeks of working sessions.** Not a strict timebox — a
  unit of planning.
- **Each sprint mixes size.** One Foundational Progress / Strategic Bet
  item + 2–3 Quick Win / Exploration items. Pure-big sprints stall
  mid-feature; pure-small sprints lose momentum on foundational work.
- **Strategic Bet items get a spike first.** A spike is 1–2 days max —
  prototype the riskiest piece, write findings, *then* decide whether to
  commit the rest of the sprint to it.
- **Each item has a problem statement, success criteria, and dependencies.**
  No code until those three exist (per project process preference).
- **Done items live in CHANGELOG.md, not here.** This doc is forward-looking
  only.

## Sizing convention

| Size | Roughly |
|---|---|
| S  | < 1 day |
| M  | 1–3 days |
| L  | 4–10 days (a sprint's "big thing") |
| XL | needs a spike + multi-sprint commit |

---

## Current sprint candidate — next

The previous sprint shipped **Profile avatars + canvas UX polish**
(see [CHANGELOG.md](./CHANGELOG.md)). The next sprint is **planned
and locked** (2026-05-11 conversation):

**Sprint shape: "Open the doors to testers."** Two pieces of new work
sequenced into three deliverables, with two weeks of runway before
the first tester invites go out.

| # | Deliverable | Band | Size |
|---|---|---|---|
| 1 | Behavioral analytics + session replay (PostHog, invited testers only) | Foundational Progress | S–M (3–4 days) |
| 2 | Zoom-to-node-view v1 (morph + interaction, no perf optimization) | Foundational Progress | M–L (7–10 days) |
| — | **Invites go out** | | |
| 3 | Zoom-to-node-view v2 (viewport + connection-line culling for 500-card scale) | Foundational Progress | M (3–5 days) |

**Why this shape.** Erik wants to invite ~5–10 DMs to start using the
product within the next two weeks. Two pieces of work are
invite-blocking. First, analytics needs to be live before invites or
the early-tester signal is lost — session replay + a small set of
named events tied to research questions about cognitive friction (graph
mental model adoption, "feels alive" moments, where overload sets in).
Second, the current zoom-out limit is critical daily friction for Erik
(blocking demos, structural campaign assessment, and spatial placement
decisions); testers experiencing the wounded zoom on day one would burn
research budget on a known problem.

**Sequencing decision (Option B from the 2026-05-11 conversation).**
Analytics ships first as the "if anything else slips, this is still
done" insurance. Zoom v1 follows. Then invites go out with both pieces
live. Zoom v2 (the 500-card performance optimization) ships during the
early observation period — tester campaigns will start small and won't
hit the scaling wall for weeks.

**Three previously-queued items defer behind this sprint:** Card-type
defaults in code, Manage Card Templates, Markdown export. The Quick
Win *Fix stale EditModal avatar-upload test* (committed `0274693`)
slots in opportunistically alongside any of the above.

**Documented in:**
[ADR-0009](./docs/decisions/0009-behavioral-analytics-session-replay.md)
(analytics) and
[ADR-0010](./docs/decisions/0010-zoom-progressive-disclosure.md)
(zoom-to-node-view).

---

## Quick Win

### Campaign thumbnail images
- **Problem.** Campaigns are currently text-only on both surfaces where
  users pick between them — the CampaignPicker home screen and the
  UserMenu breadcrumb dropdown. As a tester or DM accumulates campaigns,
  scanning by name alone is slower than scanning visually. The pattern
  is well-trodden: every comparable tool (Notion, Roll20, Kanka) uses
  campaign / workspace thumbnails for the same reason.
- **Success.** Each campaign carries an optional thumbnail image. Two
  render sites:
  - **CampaignPicker** — thumbnail visible on each campaign card/tile;
    "Edit thumbnail" affordance per campaign.
  - **UserMenu breadcrumb dropdown** — small circular crop next to each
    campaign name in the in-place switcher (the §7.6 surface).
  Images upload via the existing UploadImageModal (reuse
  `profile-avatar` cropper mode for 256×256 square — circular crop on
  the dropdown is CSS-only). New `campaignThumbnailPipeline()` factory
  in `imageStorage.js` mirroring `profileAvatarPipeline()`. New
  `thumbnail_path` column on `campaigns` table via migration.
- **Notes.** Architecture pattern from migration 003 (profile avatars)
  carries directly. Decision point during build: which Storage bucket
  hosts the images — `card-media` (campaign-scoped, RLS already
  configured for ownership) or `profile-media` (user-scoped). Probably
  `card-media` since campaigns are campaign-scoped objects.
- **Dependencies.** None — strictly additive.
- **Sequencing.** Deliberately deferred from the 2026-05-16 session
  after surfacing as a candidate alongside Zoom v2 / invites. Slot
  alongside Zoom v2 or just after; should land before invites if
  schedule allows.
- **Size:** S+ (4-8 hours focused).

### Dynamic card width
- **Problem.** Long words and long titles in card headers either overflow
  or get cut off. Cards are fixed-width.
- **Success.** Card width grows to fit content within sane bounds
  (min / max width). Long words wrap rather than overflowing. No header
  text is cut off or unreadable.
- **Notes.** Needs a design pass on the min / max bounds and how it
  interacts with React Flow layout. Doesn't change persistence shape.
- **Size:** M

---

## Foundational Progress

> All items in this section target **V1** unless otherwise noted. Order
> within the band reflects current sequencing intent, but is reviewed
> sprint-by-sprint.

### Behavioral analytics + session replay (PostHog)
- **Problem.** Erik plans to invite ~5–10 DMs to start using the product
  in the next two weeks. The biggest product risk right now is not "is
  feature X used" — it's "do real DMs build the right cognitive
  relationship with the graph mental model?" Without instrumentation,
  the early-tester period is wasted: friction signals (cognitive
  overload, abandoned connection attempts, rage clicks, zoom thrash,
  spatial-organization struggles, high undo frequency) go unobserved.
  Live observational sessions on Zoom/Meet add color but can't run
  while testers explore solo, where most "stub your toe" moments happen.
- **Success.** PostHog Cloud is integrated. Session replay is enabled
  only for users marked `is_test_user = true` on `public.profiles`
  (Erik can flag himself in for stress-test sessions). A small set of
  named events (~10–15) covers the friction signals Erik wants to
  observe — explicitly *not* a vanity-metrics dashboard. Consent is
  human-to-human during the invite conversation, not via an in-app
  modal. Everything the tester does is recorded, including the actual
  content they type into cards — the *how DMs write* signal is part of
  the research, not noise to hide. The only exception is passwords,
  which are never recorded (login screen renders pre-init, and any
  future password field is auto-blurred via the standard input type).
  Erik can pull a tester's replay and the matching named-event timeline
  side-by-side after a session.
- **Notes.** Documented in
  [ADR-0009](./docs/decisions/0009-behavioral-analytics-session-replay.md).
  Free tier (5K recordings + 1M events per month) is sufficient for a
  friend-sized pool by a wide margin. Long-term, this is the *research*
  backbone for the onboarding work that comes after the first
  observation cycle.
- **Dependencies.** None — strictly additive. New `is_test_user` column
  on `public.profiles` ships in the same migration.
- **Sequencing.** Ships **first** in the current sprint. Must be live
  before (or alongside) the first tester invites.
- **Size:** S–M (3–4 days)

### Zoom-to-node-view v1 — morph + interaction
- **Problem.** The current zoom-out limit caps below the threshold
  needed to see a meaningful slice of any real campaign at once. Erik
  cannot comfortably demo MasterMind, assess structural campaign
  progress, or reason about *where* to place a new node — all of which
  require seeing the campaign as a whole. As campaigns scale toward
  hundreds of cards, the absence of an altitude view turns from
  annoyance into a structural blocker on the product's core promise
  ("the campaign starts feeling like a living world").
- **Success.** Below a defined zoom threshold, each card morphs into a
  **bead** — a circular form with a type-colored border, the card's
  thumbnail centered, type icon as the no-thumbnail fallback.
  Connection lines stay rendered between beads. Text annotations stay
  zoom-stable (regional labels). Hovering or selecting a bead expands
  it back into a fully-readable card at *normal* card size — decoupled
  from canvas zoom — so the user can read content without zooming all
  the way in. Multi-select uses the existing card multi-select
  treatment (opacity/scale/shadow), not expansion. The morph is
  triggered by crossing the threshold (zoom direction) or by
  hover/select (per-node); animations are interruptible and reversible
  from current visual state. Connection lines fade out during the
  morph and fade back in at their new anchor positions the instant the
  new shape locks. Full canvas interaction (drag, right-click,
  click-to-edit) preserved in Bead View.
- **Notes.** Documented in
  [ADR-0010](./docs/decisions/0010-zoom-progressive-disclosure.md), with
  the 2026-05-12 addendum capturing the refined decisions on
  vocabulary (node / card / bead), threshold unit (mm of on-screen
  grid-dot spacing), hysteresis (1.15× return ratio), dynamic
  zoom-out limit (70% viewport fill), and accessibility
  (`prefers-reduced-motion`). V1 keeps three deliberate fidelity
  reductions: connection lines fade rather than anchor-interpolate
  during morph; hover-expand replaces a tooltip entirely (one
  component cut); selection visuals on beads inherit card states
  rather than getting bespoke styling. Perf optimization for 500
  cards is **deferred to v2** — V1 unblocks Erik's daily friction and
  the demo experience; the scaling wall isn't relevant until tester
  campaigns grow.
- **Dependencies.** Analytics ships first (insurance against zoom-v1
  slipping). No code dependency.
- **Sequencing.** Ships **second** in the current sprint. Must be live
  before (or simultaneously with) the first tester invites.
- **Size:** M–L (7–10 days)
- **Implementation chunks.** Each chunk lands as one commit; sizes are
  inside the M–L overall envelope.
  1. **Altitude plumbing** (S, ~1 day). Add Card / Bead mode state to
     a store (likely `useCanvasUiStore`); wire a React Flow zoom
     listener that flips the mode when the grid-dot mm threshold is
     crossed. No visual change yet — just plumbing plus a console log
     proving it fires.
  2. **Bead morph visual** (M, ~2–3 days). `CampaignNode` renders the
     bead form when shape mode is `bead`: width / height /
     border-radius CSS transitions ~200ms, interruptible. Content
     cross-fade between card and bead (thumbnail or type-icon
     fallback) synced to the same timer. Connection lines fade out at
     morph-start, fade back in when the new shape locks.
     Hover-expand not wired yet — every bead stays a bead.
  3. **Connection points on bead perimeter** (M, ~1–2 days). Circular
     analog of `getSpreadBorderPoints` / `getBorderIntersection` in
     `src/utils/edgeRouting.js`. Distribute by angle to connected
     card; enforce `MIN_CIRCLE_POINT_GAP_PX = 4` minimum arc-distance.
     `useEdgeGeometry` branches on shape mode.
  4. **Hover-expand to readable card** (M, ~2 days). In Bead View,
     hover or single-select on a bead morphs it back to a full
     readable card. Card renders at normal size, decoupled from canvas
     zoom (CSS counter-scale), anchored at the bead's canvas position,
     clamped to the viewport, z-index above neighbors. Hover de-triggers
     on mouse-leave; selection de-triggers on click empty canvas or
     click another node without shift.
  5. **Multi-select highlight** (S, ~0.5 day). Two or more selected
     beads stay as beads with the existing lifted/selected styling.
     Prevents marquee-of-many-beads from exploding into card overlap
     chaos.
  6. **Dynamic zoom-out limit + accessibility + threshold tuning**
     (S–M, ~1 day). Replace static `minZoom = 0.5` with the
     `BIRDS_EYE_VIEWPORT_FILL = 0.7` computation (recompute on
     add / delete / drag-stop). Honor `prefers-reduced-motion` —
     instant swap, no animation, when set. Tune
     `MORPH_BELOW_GRID_GAP_MM` against Erik's monitor. Regression-test
     drag / right-click / click-to-edit on beads.

  Total: 7–9 days, inside the M–L envelope.

### Zoom-to-node-view v2 — performance for 500+ cards
- **Problem.** Zoom v1 ships without performance optimization. As
  testers add cards over the first few weeks, the canvas will start to
  feel sluggish before any individual tester campaign hits ~200 cards
  — drag responsiveness degrades, hover latency increases, morph
  animations stutter when many circles are visible at once.
- **Success.** Comfortably support 500 cards with explicit fidelity
  targets: cold page load under 3s, drag stays at 60fps, hover-state
  transitions feel instant, morph animations remain visually smooth at
  any zoom. Headroom toward 1000 cards. Implementation: viewport
  culling (only render circles inside the visible canvas area),
  connection-line culling (hide lines below a pixel-length threshold
  or fully outside the viewport), and render-time memoization of
  per-node hover/select selectors.
- **Notes.** Same ADR as v1
  ([ADR-0010](./docs/decisions/0010-zoom-progressive-disclosure.md)).
  V2 ships *during* the first observation cycle — not invite-blocking,
  because new tester campaigns start small.
- **Dependencies.** Zoom v1 ships first.
- **Sequencing.** Ships **third** in the current sprint, after invites
  go out.
- **Size:** M (3–5 days)

### Onboarding + first-session scaffolding
- **Problem.** MasterMind asks users to think with a graph mental model
  — nodes, edges, spatial organization, free-floating annotations.
  Every alternative tool they've used (Obsidian, Notion, Google Docs,
  Roll20, OneNote, plain folders) trains them to think hierarchically.
  Without onboarding, first-time DMs will likely import their old
  folder/document mental model into MasterMind, which produces
  cognitive friction that masks itself as "this tool is weird" rather
  than "I haven't learned this paradigm." This is plausibly a larger
  adoption risk than any rendering or interaction polish.
- **Success.** A first-session experience that teaches graph thinking
  through *doing*, not reading. The specific shape is intentionally
  undefined here because it must be **evidence-based**: built after the
  first 4–6 weeks of tester observation reveal the 3–5 most common
  confusion patterns. Candidate elements (none committed yet):
  guided walkthrough on first login, empty-state prompts that scaffold
  the "create a card → connect it to another card → notice the
  structure emerging" loop, contextual hints that appear when behavioral
  signals (excessive panning, repeated zoom thrash, rage clicks)
  suggest the user is fighting the mental model, optional sample
  campaigns to explore.
- **Notes.** **This work should NOT precede analytics + zoom.**
  Designing onboarding in a vacuum produces guesswork. Designing it
  after sitting with real session replays produces evidence-based
  decisions. Surfaced as the biggest substantive gap in the
  2026-05-11 ChatGPT critique of the planning conversation.
- **Dependencies.** Analytics shipped + first observation cycle
  complete (4–6 weeks of real tester usage).
- **Sequencing.** **Post-observation, high-priority next sprint after
  the observation cycle.** This is the bet that adoption lives or dies
  here.
- **Size:** L (4–10 days, depending on what observation reveals)

### Card-type defaults in code (Option B)
- **Problem.** Built-in card types (Character, Location, Item, Faction,
  Story) are stored as rows in the `node_types` table, cloned per user
  from a code constant (`BUILT_IN_TYPES`) at signup. The two copies
  drift: when the code constant changes — visual-language refinement,
  icon swap, label rename — existing users' rows do not update. Each
  default change becomes a manual data migration. Surfaced concretely
  on 2026-05-09 during the Faction icon swap (committed `78df33d`),
  which required an out-of-band SQL update for the user's existing row.
  At multi-user scale this is a recurring tax on architectural
  integrity and on the visual language's freedom to evolve.
- **Success.** Built-in card-type defaults live in code only
  (`src/lib/cardTypes.js`). A new `card_type_overrides` table stores
  *only* the specific fields a user has customized. Render path merges
  built-in + override at lookup time. Custom (user-created) card types
  continue to live as rows in `node_types`, distinguished by an
  `is_builtin` flag. Default changes propagate to all non-customized
  fields instantly. Existing data migrated with zero override rows
  generated for any field that already matches the current default.
- **Notes.** Documented in
  [ADR-0008](./docs/decisions/0008-card-type-defaults-in-code.md).
  Implementation chooses **B1** (preserve `nodes.type_id` foreign key by
  keeping minimal stub rows in `node_types` for built-ins) over **B2**
  (`type_key` TEXT migration on `nodes`); B2 deferred indefinitely. The
  `layout` field is included in the schema as forward-looking storage
  for Tailor Card Types.
- **Dependencies.** None — pure architectural foundation.
- **Sequencing.** Must ship **before** Manage Card Templates. MCT's
  customization flows depend on the override table existing and the
  merge-on-read render path.
- **Size:** M

### Manage Card Templates
- **Problem.** Custom card types are persisted per-user as rows in the
  `node_types` table (via `CreateTypeModal` → `createCustomType()`),
  but there is no UI to **list, rename, recolor, re-icon, duplicate,
  or delete** existing types — only the modal for creating new ones.
  Users can pile up unwanted custom types with no way to manage them
  after creation.
- **Success.** A "Manage card templates" surface that lists all card
  types for the active campaign and supports: create, rename, recolor,
  re-icon, duplicate, delete. Persists to the Supabase `node_types`
  table (closes the Known Divergence). Built-in types are protected
  (cannot delete; some properties may be locked).
- **Notes.** This is the *system-level* CRUD on card types. Per-type
  *section structure* (alignment, motivations, geography, etc.) is the
  separate Tailor Card Types item below — split this sprint so each can
  ship independently. Built-in types remain protected: cannot be deleted;
  edits to label / color / icon write to `card_type_overrides` per
  ADR-0008 (so global default changes still propagate to fields a user
  hasn't customized).
- **Dependencies.** Card-type defaults in code (Option B) ships first —
  the override table and merge-on-read path are MCT's substrate.
- **Size:** M

### Tailor Card Types
- **Problem.** Every card type today has the same fixed sections (Story
  Notes / Hidden Lore / DM Notes / Inspiration). DMs want type-specific
  structure: Character cards should have alignment, motivations, voice;
  Location cards should have geography, population. Without per-type
  section structure, AI Card Creation has no structured target either.
- **Success.** A given card type can declare its own list of sections
  (kind + label + default placement). Editing a card of that type
  surfaces those sections in the modal in the declared order. The
  Character template ships with an **Alignment** field as a default
  section (this folds in what was previously a standalone Exploration
  item — alignment is no longer one-off polish, it's the canonical
  example use-case for tailoring).
- **Notes.** Schema-flexible enough to keep the door open to richer
  per-section field types in V2 (enum, number, image grid, etc.) —
  V1 ships with the existing kinds (`narrative`, `hidden_lore`,
  `dm_notes`, `media`, `custom`).
- **Dependencies.** Manage Card Templates ships first (you can't tailor
  what you can't manage).
- **Size:** L

### Typed Connections
- **Problem.** Connections currently exist but are unlabeled — the canvas
  encodes adjacency, not meaning. Users want to see *"father of"*,
  *"ally of"*, *"located in"* on edges so the graph captures
  relationships, not just lines.
- **Success.** Each connection carries a relationship type from a managed
  list (per-campaign or per-user — design call during build). A picker
  prompts for the relationship type when a connection is created
  (canvas-drag or via modal). Edges render the type label inline.
  Existing untyped connections continue to render and can be typed
  retroactively.
- **Notes.** This is the V1-shippable half of what was previously
  bundled with @-mention parsing as one Strategic Bet. Splitting them:
  typed connections need only a `connections.relationship_type_id`
  column + a `relationship_types` table + a small picker UI. No
  contenteditable parsing required. The @-mention half stays in
  Strategic Bet (see below).
- **Dependencies.** None — independent of Templates work.
- **Size:** L

### Nest component
- **Problem.** No way to group cards / connections / text annotations
  into thematic units ("Act 1: Death House", "The Vistani plotline").
  At >50 cards, the canvas becomes hard to organize visually.
- **Success.** A FigJam-section-style container that:
  - Holds any number of cards / connections / text nodes / sub-nests
  - Recurses (nests inside nests)
  - Moves its contents when the nest is moved
  - Has a label / header and is colorable
  - Persists position + membership to Supabase
- **Notes.** Design-loaded — needs a pass on header chrome, resize
  handles, drag-into vs. overlap-into semantics, and how nests
  interact with multi-select / marquee. Persistence shape probably
  needs a `nests` table + a `nest_members` join table (or a `nest_id`
  on each child entity, which limits recursion strategy).
- **Dependencies.** None.
- **Size:** L

### Search
- **Problem.** As campaigns grow, finding a specific card by name or
  content becomes increasingly necessary. No way to do it currently.
- **Success.** Search panel surfaces matches by card label, summary,
  bullet content, type, and (eventually) connections. Click result →
  focus card on canvas.
- **Notes.** Could ship a simpler client-side search first against
  already-loaded state. Postgres full-text search is straightforward
  later if scale demands it.
- **Size:** M

### Background images V1
- **Problem.** The canvas is a flat color today. Campaigns set in a
  specific place (Barovia, Waterdeep, the Underdark) lose visual
  identity without a backing image. The aspirational isometric map is
  V4+; a static image gets most of the value much sooner.
- **Success.** Per-campaign background image upload. Image fills the
  viewport without stretch or tile, and is **fixed to the window, not
  the canvas zoom** (so it doesn't shift when panning / zooming).
  Persists per-campaign; uses the existing image storage pipeline.
- **Notes.** V1 is intentionally minimal: one image, no slideshow, no
  AI generation, no canvas-anchored positioning. V2 layers slideshow
  and AI-generated contextual images on top. Do NOT engineer V1 to be
  "isometric-ready" — the V4+ interactive map is a different rendering
  layer.
- **Dependencies.** None (image storage + signed URLs already shipped).
- **Size:** M

### Markdown export
- **Problem.** No way for a user to get their campaign data out of the
  product. Data ownership matters on its own merits, and matters more
  before AI features ship (lock-in concerns will surface).
- **Success.** One-click "download my campaign as markdown" produces a
  zip (or single file) containing all cards, sections, connections,
  text annotations — readable in any markdown viewer.
- **Notes.** Bounded but needs format decisions: one .md per card or
  one combined file? How are connections encoded — inline links via
  card labels? Where does media land — referenced by signed URL, or
  inlined as base64 attachments?
- **Dependencies.** None.
- **Size:** S–M

### Copy / paste cards across campaigns
- **Problem.** Useful patterns / cards from one campaign can't be reused
  in another.
- **Success.** Copy a card (or set of cards) from campaign A and paste
  into campaign B. Connections within the copied set are preserved.
  Connections to cards *not* in the copy set are dropped.
- **Notes.** Bounded but needs decisions: pasted card brings its type —
  if the type doesn't exist in the target campaign, do we create it?
  Image references: re-upload or copy by reference?
- **Size:** M

### Profile V2 — username + profile image
- **Problem.** The Profile page that shipped only covers email
  (read-only) and password change. As soon as the product reaches users
  beyond the V1 user, those users will want to (a) be addressed as
  something other than the first letter of their email and (b) put a
  face to their account. The breadcrumb and avatar both fall back to
  email-derived initials today.
- **Success.** Two new sections on the Profile page:
  - **Username** field with uniqueness constraint, max length, allowed
    characters. Persisted via a new `profiles` table with a Supabase
    Auth trigger that auto-creates the row on signup. Breadcrumb +
    UserAvatar render the username when set.
  - **Profile image** upload (one image per user, replaces if present).
    Reuses the existing image-storage pipeline with a new path scheme
    (e.g., `users/{userId}/avatar.full.webp`). Renders in `UserAvatar`
    when set, falls back to initial otherwise.
- **Notes.** The Profile page shell is already in place
  (`Profile.jsx` + `#profile` route) so the runway is short. Each piece
  is M individually; together L. Worth splitting if a partial ship
  would be valuable — username alone delivers most of the
  user-identity benefit.
- **Dependencies.** None.
- **Size:** L (or two Ms if split)

---

## Strategic Bet

> Each of these items needs a 1–2 day spike before being committed to a
> sprint. The spike's job: prototype the hardest piece, write findings,
> then decide whether to invest a sprint.

### @-mention parsing + autocomplete
- **Problem (sketch).** Even after typed connections ship, creating a
  connection still means leaving the narrative text and using a separate
  picker. Users want to write *"father to @Ireena"* in card text and
  have the connection auto-created with the typed relationship "father
  to" attached. This is the contenteditable-heavy half of what was
  previously bundled with typed connections; typed connections moved
  into Foundational Progress (V1) and are no longer blocked by the
  spike below.
- **What success might look like.** @-trigger autocomplete inside any
  card's narrative / hidden lore / dm notes; selecting an entry creates
  a typed connection (using the V1 typed-connections infrastructure)
  *and* renders an inline link in the prose. Removing the inline link
  asks before deleting the underlying connection.
- **What the spike has to answer.**
  - How does the @-trigger menu interact with React Flow + the
    existing rich text in cards? (No popover libraries currently
    integrated; contenteditable is custom.)
  - Phrase capture: how do we extract *"father to"* from prose to
    populate the relationship type? Pre-text vs. post-mention vs.
    explicit syntax.
  - Bidirectional inverses ("father to" / "child of") — auto-generated
    or explicitly defined?
  - Reverse-edit semantics: if the user deletes the @-mention text in
    the card, does the connection disappear?
- **Dependencies.** Typed Connections (V1) ships first.
- **Target version:** V2 (likely; reassess after spike)
- **Size:** XL

### AI-Assisted Card Creation
- **Problem (sketch).** Users want to describe a concept in natural
  language and get a structured card back; or paste a block of
  campaign-book text and have it become one or more cards.
- **What success might look like.** "Create a character named Ireena,
  daughter of the Burgomaster of Barovia" → a character card with
  summary + bullet notes, ready to edit. Paste a 3-paragraph location
  description → a location card with sections populated.
- **Dependencies.**
  - **Hard:** Card-type templates must exist first (gives the AI a
    structured target).
  - **Strongly recommended:** Undo / redo must exist first (AI output
    is bad sometimes; users need an out).
- **What the spike has to answer.**
  - Which model + tier (Haiku / Sonnet / Opus) for the quality / cost
    tradeoff?
  - Structured output via tool use (better) or freeform → parse (worse)?
  - Where does the API key live — backend proxy vs. user-supplied?
  - Cost ceiling per campaign / per user.
- **Size:** XL

### Visual hierarchy / 5 tiers in the knowledge graph
- **Problem (sketch).** Cards all look the same size on the canvas. The
  ask is at-a-glance importance — story-critical cards bigger, minor NPCs
  smaller.
- **Why I'm flagging this for discovery.** "More content + more
  connections = more weight" sounds clean but breaks down: a story-critical
  solo NPC has few connections; a tavern with 30 patrons isn't more
  important than the BBEG. The metric needs design thought before code.
- **What the spike has to answer.**
  - What does "important" mean to a DM? Probably user-tagged ("pin this
    card as a major NPC") rather than auto-derived from content size.
  - How are the 5 tiers visually expressed — size only, or also
    typography / border weight / shadow?
  - Performance at 100+ cards with varied sizes (zoom-compensated title
    logic in CampaignNode already gets touchy).
- **Size:** XL

---

## Exploration

### Physics layout layer — repulsion, auto-arrange, force-directed clustering
- **Problem (sketch).** Today, cards stay exactly where the user
  places them. As campaigns grow and zoom-out reveals dense clusters,
  cards can visually crowd each other; new cards dropped near a busy
  region overlap existing ones. The hover-expand interaction in zoom v1
  also produces transient overlap with neighboring circles. A physics
  layer — nodes that gently repel each other so they can't share
  space — would resolve overlap automatically and produce organic,
  breathing layouts.
- **Why it's an exploration, not a sprint item.** Introducing physics
  changes the foundational paradigm of the canvas. Erik's Strahd
  campaign has carefully positioned cards in specific spatial
  relationships — Strahd's tower here, Madam Eva's vardo there. A naive
  physics layer would disturb that intentionality. The decision space
  is product-shaping: is physics the *layout system* (Obsidian's graph
  view) or a *layer separate from manual placement* (force only kicks
  in during auto-arrange commands, or on newly-dropped cards before
  they settle)?
- **What the spike has to answer.**
  - Three positions to evaluate: (1) no physics, z-index handles
    overlap; (2) physics on a separate layer from manual — repulsion
    only on creation or via explicit "auto-arrange"; (3) physics as the
    primary layout system, like Obsidian's graph view.
  - Performance at 500–1000 nodes during simulation.
  - Interaction with the zoom v1 hover-expand: should an expanded card
    push neighbors out transiently? Or is z-index always sufficient?
  - References: D3-force, Cytoscape.js, React Flow's force layout
    plugin, Obsidian's graph view, Heptabase, Kosmik, Tinderbox.
- **Notes.** Surfaced 2026-05-11 during zoom-v1 design discussion. Erik
  raised it as a potential answer to hover-expand overlap; deferred from
  zoom v1 because the decision is large enough to deserve its own
  conversation. Zoom v1 ships with z-index for overlap.
- **Dependencies.** None (independent paradigm exploration).
- **Target version:** V2+ (likely; reassess after spike)
- **Size:** XL (spike, then product call, then likely a sprint)

### Weekly-updates strategy — define streams, channels, voice, PROMPTs
- **Problem (sketch).** Erik wants weekly progress posts that serve two
  audiences: hobbyist DMs/GMs (building broader audience over time so
  MasterMind has a warm community at wider sign-up) and product
  designers + AI builders (positioning Erik as a designer building real
  products with AI). Two separate streams chosen as the structural
  shape — same posts won't serve both audiences cleanly. The current
  [`PROMPT.md`](../weekly-updates/PROMPT.md) is single-stream and
  produces too-technical engineer-diary voice, not the "idiot's guide
  to working with AI" voice Erik wants. Several open questions:
  channels per stream, cadence, voice specifics, PROMPT structure,
  Patreon's role.
- **What success might look like.** Each stream has a defined channel,
  cadence, voice, and PROMPT (or handwritten convention). The first
  post on each stream lands cleanly in Erik's voice for its audience.
  A small queue of starter post topics so the first few weeks aren't
  from-scratch decisions. Erik knows which channel a given week's
  insight belongs on without re-deciding the strategy each time.
- **Notes.** Audience-building work — runs parallel to product
  development, not gated on V1 features. Deliberately deferred until
  after the immediate V1 sprint (Zoom v2 → invites) clears. Vision
  + open questions captured in
  [`weekly-updates/README.md`](../weekly-updates/README.md); the
  Week 1 archived draft at
  [`weekly-updates/drafts/_archive/`](../weekly-updates/drafts/_archive/)
  is the canonical "wrong-voice" reference for the future PROMPT
  rewrite.
- **Dependencies.** None code-side. Soft dependency on Erik's
  creative bandwidth — voice work is best done between coding
  sprints, not crammed alongside them.
- **Target version:** N/A — runs parallel to product versioning.
- **Size:** M (1–3 days of design + writing once it's the focus)

### Undo/redo residual flicker
- **Problem.** When chaining several Ctrl+Z presses through
  create → move → delete (or similar), a card can occasionally exhibit
  a sub-frame visual stutter — appearing-then-reappearing during a
  single undo step, or briefly settling on an intermediate position
  before the final one. Functionally correct: no data loss, no state
  corruption, no duplicate items, the undo history is intact. Cosmetic.
- **Why it's not blocking.** Round-trip property holds (verified by
  `undoIntegration.test.js`). The flicker is render-cascade roughness,
  not logical incorrectness. ADR-0006's success criteria are met.
- **Likely cause.** Even after the no-op-echo guards in
  `useCampaignData` (commit `bd5eb3d`), some flicker remains. Suspects:
  (1) `useEdgeGeometry` re-running on every `setNodes` and itself
  calling `setNodes` to refresh `connectionDots` — chained re-renders
  even when geometry didn't change; (2) React Flow v11's internal
  reconciliation when card object references change but ids/positions
  match; (3) cross-table Realtime event ordering — `nodes INSERT`
  vs `node_sections INSERT` arriving in unpredictable order during a
  delete-card inverse, with the local optimistic state already correct.
- **Where to investigate first.** React DevTools profiler during a
  Ctrl+Z sequence: count re-renders of `CampaignNode` per undo. If a
  single undo triggers more than 2 renders of the affected card, the
  cascade is the smoking gun. Then either memoize `CampaignNode` more
  aggressively or move `connectionDots` out of `node.data` (it's
  derived; doesn't need to live in the React Flow node object).
- **Size:** S (investigation) → M (fix)

---

## Process habits

- **Estimates are honest, not inflated.** If an item says S, it really is
  < 1 day; if it says XL, it really does need a spike and a multi-sprint
  commit.
- **Dependencies are tracked explicitly.** Tailor Card Types depends on
  Manage Card Templates (you can't tailor what you can't manage). AI
  Card Creation depends on Tailor Card Types (it needs a structured
  target) and on undo / redo (AI output is bad sometimes; users need
  an out — undo / redo is shipped). @-mention parsing depends on
  Typed Connections (it builds inline-link UI on top of the relationship
  schema). Markdown export should ship before AI Card Creation (data
  ownership before AI lock-in concerns surface). Don't reorder against
  the dependency graph.
- **Discovery items get a spike, not a sprint commitment.** The spike
  output becomes the basis for "should we commit a sprint to this?"
- **Each sprint review:** drop done items into CHANGELOG, re-rank what's
  left, surface anything new from the build experience. Update this doc.

---

## Recently shipped

See [`CHANGELOG.md`](./CHANGELOG.md) for what's already in production.
