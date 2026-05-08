# Changelog

A running log of meaningful changes to MasterMind: Story Builder. Append-only. Newest at top.

## [Unreleased]

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
