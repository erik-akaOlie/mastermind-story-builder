# Reclaiming the Plan — A Structural Breakdown and Roadmap

*A candid, opinionated restructuring pass. Written as a working memo, not a pitch deck.*

---

## 0. Diagnosis: what's actually happening

You're not lost. You're at the exact inflection point every project hits right before it either matures or collapses.

What you're feeling is **three different problems arriving at the same time**:

1. **Scope sprawl.** You have a core idea that's working (the visual case-board for DMs) and you're now seeing adjacent ideas that *could* fit (wiki view, AI, timelines, DDB integration, cross-device, pro-DM features). Every one of them is legitimately good. Added together they're a two-year solo project that ships nothing.
2. **Architectural inflection.** You've built Phase 1 as a React app with session memory. To do any of the adjacent things well you need real data persistence, which means a real data model, which means decisions you've been deferring now block progress.
3. **Identity drift.** The product started as "a visual mind map for DMs." It's becoming "a platform for DMs." Those are different products with different names, different user promises, and different scope. You need to decide which one you're building before you write another line of code or a single new doc.

These three are entangled but separable. You solve them in a specific order. That's most of what this memo is.

The honest read on the underlying project is that **the foundation is solid**. The canvas works. The two-layer discovery model is a genuine differentiator. You've resisted the obvious traps (don't build a VTT, don't build a rulebook). What's missing is a commitment device: a small set of decisions that prevent you from accidentally promising yourself 12 features in parallel.

---

## 1. Workstreams (the six clear buckets)

Everything on your list falls into one of six workstreams. Naming them explicitly makes it clear which decisions live where.

**Workstream A — Product Identity**
The vision, tenets, naming, and user promise. This is *what the product is* in one paragraph.

**Workstream B — Core UX Architecture**
The visual board, the wiki view, how they relate, what's a "view" vs. what's a "feature," information architecture. This is *what the user sees and does*.

**Workstream C — Data Model & Persistence**
How information is structured, stored, retrieved, and exported. Backend, schema, auth, multi-campaign. This is *what the product knows*.

**Workstream D — Feature Roadmap**
Search, AI co-pilot, timeline, multi-campaign, DDB integration, player view, pro-DM features. Everything built *on top of* A/B/C.

**Workstream E — Engineering & Documentation Hygiene**
File organization, doc structure, architectural decisions, conventions, the relationship between design-document.md and CLAUDE.md. This is *how the project itself stays legible*.

**Workstream F — Operational Scope**
Cross-device support, accessibility, offline, performance at scale, collaboration. These are real but most of them are premature right now.

---

## 2. How the workstreams relate

A clean dependency graph — read top-to-bottom, the things on top must be done before the things below:

```
A. Identity
    ↓
B. Core UX ← → C. Data model
       ↘          ↙
         D. Features
              ↑
         E. Hygiene (ongoing, parallel)
              ↑
         F. Operational (mostly later)
```

Three things to notice:

1. **Identity comes before everything.** You can't design a data model for "DM platform" until you know whether you're building "visual mind map" or "campaign operating system." They imply different data models.
2. **Core UX and data model are codependent.** You can't finalize one without the other, but you also can't do both in isolation. In practice: sketch UX, draft the data model, iterate until they agree, then freeze both.
3. **Features sit on top.** Every feature you're excited about (AI, search, timelines, DDB) is trivially easier to build on a clean data model than on what you have today. This is why C is the leverage point.

---

## 3. What to clarify NOW (before another line of code)

These are the decisions that, if unmade, keep causing confusion downstream. Make them this week.

### 3.1 The product name and language

**Recommendation: drop "Mind Map." It's the wrong word for what you're building.**

- Mind map implies single-user brainstorming, hierarchical, productivity-tool, ephemeral.
- Your product is: a persistent continuity database, a living world, a case board, a web of connected narrative elements.
- "Mind map" actively miscommunicates this to every potential user.

Candidate names I'd consider:
- **Campaign Canvas** — clear, descriptive, inherits "Figma-like" associations
- **Campaign Board** — honors the case-board inspiration directly
- **Codex / Campaign Codex** — implies reference + lore + authority
- **Weave** or **Campaign Weave** — implies interconnection, poetic but maybe cheesy
- **Continuum** — implies continuity, time, persistence

My lean: **"Campaign Canvas"** for the product, **"case board"** or **"campaign graph"** as the UI metaphor. They're descriptive without being cute.

Write one sentence that is the product promise. Example: *"Campaign Canvas is the home for your campaign's living memory — a visual, connected record of your world that stays trustworthy across years of play."*

### 3.2 The V1 user

You cannot build for all users in V1. Pick one. Build the product until that user cries when they're asked to use anything else. Expand after.

The three realistic candidates:
- **Long-campaign hobbyist DM** (runs a 2+ year campaign, 100+ narrative elements, suffers continuity pain) — my recommended V1 target.
- **Professional paid DM** — high-ARPU, vocal, but small segment. Better as V2 monetization wedge.
- **New DM starting their first campaign** — large segment, low willingness to pay, hard onboarding problem.

**Pick long-campaign hobbyist for V1.** They have the pain, they have the tolerance for setup friction, and they're the most likely to become evangelists. Pro-DM can wait until you have a product they can bolt business operations onto.

### 3.3 The tenets (rewrite)

Your current list has five principles. I want to push back on one of them hard and tighten the rest.

**Cut this one: "The product should be customizable because different people work differently."**

"Customizable" is a scope multiplier disguised as a principle. Every product says it. It usually means "we haven't made decisions yet so we'll let users make them." In practice it leads to bloated preference panels, slower iteration, and a worse default experience for everyone.

The real principle underneath is probably: *"The product should flex to how a DM's thinking evolves without forcing them to restructure."* That's different. That's a statement about data model (flexible schema, views as first-class), not about adding settings.

My recommended tenet rewrite:

1. **One canonical campaign, many views.** There is one data model. Board view, wiki view, list view, timeline view, player view are all lenses onto the same underlying graph. Switching views never costs you data.
2. **The tool is a trusted reference, not a to-do list.** It never nags. It never grades. Its job is to be accurate and available, not motivational. Completeness is implied by content, never badged.
3. **Low friction is a feature.** Any moment where a DM thinks "this is faster to write in Notion" is a bug.
4. **The DM's data is the DM's data.** One-click export. No lock-in. Markdown-compatible where possible.
5. **Available wherever inspiration strikes.** Web-first, mobile-usable. Full mobile-native apps are Phase 3+, but "I can read and quickly edit on my phone" is table stakes.

Drop "accessibility" as a separate tenet — not because it doesn't matter, but because it belongs in engineering standards, not product vision. Every tenet should be a claim about the product, not a commitment to a category of work.

### 3.4 The role of the wiki view

You're right that some users will want a wiki-style experience. The architectural question is whether wiki is a *different product* or a *different view of the same product*.

**My recommendation: same product, different view.** Every node has a canonical page (wiki-style) and a canonical position on the canvas (board-style). You navigate between them seamlessly. Clicking a node on the canvas opens its page; clicking a link in a page pans the canvas to that node.

This is the approach Obsidian takes (notes + graph), Notion takes (page + database views), Figma takes (canvas + layers panel). It's well-trodden and users understand it. Don't invent a new paradigm here.

### 3.5 What the AI copilot does and doesn't do

This is the most important decision you haven't made yet. Here's my opinionated take.

**The AI copilot does six things well:**

1. **Semantic search over the campaign.** "Who was that elf priest from session 12?" → answers with the node, grounded, linked.
2. **Draft assistance grounded in your data.** "Suggest a tavern keeper for Vallaki who has a grudge against the Wachters." Uses what you've already written about Vallaki and the Wachters.
3. **Session recap drafting.** Input: raw session bullets. Output: narrative recap matching your voice.
4. **Gap analysis.** "Which plot threads have no resolution? Which NPCs have been mentioned but never described?" Pure structured analysis over your graph.
5. **Roleplay reference.** "Remind me how Ireena speaks." Pulls from notes, summarizes voice/mannerisms.
6. **Connection suggestions.** "This new NPC has similar motives to three others in your campaign." Graph-aware.

**The AI copilot does NOT:**

1. **Generate full worlds from scratch.** "AI slop worldbuilding" is actively hated by the community. Don't invite that.
2. **Adjudicate rules.** Too error-prone, legally adjacent, not your job.
3. **Generate images inside the product.** AI art controversy is ongoing and sharp. Let users bring their own images.
4. **Replace the DM at the table.** You're not Friends & Fables. The AI is a copilot, not a pilot.
5. **"Just chat with me about anything."** An unfocused chat interface invites misuse. All AI features are pinned to specific moments in the UI.

**Principle:** The AI is always pinned to a node, a view, or a specific action. It's never a general-purpose chat box floating in the corner. This is the defensibility argument — your AI knows *this specific DM's campaign*, which no general-purpose tool does.

### 3.6 The data model direction (the most important decision)

You asked specifically: is "every node = markdown file" a smart direction?

**Direction yes, implementation no — not literally as files on disk.**

What you actually want:

- **Each node is a structured object** with metadata (id, type, connections, tags, discovery state, timestamps, media refs) and a **markdown body** (the narrative content).
- **Stored in a database**, not as raw files. Loading 500 files on app-open is a performance non-starter. Databases give you indexes, queries, and real-time sync.
- **Exportable to markdown files** as a first-class feature. This is what gives you the data-ownership story without the performance cost. Users can export their whole campaign as a zip of .md files anytime.
- **Connections are first-class objects**, not just references. They have their own metadata (type, discovery state, notes).

This architecture lets you:
- Render nodes as cards on the canvas
- Render nodes as wiki pages (title + markdown body + backlinks)
- Render lists, timelines, and player view — all from the same data
- Power AI search with vector embeddings on the markdown body + graph context
- Export to Obsidian-compatible markdown for portability

My recommended stack for V1 (opinionated, minimum moving parts):

| Layer | Choice | Why |
|---|---|---|
| Backend | Supabase (Postgres + Auth + Realtime) | Battery-included, SQL, auth solved, realtime for collaboration later |
| Storage | Postgres tables (nodes, connections, campaigns, users) | Real relational queries, easy to index |
| Content | Markdown strings in node rows | Simple, portable, AI-friendly |
| Media | Supabase Storage or Cloudflare R2 | Images as URLs, not base64 blobs |
| Vector search | pgvector in Supabase | Avoids a second service |
| Frontend | What you have (React + Vite + React Flow) | No reason to change |
| Auth | Supabase Auth | Email/password + social logins out of the box |

Firebase (which you have installed but not wired) also works. Supabase's advantage is that Postgres gives you relational joins that map cleanly to a graph of nodes and connections; Firebase's NoSQL model forces you to denormalize. For a graph-shaped product, Supabase wins on fit.

**This is the single architectural decision that unblocks everything else.** Features D (search, AI, multi-campaign, timeline) all require a real backend and a clean schema. Don't build more UI before this decision is made.

---

## 4. What to defer (explicitly, on purpose)

Write these down as "not now, and I'm confident about that." This is the commitment device.

- **D&D Beyond integration** — no official public API; integrations are third-party, fragile, legally grey. *Revisit when you have 1,000 active users and can justify maintenance burden.* Meanwhile, assume users manually keep characters in DDB and your tool separately.
- **Importing official sourcebook content (MM, DMG, PHB)** — this is Hasbro-licensed content. You cannot republish or even reformat it without a license. *Never build this without legal counsel.* Users can reference their own DDB subscriptions in another tab.
- **Mobile-native apps (iOS/Android)** — web-responsive is enough for V1. *Revisit in Phase 3+.*
- **Real-time collaboration** — already flagged as Phase 2 in your docs. Keep it there.
- **Pro-DM monetization features** — attendance billing, CRM, scheduling. Clear V2/V3 wedge but not V1.
- **Discord / Foundry / Roll20 integrations** — V3+.
- **Player view UI** — Phase 2 per your design doc. Data logic is already designed. Keep it deferred.
- **Offline mode** — do NOT build this for V1. Offline is a massive engineering tax. Mobile-responsive web works everywhere with a connection. Defer indefinitely unless user research demands it.
- **Timeline view** — this is a second view. Postpone until after the wiki view ships, so you don't try to build three surfaces at once.

---

## 5. The phase plan

This is the sequence. I'd give yourself generous time for each phase — you're a solo builder balancing this with the rest of your life.

### Phase 0 — Reset (1–2 weeks, mostly writing)

No code. Just decisions.

1. Pick the product name. Write the one-sentence promise. Commit.
2. Pick the V1 user. Write their profile (age, experience, campaign type, tools they use now, what hurts).
3. Rewrite the tenets. Five max. Cut "customizable."
4. Write the AI scope doc (what it does, what it doesn't).
5. Pick the backend (recommend Supabase). Write an architecture-decision memo.
6. Clean up the docs (see §7 below).

Deliverable: an updated README, a rewritten project-brief, a new `architecture.md`, and a decluttered file tree.

### Phase 1 — Data foundation (4–6 weeks)

Rewire the current UI to a real backend with the new data model.

1. Set up Supabase project. Auth with email + Google.
2. Define schema: users, campaigns, nodes, connections, media, tags.
3. Port current sample data (Curse of Strahd cards) into Supabase.
4. Replace session-memory state with queries against the backend.
5. Add basic multi-campaign support: create, list, select, delete, duplicate. No sharing, no permissions yet.
6. Finish the remaining Phase 1 canvas features you already listed: undo/redo, search, drag-to-connect, relationship type labels on edges, lock icon, duplicate with connections, search panel.
7. Implement one-click export: "Download campaign as markdown files."

Deliverable: a working, persistent, single-player product with real auth and real data, running off Supabase. A DM can create an account, start a campaign, build a graph, close the browser, come back a week later, and have it all still there.

### Phase 2 — Wiki view (3–4 weeks)

Add the second surface on the same data model.

1. Every node gets a page URL (/campaigns/[id]/nodes/[slug]).
2. Page view: title, type chip, markdown body, backlinks, connections list, media, tags.
3. Wiki-style edit mode (WYSIWYG markdown).
4. Cross-navigation: click a link in a page → pan canvas to that node; click "edit" on canvas card → open page.
5. Build the info-architecture: types act as collections (e.g., "all characters," "all locations") with list views.

Deliverable: the same data accessible two ways — board and wiki — with first-class navigation between them. This is where the product starts feeling like a real platform rather than a canvas toy.

### Phase 3 — AI copilot (4–6 weeks)

The differentiator. Build it last because it depends on clean data + text content.

1. Embedding pipeline: on node save, embed title + summary + body + connection context; store in pgvector.
2. Semantic search: "ask a question about the campaign," returns grounded answers with node citations.
3. Pinned-AI actions on nodes: "Draft a scene with this NPC," "Suggest missing details," "Generate a name that fits this region."
4. Session recap generator: paste session bullets, get a formatted recap.
5. Gap analysis: "Show me plot threads with no resolution," "Show me NPCs without backstory."

Deliverable: the AI feature that actually makes this product feel like magic. This is the moment you start telling paid DMs about it.

### Phase 4 — Player view + early monetization (6+ weeks)

1. Player view: same graph, filtered through the discovery state you've already designed.
2. Sharing: invite players to view (read-only).
3. The first paid tier: premium features for power users and pro DMs (multi-campaign limits, AI credits, export formats).

Deliverable: a product with a free tier and a paid tier, usable with players.

### Phase 5+ — Pro-DM ops, integrations, mobile apps

Attendance-tied billing, recurring scheduling, session recap delivery, Discord integration, Foundry export. In that rough order.

---

## 6. Scope danger list

Call-outs for where the project is becoming dangerous, muddy, redundant, or premature.

**🔴 Dangerous:**

- **"Customizable" as a principle.** Cut it. Commit to defaults. Let users customize one day if data demands it.
- **Cross-platform support (desktop, tablet, phone) as a V1 claim.** Web-responsive works on all three. Mobile-native apps are a separate, huge engineering commitment. Don't promise it until you can do it.
- **Supporting board AND wiki views before the data model is real.** Building two UIs on session memory will double your work and create drift. Data model first.
- **DDB integration as a feature users expect.** The API situation is fragile. Don't promise this. If you mention it, mention it as "exploratory."

**🟡 Muddy:**

- **"Mind map" as the name.** Already addressed — change it.
- **The relationship between design-document.md and CLAUDE.md.** They're drifting. See §7.
- **The campaign-management feature set.** "Users can create, select, duplicate, delete campaigns" is a clear minimum. Beyond that (sharing? templates? archiving?) is unclear and can wait.
- **Timeline view.** Is it a third top-level surface (with board and wiki) or a feature embedded in the canvas? My lean: it's a view, same data, third navigation option. But defer the implementation until after wiki ships.

**🟠 Redundant:**

- **project-brief.md + README.md + design-document.md + CLAUDE.md** together have overlapping content. The current split is defensible but watch for drift. See §7.

**⚪ Premature:**

- **Offline mode.**
- **Real-time collaboration.**
- **Importing DDB / official content.**
- **Pro-DM features.**
- **AI copilot implementation.** The scope doc should exist now; the code comes in Phase 3.
- **Native mobile apps.**

---

## 7. Engineering & documentation hygiene

You're worried about doc sprawl. The good news: for a personal project you're *more* organized than most. The bad news: it'll get worse as you grow.

### Current state

- `README.md` — status + quick orientation ✓
- `project-brief.md` — problem + success criteria ✓
- `design-document.md` — design decisions ✓ (but drifting)
- `CLAUDE.md` — implementation reality ✓

### Recommended evolution

Move toward this structure once you're in Phase 0:

```
/
├── README.md                    — orientation (stays at root)
├── CLAUDE.md                    — implementation reality + conventions for AI sessions
├── package.json, src/, etc.
├── docs/
│   ├── product/
│   │   ├── vision.md           — replaces/supersedes project-brief.md
│   │   ├── tenets.md           — the five principles
│   │   ├── user-v1.md          — the V1 user profile
│   │   └── ai-scope.md         — what AI does and doesn't do
│   ├── design/
│   │   ├── design-system.md    — fork from current design-document.md; keep evergreen
│   │   └── decisions.md        — ADR log (see below)
│   ├── architecture/
│   │   ├── data-model.md       — schema, relationships
│   │   ├── backend.md          — Supabase setup, auth flow
│   │   └── stack.md            — why we chose what
│   └── strategy/
│       ├── competitive-analysis.md    (the long market report)
│       ├── plain-english-summary.md   (the 12-year-old version)
│       ├── founder-notes.md           (the "my voice" version)
│       └── project-roadmap.md         (this document)
```

### Specific doc hygiene recommendations

1. **Adopt ADRs (Architecture Decision Records).** Each architectural decision (Supabase over Firebase, markdown body in rows vs. files, etc.) gets its own short file — 200 words max — with the date, decision, context, consequences, status. This sounds formal but it saves you from re-litigating the same question six months later. Template:
   ```
   # ADR-007: Supabase over Firebase for backend
   Date: 2026-04-22
   Status: Accepted
   Context: ...
   Decision: ...
   Consequences: ...
   ```

2. **Reconcile `design-document.md` and `CLAUDE.md`.** Right now CLAUDE.md says "when conflicts arise, this file wins," which is correct for a living codebase but means design-document.md is silently going stale. Fix it by splitting the design doc into:
   - `design-system.md` — evergreen, updated as decisions evolve
   - `design-decisions.md` — historical log of decisions as ADRs

3. **Put the roadmap in one place.** Right now Phase 1 / Phase 2 status is duplicated across README, project-brief.md, CLAUDE.md, and design-document.md. Pick one file (`docs/product/roadmap.md`), link to it from others. One source of truth.

4. **Add a `CHANGELOG.md` at root.** Append-only list of what changed each session. Takes 30 seconds, pays back forever.

5. **Kill the `node_modules/` and `dist/` folders from git** if they're in there. Check `.gitignore`. (Quick Bash check would confirm.)

6. **Run `npm audit` monthly.** Not exciting, but security debt accumulates silently.

### On CLAUDE.md specifically

Your current CLAUDE.md is genuinely good — better than 90% of what I've seen. The pattern of "design-document describes intent, CLAUDE.md describes reality, this file wins on conflict" is excellent for AI-assisted development. Keep it.

The risk is that as the project grows, CLAUDE.md becomes a 20,000-word monster. When it gets past ~15k characters, split it:
- `CLAUDE.md` — conventions + pointers to sub-files
- `docs/architecture/*.md` — deep dives that CLAUDE.md references

---

## 8. Specific recommendations by concern

Quick-reference answers to each of the questions you raised.

### "Mind map" as the name

Drop it. Use **Campaign Canvas** or **Campaign Board**. The term "mind map" sells the product short.

### Customizable as a principle

Cut it. Replace with "one canonical campaign, many views." Customization per-user is a later optimization, not a foundational principle.

### Cross-device / cross-platform

Commit to web-responsive in V1. Test on tablet + phone browsers. Do NOT build native mobile apps until you have users who demand it. Offline is indefinitely deferred.

### Tagging, categorization, grouping, linking

These are genuinely core, and they're architectural. In your data model:
- **Tags** — arbitrary strings attached to nodes, user-defined.
- **Types** — a small fixed set (character, location, etc.), typed and colored.
- **Connections** — first-class objects between two nodes, with their own type and metadata.
- **Groups** (maybe) — saved filters / ad-hoc collections. Build if users ask for it.

Do NOT build nested folders or arbitrary hierarchies. Tags + types + connections give you everything hierarchies give you, without the rigidity.

### AI copilot scope

See §3.5 above. Pinned-to-context actions only, never a free-floating chat. Six specific use cases, five explicit non-goals.

### Campaign management

V1 minimum: create, list, select, duplicate, delete. That's it. No sharing, no templates, no archiving until users ask.

### Timelines

Defer. Build after wiki view ships. When you do build it, it's a third view on the same data — filter to nodes with timestamped events, render as a horizontal scroll or vertical feed.

### D&D Beyond integration

Stop treating this as a real roadmap item. No public API. Third-party importers are fragile. Document it as "exploratory, Phase 4+." Don't promise it.

### Sourcebook content (MM, DMG, PHB)

Legal non-starter without a license. Never build. The workaround is "bring-your-own DDB" — link to their DDB content, don't reproduce it.

### Markdown-based files / content architecture

Markdown body in database rows, NOT markdown files on disk. Export to .md files as a feature. Best of both worlds.

### Backend direction

Supabase > Firebase for this product because the data is graph-shaped and relational joins matter. Use pgvector for AI embeddings. Auth out of the box.

### Engineering hygiene

Already covered in §7. Biggest immediate wins: adopt ADRs, split design-document, add a CHANGELOG, pick one place for the roadmap.

---

## 9. What to do this week, concretely

If I were you, here's my 7-day plan:

**Day 1** — Decide the name. Write the one-sentence promise. Commit (literally, in git).

**Day 2** — Rewrite the tenets. Five, max. Cut "customizable." Save as `docs/product/tenets.md`.

**Day 3** — Write the V1 user profile. 500 words. One person. Their day, their pain, their tools. Save as `docs/product/user-v1.md`.

**Day 4** — Write the AI scope doc. What AI does (6 things), doesn't do (5 things). Save as `docs/product/ai-scope.md`.

**Day 5** — Decide on the backend. Stand up a Supabase project. Don't wire it to the app yet; just prove to yourself you can auth and read/write. Write the decision up as `docs/architecture/decisions/adr-001-backend.md`.

**Day 6** — Reorganize the docs per §7. Create the `docs/` folder structure. Move files. Rename design-document.md into design-system.md + decisions log. Consolidate the roadmap into one place. Delete cruft.

**Day 7** — Write your Phase 1 plan in detail. Six to eight specific tickets. Each ticket has acceptance criteria. Put them in a simple todo list, GitHub Issues, Linear, or a `TODO.md` at root. Whatever. Pick a system and use it.

**At the end of week 1 you should have:**
- A renamed product with a committed vision
- A clean doc structure
- A working auth-enabled Supabase project (no UI wired yet)
- A concrete Phase 1 ticket list you can work through

Then Phase 1 starts in earnest. Don't touch Phase 2+ scope until Phase 1 is done. Write that on a sticky note and put it on your monitor.

---

## 10. A principle to carry with you

The biggest strategic error you can make from here is **trying to make multiple decisions feel provisional simultaneously.** Every open question costs daily energy. Decide boldly, write it down, and revisit in six months if needed. A wrong decision you can reverse is cheaper than an eternally-open question that clogs every planning session.

Your instincts on the product are genuinely good. The case-board paradigm, the two-layer discovery, the visual-first, anti-friction philosophy — those are the load-bearing walls of something real. What you need now is not more brainstorming. It's closure on a short list of decisions so you can build.

Close the questions. Build the data model. Add AI last. Ship Phase 1 before you think about Phase 2.

You've got this.

---

*Related: [full market analysis](computer:///sessions/stoic-cool-pasteur/mnt/DnD Campaign Mind Map/Market Research/dm-os-competitive-analysis.md) · [plain-English summary](computer:///sessions/stoic-cool-pasteur/mnt/DnD Campaign Mind Map/Market Research/dm-os-plain-english.md) · [founder-voice summary](computer:///sessions/stoic-cool-pasteur/mnt/DnD Campaign Mind Map/Market Research/my-thinking-on-the-dm-tool-idea.md)*
