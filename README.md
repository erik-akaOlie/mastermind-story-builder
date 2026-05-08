# MasterMind: Story Builder

A visual, interactive continuity database for Dungeon Masters and Game Masters. Think investigator's case board — characters, locations, items, factions, and story threads as connected cards on an infinite canvas, backed by a real database so your world persists across sessions.

See [`project-brief.md`](./project-brief.md) for the problem statement and success criteria.
See [`design-document.md`](./design-document.md) for design decisions and interaction patterns (some diverged — see CLAUDE.md for the current reality).
See [`CLAUDE.md`](./CLAUDE.md) for the source-of-truth implementation guide.
See [`Market Research/`](./Market%20Research/) for the competitive analysis and strategic roadmap.

---

## Running Locally

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

## What's Built

### Auth + Campaigns

- Email + password authentication via Supabase Auth
- Multi-campaign support: create, rename, delete, switch between campaigns
- Row Level Security ensures each user only sees their own campaigns
- Campaign picker is the landing screen after sign-in; profile avatar (top-right) opens a menu with sign-out

### Canvas

- Infinite canvas with pan (spacebar + drag), zoom (Ctrl+scroll / pinch), and marquee selection
- Shift+click multi-select
- Right-click canvas → Add card (with type submenu) or Add text
- Right-click any card → Edit, Duplicate, Delete

### Campaign Cards

- Five built-in types per campaign: Character, Location, Item, Faction, Story — each with its own color and Phosphor icon
- Custom type creation (design exists, color picker + icon picker)
- Card header: type-colored background, D-shaped avatar, title, type icon — all with luminance-adaptive text color
- Card body: summary line + story note bullets + connection dots on card borders
- Zoom-compensated titles (readable at any zoom level)
- Dynamic icon visibility: the type icon hides automatically if the title would otherwise overlap it at extreme zoom-out
- Hover, selected, and dimmed states

### Edit Modal

- Opens with a morph animation from the card's canvas position
- Auto-saves 400ms after any change; flushes immediately on close — no Save button
- Sections: title, type selector, avatar/thumbnail, summary, story notes, hidden lore (DM-only), DM notes, inspiration images, connections
- Drag-to-reorder bullets and images
- Image lightbox
- Connection management: add via dropdown picker (alphabetical, strips "The " prefix), remove individually

### Text Annotations

- Freestanding text blocks on the canvas (not connected to any card)
- Double-click to edit; blur to save
- Floating toolbar: font size (S/M/L/XL), alignment (L/C/R), bold, italic, delete
- Bold and italic are per-selection (highlight text, then apply)
- 8 resize handles (corners resize both axes; edges resize one axis)
- Grip icon in toolbar to drag the block while in edit mode

### Connections

- Created inside the edit modal (Connections section)
- Straight lines, border-to-border, no arrows
- Colored dots on card borders show connection count and type of connected cards
- Multiple connections on the same side spread automatically (16px minimum gap)

### Persistence

- All campaign data (cards, connections, sections, text annotations, positions) persists to Supabase
- Optimistic UI: changes appear instantly, write to the database in the background
- Refreshing or closing the browser preserves all work

### Image Storage

- Avatars and inspiration images upload to a private **Supabase Storage** bucket (`card-media`)
- Two variants generated client-side at upload: a 256px thumb for canvas/list use and a 1920px full-size for the lightbox — both WebP
- The database stores only the path; renderers fetch a fresh signed URL each render via `useImageUrl`
- Bucket access is RLS-gated to the campaign owner via a `SECURITY DEFINER` helper. See [ADR-0005](./docs/decisions/0005-image-storage.md).

---

## What's Not Built Yet

### Sprint 1.5 (planned next)

- Realtime cross-tab / cross-device sync via Supabase Realtime

### Sprint 2

- Undo / redo (Ctrl+Z / Ctrl+Shift+Z)
- Card templates per node type (pre-populated default sections)

### Sprint 3

- Modular card sections UI (reorder, add, remove sections; edit templates)

### Sprint 4

- Search panel (right-side slide-out)
- Canvas drag to create connections (hover border → drag → snap)
- Relationship type labels on edges
- Shift+1 fit-all

### Sprint 5

- AI copilot grounded in campaign data (semantic search, draft assistance, gap analysis, session recaps)

### Deferred

- Player view interface
- Sharing / collaboration
- D&D Beyond integration
- Native mobile apps

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite |
| Canvas | React Flow v11 |
| Styling | Tailwind CSS v3 |
| Icons | Phosphor Icons |
| Drag-to-reorder | dnd-kit |
| State | Zustand v5 (node types + canvas UI flags); React state for canvas data |
| Auth + DB | Supabase (Postgres + Auth + RLS) |
| Image storage | Supabase Storage (`card-media` bucket, signed URLs) |

---

## Project Structure

```
├── src/
│   ├── App.jsx           Canvas orchestration (composes hooks; renders ReactFlow + menus + modal)
│   ├── lib/              Data access + Supabase client + image storage helpers
│   ├── hooks/            useSpacebarPan, useCampaignData, useEdgeGeometry, useNodeHoverSelection
│   ├── store/            useTypeStore, useCanvasUiStore, useSyncStore (Zustand)
│   ├── components/       Login, CampaignPicker, EditModal, Lightbox, MigrateImages, ...
│   ├── nodes/            CampaignNode, TextNode (React Flow node types)
│   ├── edges/            FloatingEdge
│   └── utils/            edgeRouting, labelUtils
├── supabase/
│   ├── schema.sql        Initial database schema + RLS policies
│   └── migrations/       Incremental migrations (run after schema.sql, in numeric order)
├── docs/decisions/       ADRs covering architecture calls (Supabase, image storage, etc.)
├── Market Research/      Competitive analysis, strategic roadmap, founder memos
├── public/avatars/       Static avatar images for the sample Strahd data
├── .env.example          Template — copy to .env and fill in your Supabase credentials
└── CLAUDE.md             Source of truth for AI sessions
```
