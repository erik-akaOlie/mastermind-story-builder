# ADR-0001: Supabase over Firebase as the backend
Date: 2026-04-22
Status: Accepted

## Context

MasterMind needs persistent storage for campaigns, cards (nodes), sections, connections, and text annotations. The app is inherently **graph-shaped**: cards connected to other cards via typed relationships, with cards belonging to campaigns, owned by users.

Firebase was installed (but never wired) early in Phase 1 as a placeholder. In Sprint 1 we had to commit to one backend and build on it.

Candidates considered:

- **Firebase Firestore** (NoSQL document database)
- **Supabase** (hosted Postgres + Auth + Realtime + Storage)
- Self-hosted Postgres + custom auth (rejected outright: too much infrastructure for a solo builder)

## Decision

**Use Supabase.**

## Consequences

**Why Supabase wins here:**
- The data is relational: `campaigns → nodes → node_sections`, `connections` reference two `nodes`, etc. Postgres joins these cleanly. Firestore's denormalized document model would require us to duplicate data and manage consistency manually.
- Row Level Security (RLS) is first-class in Postgres/Supabase. Writing `auth.uid() = owner_id` policies is straightforward. Firebase Security Rules exist but the graph-of-campaigns ownership model is awkward to express.
- `pgvector` is built into Supabase, which is important for the Sprint 5 AI copilot (semantic search over campaign data).
- Realtime (Sprint 1.5) uses Postgres logical replication — a simple `postgres_changes` subscription gives cross-tab sync.
- Auth is included, email+password works out of the box, and OAuth providers are configurable when we want them.

**Consequences accepted:**
- Two inserts are required to create a campaign (campaign + seeded node_types). This is not transactional at the JS level; a partial failure would leave an orphan campaign with no types. For V1 this risk is tolerated; we can promote to an RPC / stored procedure later if it matters.
- Supabase's free tier limits: 500 MB database, 50,000 monthly active users, 2 GB bandwidth. Sufficient for personal use and early external testing; we'll need to upgrade if we open it to real traffic.
- Lock-in: migrating off Supabase later is non-trivial (Postgres DDL is portable, but auth user IDs and RLS are Supabase-specific). Accepted as a reasonable trade-off for speed.

**Firebase cleanup:** the `firebase` npm package was uninstalled. Do not reintroduce it.

## References
- Project Roadmap: `Market Research/project-structure-and-roadmap.md`
- Schema: `supabase/schema.sql`
- Client setup: `src/lib/supabase.js`
