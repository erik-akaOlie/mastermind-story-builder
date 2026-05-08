# MasterMind: Story Builder — Build Plan

*Synthesized from the full conversation: competitive analysis, project evaluation, roadmap, rename decision, Supabase commitment, and the collaborative working model Erik and Claude agreed on.*

---

## Context: what we've decided

**Product name.** MasterMind: Story Builder.

**V1 user.** Erik — a UX designer building a D&D campaign for his family. The family consumes the experience Erik crafts; they do not log into MasterMind themselves (for now).

**Use case.** Evening worldbuilding for a paused family campaign. Erik builds MasterMind during the day and uses it at night to flesh out the world. Agile loop: build → use → notice pain → fix tomorrow.

**Urgency.** Usable nightly as soon as possible. "Rough-but-working" beats "polished-but-delayed."

**Collaboration model (Option D).**
- Erik: product direction, UX, design, visual decisions, project management (collaborative).
- Claude: writes the code, owns architecture, enforces best practices, continually audits structure, file organization, and strategic direction for flexibility. Reviews happen every sprint.

**Phase-1 features — confirmed scope.**
| Feature | Decision |
|---|---|
| Undo / redo | **Must-have** (Sprint 2) |
| Drag-to-connect | Nice-to-have (Sprint 4) |
| Lock / unlock cards | **Cut** |
| Duplicate with connections | **Cut** (plain duplicate is enough) |
| Search panel | Sprint 4 |
| Relationship-type labels on edges | Sprint 4 |
| Modular card sections | Schema-ready in Sprint 1, UI in Sprint 3 |
| Per-type card templates | Groundwork in Sprint 2, full editor in Sprint 3 |

**Persistence.** Supabase (Postgres + Auth + RLS + pgvector for future AI). Firebase will be uninstalled from the project — it's dead weight.

**Modular cards + templates — the architectural answer.** Design the schema now to support them. Build the UI for them later. This is cheap today and unblocks future flexibility for free.

---

## Why schema-first, UI-later on modularity

The long version of the answer in chat:

- **Database migrations are expensive.** Once real content is in the tables, changing the shape of those tables is risky and awkward.
- **UI is cheap.** You can redo a card editor in a weekend without touching a single row of data.
- **The shape that buys us flexibility:** cards have a `sections` child table where each row is one section (a narrative, a lore bullet list, a piece of media, etc.) with a kind, a content field, and a sort order. Today, the UI always renders the same four sections in the same order for every card type — exactly like the current product. Tomorrow, the UI unlocks reorder, add, remove, or custom sections. The database doesn't change.
- **Templates as data, not code.** Each card type has an associated template that defines the default sections a new card of that type should start with. When you later edit the Character template to include a new "Voice notes" section, every future Character card inherits it.

---

## Recommended schema (first draft)

```
users                  (id, email, created_at)

campaigns              (id, owner_id, name, description, cover_image_url,
                        created_at, updated_at)

node_types             (id, campaign_id, key, label, color, icon_name,
                        is_system, sort_order)
                       -- built-in types live here too; is_system = true

nodes                  (id, campaign_id, type_id, label, summary,
                        avatar_url, position_x, position_y,
                        created_at, updated_at)

node_sections          (id, node_id, kind, title, content, sort_order)
                       -- kind: 'narrative' | 'hidden_lore' | 'dm_notes' |
                       --       'media' | 'custom'
                       -- content: markdown or structured JSON

node_templates         (id, campaign_id, type_id, name, created_at)

node_template_sections (id, template_id, kind, default_title, sort_order)

connections            (id, campaign_id, source_node_id, target_node_id,
                        created_at)

connection_types       (id, campaign_id, label, is_system)

connection_type_links  (connection_id, type_id)
                       -- a connection can carry multiple relationship types

media                  (id, node_section_id, url, kind, is_primary,
                        is_player_visible, sort_order)

text_nodes             (id, campaign_id, content_html, position_x,
                        position_y, width, height, font_size, align)
```

Row Level Security on every table: users only read/write rows in campaigns they own. This is enforced at the database level so a bug in app code can't accidentally leak other users' data.

Expect this schema to evolve before we run it — I'll iterate with you before we paste anything into Supabase.

---

## The plan: six sprints

Each sprint is a unit of work that ends with something usable. Calendar time depends on your pace; I'm giving session estimates, where one "session" is a meaningful chunk of focused work (not an hour).

### Sprint 0 — Setup and housekeeping (1–2 sessions)

Runs in parallel with Sprint 1. Doesn't block anything.

- Rename in code: `package.json`, README, CLAUDE.md, design docs all reference "MasterMind: Story Builder."
- (Optional, when convenient) Rename the folder and git repo.
- Add `.env` with Supabase URL + anon key; confirm `.gitignore` excludes it.
- Uninstall Firebase packages from `package.json` — dead weight.
- Reorganize docs:
  - Move market-research and planning files into `docs/strategy/`.
  - Split `design-document.md` into `docs/design/design-system.md` (evergreen) and `docs/design/decisions.md` (append-only ADR log).
  - Add `CHANGELOG.md` at root.
  - First ADR: "Supabase over Firebase."
- Consolidate the roadmap into one place — the `Phase 1 / Phase 2` lists currently duplicate across three docs.

### Sprint 1 — Supabase and persistence (3–5 sessions)

The unblocking sprint. When this is done, evening work is saved between sessions.

1. Create the Supabase project.
2. Run the schema SQL in the SQL editor (I'll write it).
3. Enable Row Level Security on every table; add ownership policies.
4. Install `@supabase/supabase-js`; configure the client from env vars.
5. Build auth: login page, logout, protected routes. Email + password to start.
6. Refactor React state: split persistent fields from UI-only fields per CLAUDE.md's pending refactor note.
7. Wire `campaigns` CRUD (create, list, select, rename, delete).
8. Wire `nodes` CRUD — replace session memory with real queries.
9. Wire `connections` CRUD.
10. Wire `text_nodes` CRUD.
11. Wire `node_sections` under the hood — the editor writes section rows even though the UI still shows the same fixed four sections.
12. Optionally seed the Strahd sample data into your first real campaign.
13. Deploy to Vercel or Netlify so MasterMind is accessible from any browser.

**Exit criteria:** you can log in, create a campaign, add cards and connections, close the browser, come back tomorrow, everything's still there.

**This is the "day-one usable" milestone.** Start using it in the evenings now.

### Sprint 2 — Undo/redo + card-template groundwork (2–4 sessions)

Fill in the two things that make evening use feel frictionless instead of fragile.

1. **Undo/redo.** Snapshot-based per CLAUDE.md design. Ctrl+Z / Ctrl+Shift+Z. 50-step limit. Snapshots cover node + connection + text-node state.
2. **Templates as data.** Each built-in type gets a template in the database. When you create a new Character, it's pre-populated from the Character template. Still no template *editing* UI yet — just the "templates exist and drive creation" infrastructure.

**Exit criteria:** evening worldbuilding feels agile. You can experiment freely and recover from mistakes.

### Sprint 3 — Modular card sections UI (3–5 sessions)

Activate the modularity the schema has been quietly supporting.

1. Reorder sections within a card (drag-and-drop).
2. "Add section" — pick from a known set of kinds (narrative bullets, DM notes, hidden lore, media, custom text block) or create a custom section on the fly.
3. "Remove section" — with confirmation if the section has content.
4. **Template editor.** Edit the default template for each card type. Preview what a new card of that type will look like. Changes apply to future cards, not retroactively.
5. Optionally: per-card "apply template" button to re-align an existing card to its type's current template.

**Exit criteria:** you can shape a Character card differently from a Location card without touching code. You can invent a "Rumor" custom type with its own sections.

### Sprint 4 — Search, drag-to-connect, relationship labels (3–5 sessions)

The convenience features on your Phase-1 list that aren't critical for Day 1 but matter a lot as the graph grows.

1. **Search panel** — right-side slide-out per current design spec.
2. **Drag-to-connect** — hover border → drag → snap to target card.
3. **Relationship-type labels on edges.** Connections can carry multiple relationship types. Hover an edge to see its labels. Manage from the edit modal.
4. Basic filtering — show only nodes of certain types, or only discovered/undiscovered nodes.

### Sprint 5 — AI copilot, grounded in campaign data (4–6 sessions)

The product's defensible differentiator. Do it last because every sprint before it fattens the corpus the AI gets to work with.

1. **Embedding pipeline.** On save, embed node title + summary + section content into pgvector. Re-embed on update.
2. **Semantic search.** "Who was the elf priest we met in session 3?" → grounded answer with a link to the node.
3. **Pinned AI actions on cards.**
   - "Suggest a connection this character might have"
   - "Draft this section"
   - "Flag gaps in this node"
4. **Session recap generator.** Paste raw session bullets → generate a narrative recap in your world's voice.
5. **Gap analysis across the campaign.** "Show me plot threads with no resolution," "NPCs mentioned in notes but not yet carded."

### Sprint 6+ — Player view, sharing, integrations, monetization

Deferred per prior planning. Revisit once the above is in daily use.

---

## Working conventions (standing, every sprint)

Per Erik's standing request, every sprint ends with a short (~15 min) architecture and hygiene review:

- **Code structure.** Is `App.jsx` growing too big? Should we be extracting hooks or components? Are there patterns drifting out of sync?
- **File organization.** Are new files going to the right place? Is anything redundant?
- **Documentation.** Did anything material change that should be noted in CLAUDE.md, design-decisions.md, or the ADR log?
- **Architectural debt.** Anything we took a shortcut on that should be paid down before it ossifies?
- **Flexibility audit.** Are we still positioned to make the "drastic UX changes" Erik wants to be free to make? Or have we accidentally painted ourselves into a corner?

Short reviews catch drift early and are cheap. Skipping them is how solo projects become unmaintainable.

---

## The single concrete next step

**Create a free Supabase account and a new project.**

Go to [supabase.com](https://supabase.com/), sign up, and make a new project. Name it something like `mastermind` or `mastermind-story-builder`. Pick a region close to you. Save the generated database password somewhere safe (you won't need it immediately but you'll want it later).

Once the project is provisioned (takes about 2 minutes), Supabase will show you a `Project URL` and a bunch of API keys. Send me the Project URL. **Do not share the service-role key with anyone, including me.** The anon/public key is okay to share if you want, but we'll handle it via `.env` so it doesn't need to leave your machine.

As soon as you have a project URL, I'll:
1. Draft the schema SQL for you to paste into Supabase's SQL editor.
2. Walk you through what each table does, in plain language, so you're not copy-pasting blind.
3. Set up the auth flow and the env-var wiring on the React side.

Then Sprint 1 is rolling and you're a few sessions from having evening-worldbuilding persistence.

---

*Related docs:*
- *[Competitive analysis (full market report)](computer:///sessions/stoic-cool-pasteur/mnt/DnD Campaign Mind Map/Market Research/dm-os-competitive-analysis.md)*
- *[Plain-English summary of the market](computer:///sessions/stoic-cool-pasteur/mnt/DnD Campaign Mind Map/Market Research/dm-os-plain-english.md)*
- *[Founder-voice version of the thinking](computer:///sessions/stoic-cool-pasteur/mnt/DnD Campaign Mind Map/Market Research/my-thinking-on-the-dm-tool-idea.md)*
- *[Project structure + strategic roadmap (pre-narrow)](computer:///sessions/stoic-cool-pasteur/mnt/DnD Campaign Mind Map/Market Research/project-structure-and-roadmap.md)*
