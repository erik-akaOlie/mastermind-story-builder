# ADR-0004: Inline `@`-mention syntax for cross-card references
Date: 2026-04-27
Status: Accepted (design locked; build deferred to ~Sprint 4)

## Context

Today, the only way to express a relationship between two cards is the
**Connections** section of the edit modal — pick another card from a list,
click "Add." It works, but it's separated from the act of writing. A DM
typing "father to Ireena Kolyana" in Strahd's narrative bullet is *thinking*
about the relationship; making them stop, switch to the Connections section,
search for Ireena, and add her there is friction.

Most modern note tools (Notion, Roam, Obsidian, Linear) solve this by letting
users type `@` (or `[[`) inline while writing, get an autocomplete of
existing entities, and select one. The resulting reference becomes a
clickable link AND establishes a queryable relationship.

We want the same thing here, with two product properties:

- **One source of truth per relationship.** A connection between two cards
  exists in exactly one row in the `connections` table. Both cards "see" it
  because canvas/edit-modal queries return connections touching either node.
  No duplication, no sync between two records.
- **Inline mentions create connections automatically.** When Strahd's bullet
  contains a mention of Ireena, a `connections` row exists. When the mention
  is removed, the row is removed. When it changes to a different card, the
  row updates accordingly.

The build is deferred until Sprint 4 (alongside search, which shares the
autocomplete-over-cards UI). But the **storage syntax** is decided now so
text written today doesn't accidentally use `@` for something incompatible
later.

## Decision

### 1. Storage syntax

Mentions are encoded inline in the existing JSONB text content (bullets,
paragraphs, summaries) using this exact pattern:

```
@[card-id|Display Name]
```

- `card-id` is the UUID of the referenced card. **Source of truth.**
- `Display Name` is a cached human-readable label for offline render. May
  drift from the card's current label; UI prefers a live lookup when it has
  one and falls back to the cached display name otherwise.
- The pipe (`|`) is the separator. The opening `@[` and closing `]` are
  literal.

Examples:

```
"father to @[3f2e8a1c-…|Ireena Kolyana]"
"the @[d91b4502-…|Vistani] camped outside the village"
```

Why this shape:

- **Card-id is the durable reference.** Cards can be renamed; ids can't.
  Storing the id keeps mentions valid forever.
- **Display name is cached.** Lets the renderer produce something readable
  even before the cards collection is loaded, and gives a sane fallback if
  the referenced card is later deleted.
- **Embedded in the existing string.** No DB schema change is needed —
  bullets stay as JSONB arrays of strings. Old plain-text bullets without
  mentions remain valid; the renderer just passes them through.

### 2. Connection lifecycle

When card content is saved, the data layer:

1. Parses all `@[card-id|...]` mentions out of every text field on the card.
2. Diffs the set of mentioned card-ids against the current rows in
   `connections` where this card is the source.
3. Inserts new `connections` rows for newly added mentions; deletes rows for
   mentions that disappeared.

Rules:

- A mention always corresponds to a connection from the **mentioning** card
  to the **mentioned** card (directional in the row, undirected in the UI
  for now).
- Manual connections (added via the Connections section of the edit modal)
  coexist with mention-driven connections. They are **the same** rows in
  the same table — there is no "kind" column distinguishing them.
- If the same target appears multiple times in the same card's text, only
  one connection row exists. (Connection set is a set, not a multiset.)

### 3. Reserved character

The literal `@` in text content is reserved as the trigger for the inline
mention picker once the feature ships. Until then, it has no special
meaning. Any `@` in existing content will simply render as-is.

### 4. Out of scope for V1

- **Backlinks panel.** "Mentioned in" sections on the target card. Powerful;
  not free. Deferred.
- **Group mentions.** `@all-characters` or similar. Deferred.
- **Cross-campaign mentions.** A card in Campaign A mentioning a card in
  Campaign B. Deferred until card-copy ships, which has its own design
  conversation.

## Consequences

**Benefits:**

- Writing connections becomes part of writing prose. Lower friction = more
  connections recorded = richer graph.
- One source of truth per connection (`connections` table) — no risk of
  drift between two cards' representations of the same relationship.
- The DB schema does not change. Existing plain-text bullets remain valid
  forever.
- The decision is portable: when this feature is built, no migration of
  existing data is required.

**Trade-offs accepted:**

- The cached display name in the syntax can go stale if the target card is
  renamed. Renderers should prefer a live lookup when available; the cache
  is a fallback for offline / first-paint rendering.
- Parsing text on every save adds a small cost. For V1's text sizes this is
  rounding error.
- If a referenced card is deleted, its mentions become "broken." The
  renderer should display the cached display name with a struck-through or
  muted treatment, and the `connections` row will be cascade-deleted by
  the existing FK constraint, so the canvas line disappears cleanly.

**When to revisit:**

- When backlinks become a product priority (Sprint 5+).
- When markdown export ships — the export step needs to translate
  `@[card-id|Display Name]` into a portable representation (likely a
  wiki-style `[[Display Name]]` with a separate id reference).
- If users ever need to preserve a literal `@[…|…]` string in content
  without it being parsed as a mention, we'll need an escape mechanism
  (e.g. `\@[…]`). Defer until someone actually hits this.

## References

- The connections table schema: [`supabase/schema.sql`](../../supabase/schema.sql)
- Related: [ADR-0002 (modular sections)](./0002-modular-node-sections.md) —
  text content stays JSONB, mentions live inside that string content
- Related: [ADR-0003 (optimistic UI)](./0003-optimistic-ui-persistence.md) —
  mention-driven connection inserts/deletes follow the same fire-and-forget
  pattern as manual connections
