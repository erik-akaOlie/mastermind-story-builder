# ADR-0002: Modular node sections in the schema from day one
Date: 2026-04-22
Status: Accepted

## Context

A future direction for MasterMind is **modular card content**: each card has a list of sections (narrative, hidden lore, DM notes, media, custom-named blocks) that the user can reorder, add, remove, or template per card type. The UI for that is Sprint 3 work.

At the same time, Sprint 1's goal is to wire persistence end-to-end using the current fixed-section UI (narrative bullets, hidden lore, DM notes, and media attachments). The question: should the Sprint 1 schema hard-code those four sections as columns on `nodes`, or should it model sections as a separate child table from the start?

## Decision

Model node sections as a separate child table, `node_sections`, from day one.

```sql
node_sections (
  id         uuid primary key,
  node_id    uuid references nodes(id) on delete cascade,
  kind       text,       -- 'narrative' | 'hidden_lore' | 'dm_notes' | 'media' | 'custom'
  title      text,
  content    jsonb,
  sort_order integer
)
```

Sprint 1 UI still renders the same four fixed sections, but the data layer writes rows to this table rather than columns on `nodes`.

## Consequences

- **Schema migrations are the expensive part of a backend's life** — they're risky and slow once real data exists. UI changes are cheap by comparison.
- **Paying a small amount of schema complexity upfront** (one extra table, marshaling logic in `lib/nodes.js`) in exchange for unbounded UI flexibility later.
- When Sprint 3 ships the modular sections UI (reorder, add, remove, custom types), the database is already ready. No migration required.
- Trade-off: the marshaling layer in `lib/nodes.js` must translate the React card shape (flat fields `storyNotes`, `hiddenLore`, `dmNotes`, `media`) to and from the DB shape (rows keyed by `kind`). For V1 we replace all sections on every save; an upsert-based approach can come later.

## References
- Schema: `supabase/schema.sql`
- Marshaling: `src/lib/nodes.js`
- Roadmap: `Market Research/mastermind-build-plan.md` (Sprint 3)
