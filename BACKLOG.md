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

The previous sprint shipped **Image upload + cropper** (see
[CHANGELOG.md](./CHANGELOG.md), Sprint 3). The next sprint hasn't
been planned yet.

Likely candidates from the top of Foundational Progress:

| Item | Band | Size |
|---|---|---|
| Card-type defaults in code (Option B) | Foundational Progress | M |
| Manage Card Templates | Foundational Progress | M |
| Markdown export | Foundational Progress | S–M |

**Card-type defaults in code** is a sequencing prerequisite for
Manage Card Templates — it moves built-in card-type defaults out of
the database and into code, with a sparse override table for user
customizations. Documented in
[ADR-0008](./docs/decisions/0008-card-type-defaults-in-code.md).
Manage Card Templates closes the localStorage-only custom-types
divergence flagged in CLAUDE.md and unblocks Tailor Card Types (a
V2 AI-prerequisite). Markdown export is a small companion that gets
data ownership in place before AI features ship.

Final pick lands at sprint start.

---

## Quick Win

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
- **Problem.** Custom card types live in `useTypeStore` (localStorage)
  with no UI to list, duplicate, or delete them — only `CreateTypeModal`
  for label / color / icon at creation time. The localStorage-only
  persistence is also flagged as a Known Divergence in CLAUDE.md: the
  `node_types` table already exists per campaign, but the UI never
  writes to it.
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
