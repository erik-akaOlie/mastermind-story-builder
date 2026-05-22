# ADR-0014: Workspace schema architecture — data-driven, deferred
Date: 2026-05-21
Status: Accepted

## Context

ADR-0013 confirms custom card types as a core part of the product. Beyond that, the founder anticipates a future in which the *shape* of a workspace — its whole set of card types — becomes user-customizable: a user could choose a base template, tailor it, and reuse the tailored version across multiple workspaces.

We want today's architecture to preserve a clean path to that future **without building any of it now.** This ADR records (a) the current state, (b) the decision about what to build and not build now, and (c) the intended future model — so that later work does not drift away from it.

One definition, because it is load-bearing: a **workspace schema** is the set of card types a workspace uses — and, later, the structure or presentation rules associated with those card types. It is not a database entity today — see Current state.

## Current state (descriptive — not a commitment)

Today the model is simply:

```
User -> card types -> workspaces
```

- Card types — built-in and custom alike — are rows in the `node_types` table, owned **per user**. A user's custom types are available across all of that user's workspaces.
- There is **no "schema" entity** — no schema or template table, no template concept, no per-workspace card-type set.
- `nodes.type_id` links each card to its card type.

The per-user scoping of card types is a **consequence of an earlier migration**, recorded here as current reality — *not* an intentional long-term commitment. The future model below re-scopes it.

ADR-0008 proposes a refinement to *how built-in card-type defaults are stored* (code-defined defaults plus a sparse per-user override table). That refinement does not change the picture above and is compatible with this ADR.

## Decision

### What we will NOT build now

No workspace-schema structure is added to the database: no schemas or templates table, no `schema_key` column on `workspaces`, no per-type structure or presentation machinery, and no re-scoping of `node_types`. None of it has a consumer yet; building it now means guessing its shape.

The reasoning: the database is already data-driven where it matters. Card types are already rows in a table. The "world-building schema" is not hardcoded into the database — it is simply the current set of `node_types` rows. The risk of locking into one hardcoded schema lives in the **code**, not the database.

### What we commit to — three code disciplines

1. **No code branches on a hardcoded card-type name.** Type-specific behavior (icon, color, label, future behavior flags) is data carried on the card type; code reads that data. A user-created type must behave exactly like a built-in one. This is required for custom card types to work at all (ADR-0013) — it is current V1 work, not speculative future-proofing.

2. **Card types are fetched by workspace-context — never owned by a workspace.** Code that needs a workspace's card types asks "what card types apply in this workspace?" The workspace is *context*; ownership is resolved elsewhere — today via the user, in the future model via the user's schema. The resolution path can then change in one place without touching call sites.

3. **The built-in card-type seed list stays one named definition in code.** The built-in card types are seeded from a definition in code (see ADR-0008). Treat that definition as the V1 base template's card-type definition — one clearly-labeled recipe. In the future model it becomes the first protected base template.

### One hard guardrail

**Workspaces must not own card types. Workspaces may reference card types through their schema context.** Concretely: no `workspace_id` on `node_types` (or on ADR-0008's override table). Card types are owned by the user today, and by a schema in the future model — never by a workspace. A `workspace_id` on card types would directly contradict the future model below.

## Recorded future direction (NOT a commitment to build)

This is the intended target that the decision above must not block. It is recorded so future work stays consistent with it; it is not scheduled.

```
Protected base template library   (system-owned, read-only)
  -> user-owned schema copy        (created on first modification)
    -> card types
      -> workspace instances
```

- **Protected base template library** — system-owned, read-only schema templates. V1 ships one (the built-in card-type set defined in code); more could be added later. Every user can see and use them; no user can modify them.
- **User-owned schema copy** — a user uses a protected template directly until they modify it. On the first modification, MasterMind creates a user-owned copy of the schema for them to customize. One user may hold several copies derived from the same base template, each with its own card types. (How copies and workspaces are *labeled and displayed* is a naming question, not yet settled — see note below.)
- **Workspace instances** — each workspace points at exactly one schema: a protected base template used as-is, or one of the user's own copies.

Settled rules within this model:

- **Card-type sharing** — two workspaces share card types only if they point at the *same schema* (the same protected template, or the same user copy). Two workspaces can hold different card types if they are on different copies.
- **Modification granularity** — when a user modifies a schema from inside a workspace, only *that* workspace moves to the newly created user-owned copy. Other workspaces on the original template stay on it.
- **Copy independence** — once a user-owned copy is created, it is independent of its base template. Later changes to the protected template do not propagate into existing copies. This deliberately avoids synchronization and merge problems between templates and customized versions.

**Naming and presentation are not settled.** How schemas, schema copies, and workspaces are *labeled and displayed* — including how a workspace's title relates to its schema — is an open product question, deliberately left out of this ADR. This ADR records schema *architecture* only.

This model extends a distinction the product already has: ADR-0008's `is_system` / `is_builtin` flag separates system-owned from user-owned *card types*. The future model applies the same system-owned-vs-user-owned distinction one level up — at the *schema*.

## Consequences

**Now:** near-zero cost. No new database structure. Disciplines #1 and #3 are needed for V1's custom-card-type feature regardless. Discipline #2 and the guardrail cost only attention.

**Deferred work — the honest trade-off.** When customizable schemas become a real feature, real work waits:

- Introduce the schema entities (protected templates, user-owned copies) and re-scope card types from per-user to per-schema. Because today every user effectively has a single implicit schema, this is an **additive migration** — each existing user's card types become their one user-owned copy of the V1 base template; nothing is reversed.
- Make the card editor's per-type structure **data-driven** — today it hardcodes a fixed set of sections for every card. This is a UI rework and is the largest single piece of deferred work. (The *data* side is partly anticipated already: ADR-0008's per-type `layout` field is designed to carry that structure.)
- Build the schema-selection and schema-management UI.

We deliberately do not pre-pay any of this. The risk accepted: at build time we may wish one thing had been shaped differently — but because no new surface area is added now, adjusting is cheap. The larger risk is the opposite: building a schema system now, guessing its shape, and contorting V1 around an abstraction that does not fit the real feature.

## Open questions

None outstanding for the model itself. The "modification granularity" and "copy independence" questions raised during discovery are settled above. Remaining unknowns are V1-validation questions, recorded in ADR-0013.

## Related decisions

- [ADR-0013](./0013-product-positioning.md) — establishes custom card types as core, which these disciplines exist to support.
- [ADR-0008](./0008-card-type-defaults-in-code.md) — card-type default storage; its code-defined built-in card types are the World-Building schema definition referenced in discipline #3, and its `is_system` / `is_builtin` flag is the pattern the future model extends. Its per-user override table is, like `node_types`, current-state scoping that the future model would re-scope.
- [ADR-0002](./0002-modular-node-sections.md) — the modular node-section design that today's per-card structure is built on.
