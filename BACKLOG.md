# BACKLOG.md — MasterMind: Story Builder

A living backlog. The numbered Sprint 2 / 3 / 4 / 5 roadmap that previously
lived in CLAUDE.md / README.md is retired in favor of this doc — sequential
sprint plans don't survive contact with reality once the backlog grows past
a handful of items with real dependencies.

---

## How this works

- **Living doc.** Items get added, dropped, and re-ranked sprint over sprint.
  The ranking captures *current* belief, not a contract.
- **Reviewed at the start of each sprint.** What's in the next sprint is
  decided then, with the latest information — not weeks in advance.
- **A "sprint" = 1–2 weeks of working sessions.** Not a strict timebox — a
  unit of planning.
- **Each sprint mixes size.** One Tier 2 / Tier 3 item + 2–3 Tier 1 / polish
  items. Pure-big sprints stall mid-feature; pure-small sprints lose
  momentum on foundational work.
- **Tier 3 items get a spike first.** A spike is 1–2 days max — prototype
  the riskiest piece, write findings, *then* decide whether to commit the
  rest of the sprint to it.
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

## Current sprint candidate — Sprint 2

Theme: **protect the user, ship visible wins.**

| Item                          | Tier        | Size |
|-------------------------------|-------------|------|
| Undo / redo (user-scoped)     | Foundational | L    |
| Branding (favicon + tab)      | Quick win   | S    |
| Relative edit timestamps      | Quick win   | S    |
| Dynamic card width            | Quick win   | M    |

Subject to revision at sprint start.

---

## Tier 1 — Quick wins

### Branding update — favicon + tab title
- **Problem.** Default Vite favicon and "Vite + React" tab title don't
  reflect the product.
- **Success.** Favicon and tab title reflect the "Webmaster" branding
  direction.
- **Notes.** Bounded by needing the actual favicon asset + final brand name
  confirmed.
- **Size:** S

### Relative edit timestamps
- **Problem.** The "last edited" indicator only reflects edits in the
  current session, so opening a campaign tomorrow shows nothing about
  whether it's been touched recently.
- **Success.** Indicator shows: "Edited just now" → "1 minute ago" → "N
  minutes ago" → "N hours ago" → switches to absolute date once past
  midnight. Persists across sessions.
- **Notes.** Cheapest path: derive from `max(updated_at)` across the
  campaign's tables — no schema change. If we want per-campaign edit
  tracking decoupled from individual rows, add `campaigns.last_edited_at`.
- **Size:** S

### Dynamic card width
- **Problem.** Long words and long titles in card headers either overflow
  or get cut off. Cards are fixed-width.
- **Success.** Card width grows to fit content within sane bounds
  (min / max width). Long words wrap rather than overflowing. No header
  text is cut off or unreadable.
- **Notes.** Needs a design pass on the min / max bounds and how it
  interacts with React Flow layout. Doesn't change persistence shape.
- **Size:** M

### Paste images into cards
- **Problem.** Users have to use the file picker for every image; pasting
  from clipboard would be dramatically faster.
- **Success.** Ctrl+V / Cmd+V in the EditModal media section uploads the
  pasted image through the existing imageStorage flow. Same end state as a
  file-picker upload.
- **Notes.** Builds on existing image storage infrastructure. Auto-generated
  filenames already handled by `imageStorage.uploadCardImage`. Edge cases
  to nail down: non-image clipboard content, multiple images at once, paste
  outside the modal.
- **Size:** M

---

## Tier 2 — Foundational

### Undo / redo
- **Problem.** No way to recover from accidental delete, accidental edit,
  or (eventually) bad AI output. As destructive features grow, the absence
  of undo becomes higher-stakes.
- **Success.** Ctrl+Z / Ctrl+Shift+Z reverses recent actions in the active
  campaign. **Per-action** granularity (create card, edit field, move card,
  delete card, create / delete connection), not per-keystroke. Scoped to
  the current user's actions in this tab — does not undo other tabs'
  Realtime updates.
- **Notes.** Implementation choice: command pattern (action log + inverse
  applied on undo) vs. snapshot pattern (full state snapshot per action).
  Command pattern is leaner and integrates with the existing optimistic-UI
  pattern but requires writing an inverse for each action type. Worth a
  brief design sketch before commit.
- **Size:** L

### Card-type template management UI
- **Problem.** Card types currently live in `useTypeStore` (localStorage)
  with no UI for editing the *structure* of a type — only label / color /
  icon. AI generation needs a structured target ("what sections does a
  'character' card have?"). Modular sections work can't ship without this.
- **Success.** Can edit a node type's section structure: add / remove /
  rename sections, choose default kind (narrative bullets, hidden lore,
  dm notes, custom). Changes are persisted to the existing Supabase
  `node_types` table — wraps up the localStorage divergence currently
  flagged in CLAUDE.md's "Known Divergences."
- **Notes.** This is the missing piece for AI generation. Templates first,
  then AI.
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

---

## Tier 3 — Big features (spike first)

> Each of these items needs a 1–2 day spike before being committed to a
> sprint. The spike's job: prototype the hardest piece, write findings,
> then decide whether to invest a sprint.

### Dynamic card connections + relationship types
- **Problem (sketch).** Connections currently exist but are unlabeled and
  created via a separate UI (the picker in EditModal). Users want to write
  *"father to @Ireena"* in narrative text and have the connection
  auto-created with the typed relationship "father to."
- **What success might look like.** @-mention autocomplete in card text;
  inline tagging creates a connection with a typed relationship;
  relationships show as edge labels on the canvas; relationship types are
  managed (dropdown, not free text).
- **What the spike has to answer.**
  - Schema: `relationships` table with `source`, `target`, `type_id`,
    where `type` is FK to a `relationship_types` table — per-campaign or
    per-user?
  - Inline parsing in contenteditable: how does the @-trigger menu
    interact with React Flow + the existing rich text in cards?
  - Bidirectional inverses ("father to" / "child of") — auto-generated
    or explicitly defined?
  - Migration path from existing untyped connections.
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

## Tier 4 — Polish / D&D-specific

### Character alignment field
- **Problem.** Character cards have no consistent place to display
  alignment (lawful good, chaotic evil, etc.). DMs want it visible at
  a glance.
- **Success.** Alignment is a structured field on character-type cards
  with consistent placement on the card body and in the EditModal.
- **Notes.** Design-loaded. Where does alignment go — in the header,
  below the title, as a small icon? Needs a design pass before build.
  Also: does this generalize (a "stat" section for character cards) or
  stay specific to alignment?
- **Size:** S–M depending on design scope

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
- **Dependencies are tracked explicitly.** AI depends on templates;
  templates must ship before AI. AI also benefits from undo / redo;
  undo / redo should ship before AI. @-mentions depend on relationships;
  relationships must ship before @-mentions. Don't reorder against the
  dependency graph.
- **Discovery items get a spike, not a sprint commitment.** The spike
  output becomes the basis for "should we commit a sprint to this?"
- **Each sprint review:** drop done items into CHANGELOG, re-rank what's
  left, surface anything new from the build experience. Update this doc.

---

## Recently shipped

See [`CHANGELOG.md`](./CHANGELOG.md) for what's already in production.
