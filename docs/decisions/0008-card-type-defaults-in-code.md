# ADR-0008: Card-type defaults in code, customizations as sparse overrides
Date: 2026-05-09
Status: Proposed (will ship before Manage Card Templates)

> **Terminology note (post-2026-05-18):** This ADR predates ADR-0012's `campaign` -> `workspace` rename. References to "campaign(s)" / `campaign_id` here describe the architectural object now called "workspace" / `workspace_id`. The decision content remains accurate; only the names changed.

## Context

Built-in card types — Character, Location, Item, Faction, Story — today
live as **rows in the `node_types` table**, owned per user. On signup,
[`ensureBuiltinTypes()`](../../src/lib/campaigns.js) clones the five
preset definitions from a code constant (`BUILT_IN_TYPES`) into the new
user's personal data. After that, the code constant and the user's rows
have no link.

This shape supports per-user customization in principle (a user can edit
their Faction row's color or icon), but it has a structural problem:
**defaults in code and defaults stored as user rows can drift.** When
the code constant is updated — visual-language refinement, an icon
reconsidered, a label renamed — no existing user's rows update. Only
newly-signed-up users see the change. Existing users keep the stale
default forever, even if they never customized that field.

The problem surfaced concretely on 2026-05-09 during a small icon swap
for Faction (`ShieldPlus` → `ShieldCheckered`, committed `78df33d`).
The code constant updated cleanly, but the user's existing `node_types`
row required a manual SQL update. At single-user scale this is
tractable. At multi-user scale it becomes a recurring migration cost
every time a default changes — not because defaults change capriciously,
but because the visual language *should* be allowed to evolve as the
product matures.

## Customization requirements

Per Erik (2026-05-09), card-type customization at the user-account
level must support:

- Built-in card types are presets every user gets at signup.
- Users can rename, recolor, re-icon, and (later) re-layout any built-in
  type. Examples: "Item" → "Treasure"; Location's blue → green if a user
  has internalized Location as green.
- Users can also create entirely new card types with their own label,
  color, icon, and layout.

The architecture must support both customization paths cleanly without
sacrificing the ability to update defaults globally for users who
haven't customized.

## Decision

Move the five built-in card types out of the `node_types` table's
display columns and into **code-defined defaults**, keyed by short
string keys (`character`, `location`, `item`, `faction`, `story`). User
customizations live in a new sparse table — only the specific fields a
user has modified are stored.

### Source of truth (code)

```js
// src/lib/cardTypes.js (new — supersedes BUILT_IN_TYPES)
export const BUILT_IN_CARD_TYPES = {
  character: { label: 'Character', color: '#7C3AED', iconName: 'UserCircle',     sortOrder: 0, layout: [...] },
  location:  { label: 'Location',  color: '#16A34A', iconName: 'MapPin',         sortOrder: 1, layout: [...] },
  item:      { label: 'Item',      color: '#EA580C', iconName: 'Backpack',       sortOrder: 2, layout: [...] },
  faction:   { label: 'Faction',   color: '#2563EB', iconName: 'ShieldCheckered', sortOrder: 3, layout: [...] },
  story:     { label: 'Story',     color: '#9CA3AF', iconName: 'BookOpen',       sortOrder: 4, layout: [...] },
}
```

`layout` is a forward-looking field — it carries the per-type section
structure that Tailor Card Types will read once that ships. Until then,
all five built-ins use the same default layout.

### Override table

```sql
create table public.card_type_overrides (
  owner_id    uuid not null references auth.users(id) on delete cascade,
  type_key    text not null,        -- 'faction', 'location', etc.
  label       text,                  -- null = use default
  color       text,
  icon_name   text,
  layout      jsonb,
  sort_order  smallint,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (owner_id, type_key)
);

alter table public.card_type_overrides enable row level security;

create policy "Owner can read their overrides"
  on public.card_type_overrides for select
  using (auth.uid() = owner_id);

create policy "Owner can insert their overrides"
  on public.card_type_overrides for insert
  with check (auth.uid() = owner_id);

create policy "Owner can update their overrides"
  on public.card_type_overrides for update
  using (auth.uid() = owner_id);

create policy "Owner can delete their overrides"
  on public.card_type_overrides for delete
  using (auth.uid() = owner_id);
```

A user has zero override rows on day one. Each customization writes (or
updates) one row. Setting all fields on a row back to NULL is equivalent
to "no override" and the row may be deleted.

### Render path

`useNodeTypes()` resolves the effective record by merging built-in
defaults with any user override:

```js
function getEffectiveBuiltinType(key, overridesForUser) {
  const builtin = BUILT_IN_CARD_TYPES[key]
  if (!builtin) return null
  const o = overridesForUser[key] || {}
  return {
    key,
    label:     o.label     ?? builtin.label,
    color:     o.color     ?? builtin.color,
    iconName:  o.iconName  ?? builtin.iconName,
    layout:    o.layout    ?? builtin.layout,
    sortOrder: o.sortOrder ?? builtin.sortOrder,
  }
}
```

Custom (user-created) card types skip the merge and return their stored
fields directly.

### Foreign-key story — B1 (stub rows)

Cards keep referencing card types via `nodes.type_id` UUID. To preserve
the foreign-key constraint, **built-in types still have minimal stub
rows in `node_types`** — but the rows store only `(id, owner_id, key,
is_builtin=true)`. No display data lives in those rows.

Rationale: preserving the database-level guarantee that every node
points to a valid type is more valuable than the conceptual purity of
having zero database rows for built-ins. The stub rows are a few hundred
bytes per user. The alternative (B2: migrate `nodes.type_id` UUID →
`nodes.type_key` TEXT, with no FK against built-ins) was considered and
rejected — the migration is invasive and the FK guarantee is easy to
keep.

Custom (user-created) types live in the same `node_types` table with
`is_builtin=false` and the full set of display columns populated. The
table now has two row shapes: stubs for built-ins, full rows for
customs. Code at every read path checks the `is_builtin` flag and
either resolves through `BUILT_IN_CARD_TYPES` + overrides, or returns
the stored display columns directly.

### Migration

1. New migration creates `card_type_overrides` table + RLS.
2. Read every existing row in `node_types` where `is_system = true`.
3. For each row: compare each display field against `BUILT_IN_CARD_TYPES[key]`.
   Any field that differs → insert into `card_type_overrides`. Identical → no override row.
4. Drop / nullify the display columns on `node_types` rows where `is_builtin=true`. Rename `is_system` to `is_builtin` for clarity. Custom rows are untouched.
5. Update `ensureBuiltinTypes()` to insert only stub rows on signup (no display data).
6. Update `useNodeTypes()`, `CreateTypeModal`, `EditModalHeader`, `TypePicker`, and any other consumers to read through the new merge path.

For Erik's current data (one user, no real customizations beyond the
just-shipped Faction icon — which after the SQL update matches the new
default exactly), step 3 produces **zero override rows**. Migration
runs in seconds.

## Consequences

**Benefits:**

- **Default changes propagate instantly.** Update an icon, color, label,
  or layout in code; every user who hasn't overridden that specific
  field sees the change on next page load. The icon-swap-style migration
  cost goes to zero for non-customized fields.
- **Storage is honest.** A user with zero customizations has zero override
  rows. Database does not carry millions of cloned defaults.
- **Architectural clarity.** Presets are the product, customizations are
  user data. The two are visibly separated in both code structure and
  database schema. Future readers can reason about each independently.
- **Layout customization drops in cleanly.** When Tailor Card Types
  ships, `layout` is just another field that can be overridden.
- **Manage Card Templates is simpler to build on top.** The "built-in
  vs custom" question has a clean answer (lookup against
  `BUILT_IN_CARD_TYPES`); the "what does the user see?" question has a
  clean answer (merge defaults + overrides for built-ins, return
  stored fields for customs).

**Trade-offs accepted:**

- **Render-time merge.** Every type lookup performs a small object merge
  (built-in + override). Cost is microseconds; not a real performance
  concern at any reasonable scale.
- **Migration cost.** ~M (1–3 days) to refactor the data path, write the
  migration, update consumers, update tests, update [CLAUDE.md](../../CLAUDE.md).
  One-time cost.
- **Two row shapes in `node_types`.** Stubs for built-ins, full rows for
  customs, distinguished by `is_builtin`. Conceptually asymmetric, but
  every read path that cares already has the `is_builtin` flag in hand
  and the asymmetry is contained.
- **Sequencing constraint.** This work must land before Manage Card
  Templates. MCT's flows for editing built-in types depend on the
  override table existing.

**When to revisit:**

- If accumulated special-case logic around stub rows ever becomes a
  maintenance cost in its own right, migrate to B2 (drop stub rows;
  `nodes.type_key` TEXT). Not foreseeable today.
- If users start customizing layouts heavily AND default layouts evolve
  often, consider finer-grained override (per-section override rather
  than whole-layout override). Speculative.

## References

- BACKLOG entry: *Card-type defaults in code* (Foundational Progress) —
  implementation work, sequenced before Manage Card Templates.
- Triggered by: 2026-05-09 Faction icon swap (committed `78df33d`) which
  surfaced the drift problem in concrete form.
- Customization scope confirmed by Erik in conversation 2026-05-09:
  built-in types are user-customizable on label, color, icon, and (V2+)
  layout; new types are also creatable.
- Related: [Manage Card Templates](../../BACKLOG.md) — depends on this
  work landing first; the override table and merge path are its
  substrate.
- Related: [Tailor Card Types](../../BACKLOG.md) — `layout` overrides
  ride on the same table once that work begins.
- Related: [Known Divergences](../../CLAUDE.md) — this ADR addresses
  the implicit divergence between code defaults and user-stored
  defaults that the Faction icon swap exposed. The historically related
  "custom node types are still localStorage-only" divergence was
  independently cleared by an earlier migration to a DB-backed
  `useTypeStore` (custom types now write straight to `node_types`)
  and is no longer in the Known Divergences table.
