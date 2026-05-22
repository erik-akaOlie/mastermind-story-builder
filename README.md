# MasterMind: Story Builder

A visual canvas for building a story world as an interconnected web of cards — see the whole at once, trace connections, spot gaps and opportunities. Backed by a real database, with the relationships between cards as first-class as the cards themselves. V1 is built for game masters; think investigator's case board for worldbuilding.

---

## For new contributors (and AI sessions)

If you're a new Claude Code / Cowork session or a new contributor, read in this order. The goal: ~15 minutes of reading gets you 80% of what you need.

**Always read first:**

1. [`CLAUDE.md`](./CLAUDE.md) — implementation reality, conventions, current state. The longest doc but the most current.
2. [`docs/product/roadmap.md`](./docs/product/roadmap.md) — what's in V1, V2+, V3+, and explicitly out.
3. [`docs/product/glossary.md`](./docs/product/glossary.md) — vocabulary (Version, Value Add, Effort Size, Impact, Depth Level). Read if any term in a doc looks ambiguous.

**Read when relevant to the task:**

- [`BACKLOG.md`](./BACKLOG.md) — for prioritization or sprint planning
- [`docs/design/design-system.md`](./docs/design/design-system.md) — for design or UI work
- [`docs/decisions/`](./docs/decisions/) — read the ADRs that touch the area you're working on
- [`CHANGELOG.md`](./CHANGELOG.md) — for "what shipped recently and why"

**Read when revisiting strategy:**

- [`docs/product/vision.md`](./docs/product/vision.md) — what the product is and who it's for
- [`docs/product/tenets.md`](./docs/product/tenets.md) — guiding principles
- [`docs/strategy/`](./docs/strategy/) — competitive analysis, plain-English summary, founder notes

---

## Source-of-truth hierarchy

When two docs disagree, the source of truth wins; the other gets updated.

| Topic | Source of truth |
|---|---|
| Product vision | [`docs/product/vision.md`](./docs/product/vision.md) |
| Version scope (V1, V2, V3, out) | [`docs/product/roadmap.md`](./docs/product/roadmap.md) |
| Tenets / principles | [`docs/product/tenets.md`](./docs/product/tenets.md) |
| Vocabulary | [`docs/product/glossary.md`](./docs/product/glossary.md) |
| Design intent | [`docs/design/design-system.md`](./docs/design/design-system.md) |
| Implementation reality | [`CLAUDE.md`](./CLAUDE.md) |
| Architectural / product decisions | [`docs/decisions/`](./docs/decisions/) (ADRs) |
| What's queued | [`BACKLOG.md`](./BACKLOG.md) |
| What shipped | [`CHANGELOG.md`](./CHANGELOG.md) |
| Strategic context | [`docs/strategy/`](./docs/strategy/) (read for context, not authoritative) |

---

## Running locally

### Prerequisites

- Node 18+ and npm
- A Supabase project (free tier is fine)

### Setup

```bash
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase dashboard
```

If this is a fresh Supabase project, run **all three** SQL files once in the Supabase SQL Editor (in order):

1. [`supabase/schema.sql`](./supabase/schema.sql) — tables + RLS policies
2. [`supabase/migrations/001_node_types_per_user.sql`](./supabase/migrations/001_node_types_per_user.sql) — moves `node_types` to per-user ownership
3. [`supabase/migrations/002_card_media_bucket.sql`](./supabase/migrations/002_card_media_bucket.sql) — creates the image-storage bucket and its RLS

Each file is idempotent and safe to re-run.

Then:

```bash
npm run dev
```

Opens at `http://localhost:5173`. Sign up with an email on first visit (Supabase sends a confirmation).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite |
| Canvas | React Flow v11 |
| Styling | Tailwind CSS v3 |
| Icons | Phosphor Icons |
| Drag-to-reorder | dnd-kit |
| State | Zustand v5 (node types + canvas UI flags); React state for canvas data |
| Auth + DB | Supabase (Postgres + Auth + RLS) |
| Image storage | Supabase Storage (`workspace-media` bucket, signed URLs) |

For the full file map, conventions, architectural notes, and current implementation reality, see [`CLAUDE.md`](./CLAUDE.md).

---

## Repository layout

```
├── src/                         React + React Flow application
├── supabase/                    Schema + migrations (run once per project)
├── public/avatars/              Static avatar images for sample data
├── docs/
│   ├── product/                 Vision, roadmap, tenets, glossary (source of truth)
│   ├── design/                  Design system (interaction patterns, visual grammar)
│   ├── decisions/               Architecture Decision Records (ADRs)
│   └── strategy/                Competitive analysis, founder notes (context, not authoritative)
│       └── archive/             Superseded strategy docs (banner-marked)
├── weekly-updates/              Public progress posts + the prompt that generates them
├── CLAUDE.md                    Implementation reality (entry point for AI sessions)
├── BACKLOG.md                   Living backlog
├── CHANGELOG.md                 What shipped
└── README.md                    This file — orientation and navigation
```
