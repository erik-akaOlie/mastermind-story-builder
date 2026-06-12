# MasterMind: Story Builder — Roadmap

*What's in V1, V2+, V3+, and explicitly out. Source of truth for version-level scope. Short-term sprint planning lives in [`BACKLOG.md`](../../BACKLOG.md); per-item problem statements, success criteria, and dependencies live there.*

*Vocabulary used here is defined in [`glossary.md`](./glossary.md).*

---

## V1 — The knowledge graph experience

**Goal:** prove that a visual canvas is a meaningfully better worldbuilding tool than the current alternatives (Obsidian, Notion, World Anvil, Kanka). Family-scale daily use is the design target; broader DM audience comes after V1 stabilizes.

**What V1 delivers:**

- The canvas as it is today (cards, connections, text annotations, multi-campaign, image storage, undo/redo, Realtime sync) — already shipped
- **Typed connection relationships** — connections carry semantic labels ("father of," "ally of," "located in") so the graph encodes meaning, not just adjacency
- **Search** — fast retrieval as campaigns grow past a few dozen cards
- **Tailor Card Types** (Medium scope) — per-type section structure (Character cards have alignment / motivations / voice; Location cards have geography / population). Schema-flexible enough to keep the door open to richer per-section field types in V2+
- **Manage Card Templates** — system-level CRUD on card types: create, rename, color, icon, duplicate, delete
- **Nesting** — representing the world's emergent structure (towns, factions, families, arcs) as first-class groupings. Discovery (2026-06-12, [grouping-discovery.md](../research/grouping-discovery.md)) reshaped the original FigJam-section-container concept into the current leading hypothesis, pending the outcome of the design/architecture spike: nesting as a *capability of cards* (any card can optionally contain a child graph), scoped to world structure. Gated behind a design/architecture spike, then an ADR, before any build.
- **Background images V1** — single static image filling the canvas without stretch or tile, fixed to window not canvas zoom
- **Markdown export** — one-click "download my campaign as markdown" for data ownership
- **Polish accumulating throughout** — paste-image-from-clipboard, dynamic card width, branding, edit timestamps, character alignment field, canvas-drag connection creation, relationship-type popup on connection creation

**V1 constraints (apply to all V1 work):**

- **Schema must remain system-agnostic.** No 5e-only assumptions in templates, prompts, or data shape.
- **Don't depend on hover or right-click for primary actions.** Preserves the option to make the product tablet-usable without a V2 redesign.
- **Card content stays as text wherever possible.** Avoids painting into a corner on V2's embedding pipeline.

---

## V2 — AI features grounded in the campaign

**Goal:** make the knowledge graph dramatically more valuable through AI that knows *this* campaign — defensibility comes from the graph being already populated and structured.

**What V2 delivers:**

- **AI Card Creation** — describe a concept in natural language, get a structured card back. Or paste campaign-book text, get one or more cards.
- **AI Connection Detection** — semantic relationship detection on prose. *"Count Strahd was the son of King Barov"* → connection auto-created and labeled.
- **Vector index / embedding pipeline** — ships when the first AI feature ships, not before. pgvector on Supabase. See deferred ADR (TBD: write before V2 starts).
- **Live "run mode" / mid-session retrieval** — context-aware card surfacing during play (Madam Eva is talking → surface Strahd, Vistani, related cards). Mobile/tablet decision lives here: if run mode is V2, tablet is co-equal with desktop and the interaction model adapts.
- **Background images V2** — slideshow + AI-generated contextual images
- **AI continuity / gap analysis** — "show me plot threads with no resolution; NPCs mentioned but never carded"
- **Session recap generator** — paste raw bullets, get a narrative recap in the DM's voice

**V2 prerequisites:**

- Tailor Card Types must ship in V1 (gives AI Card Creation a structured target)
- Markdown export must ship in V1 (data ownership before AI lock-in concerns surface)

---

## V3 — Sharing, reading, and ops

**Goal:** open the product to second-class users (players) and start delivering operational value to paid DMs.

**What V3 delivers:**

- **Wiki view** — same data as the canvas, presented as linked pages. Cards-as-pages; connections as inline hyperlinks; @-mentions as the link mechanism (per [ADR-0004](../decisions/0004-inline-mentions-syntax.md)).
- **Player view** — filtered through the discovery state already designed in [`docs/design/design-system.md`](../design/design-system.md) §4. Naturally pairs with wiki view: players consume the wiki version of discovered content.
- **Sharing / read-only player access** — the first multi-user surface. URL-based shares; possibly account-based later.
- **First wave of pro-DM operations** — attendance tracking, recap delivery, simple billing. Sold as a paid upgrade.
- **Multi-system explicit support** — Pathfinder 2e and at least one other system as first-class targets. (The constraint applies in V1; the *features* light up here.)

---

## V4+ — Speculative

**Interactive isometric map.** The eventual replacement for V1's static background — a scaled, repositionable, zoomable map where cards-as-floating-markers are anchored to specific locations. Different rendering layer than V1's window-fixed background; do not engineer V1 to be "isometric-ready."

**Deeper pro-DM ops.** CRM, recurring scheduling, content reuse across campaigns, no-show policy automation, IP protection for resellable homebrew.

**Integration architecture.** D&D Beyond, Foundry, Roll20, Owlbear, Discord, StartPlaying. Integrate, don't replace.

---

## Recorded hypothesis — the problem may extend beyond game mastering

A product-discovery exercise (see [ADR-0013](../decisions/0013-product-positioning.md)) produced strong evidence that MasterMind addresses *one broad underlying problem* — identifying opportunities and insights across many interconnected elements within a larger system — and that this problem is not unique to game mastering. The same difficulty appears to recur in UX research synthesis, organizational mapping, investigative work, and other relationship-heavy thinking.

This is recorded as an **explicit, unvalidated hypothesis** — not a roadmap commitment and not a current product direction. V1 is focused on game masters. Whether the broader pattern is real, and whether MasterMind should ever serve those domains, is a question for future research; it does not shape V1, V2, or V3. [ADR-0014](../decisions/0014-workspace-schema-architecture.md) keeps the architecture from *blocking* a future move in that direction without building toward it now.

---

## Out of scope — deliberately

We are not building these. Naming them explicitly so they don't drift back in.

- **Virtual Tabletop (VTT) replacement.** Foundry and Owlbear have multi-year head-starts. We integrate with them eventually; we don't compete with them ever.
- **Digital rulebook / compendium.** Hasbro's licensed content is legally inimitable. D&D Beyond is the rules layer; we're the campaign-state layer.
- **Player-facing marketplace.** StartPlaying owns this. Two-sided marketplaces with low-ARPU users are brutal.
- **Content marketplace as a primary product.** May become an extension once platform traction exists; not a V1–V3 deliverable.
- **AI Dungeon Master / generic AI GM.** Friends & Fables, RoleForge, et al. are doing this; none have broken through. Different product.
- **Native mobile apps.** Web-responsive (eventually tablet-friendly) is the V1–V3 commitment. Native apps are V4+ if at all.
- **Real-time multi-user collaboration on the same campaign.** Realtime sync within one user's tabs is shipped; *collaborative editing across users* is V3+ territory and not lightweight.
- **Offline mode.** Massive engineering tax for marginal benefit when the audience uses persistent connections.

---

## Open questions

These are real decisions we have not yet locked. Each blocks something downstream.

- **Mobile vs. desktop priority for V1.** Hinges on whether live "run mode" is V1 or V2. Default assumption: V1 = desktop-first with "responsive enough to read on tablet"; V2 promotes tablet to co-equal alongside run mode. The V1 constraint above (no hover/right-click for primary actions) preserves the option.
- **Audience transition from Erik to broader DMs.** When does the product stop being "Erik's tool" and start serving other users? Affects onboarding, empty-state design, billing infrastructure, marketing — none of which are real V1 priorities, but the trigger for them is unspecified.
- **Performance at 500 cards.** Target is named in design intent; no benchmarking has happened. Likely fine; possibly not. Worth a Strategic Bet spike eventually.
- **Node completeness signaling.** Tenet 3 says completeness is implicit and content-driven. The 5-tier visual hierarchy (matrix card "Context-Based Visual Hierarchy Display") would make it explicit. Are these the same signal or two separate ones? Design call before either ships.
