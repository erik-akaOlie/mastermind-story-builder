# ADR-0012: Foundational rename — campaign → workspace
Date: 2026-05-18
Status: Accepted

## Context

MasterMind's V1 audience is Dungeon Masters running D&D campaigns. The top-level container — the bounded object that owns nodes, connections, text annotations, and (future) thumbnails / background images — was named `campaigns` at every layer of the system: the Postgres table, the React context, the data-access module, the hook that owns load lifecycle, the variable names throughout the canvas code, the user-facing copy in the picker, the breadcrumb in `UserMenu`.

That naming made sense when the only use case was D&D. The first time we tried to add a non-card image domain (campaign thumbnails, then anticipated background images / slideshow / AI-generated assets) the architecture started complaining: the `card-media` Storage bucket already held images that weren't specifically "card-level" (the bucket was holding container-scoped assets too), and we were about to layer another container-scoped image role on top of a bucket misnamed for one of its consumers.

Pulling the thread further revealed the more foundational issue. The top-level container is functioning as a **bounded space for entities, relationships, assets, and context** — a structure that could host D&D campaigns today and organizational mapping / user journeys / knowledge systems later. Naming the architectural object `campaign` was implementation history leaking into structural identity.

Two coupled questions emerged from the planning conversation:

1. Should the architectural name be generic now, or should we wait for a real second use case to surface the right abstraction?
2. If we rename, what's the right discipline for separating data-model renames from representation-level names?

## Decision

Rename the top-level architectural object **`campaigns` → `workspaces`** at every layer where the name is functioning as a data-model label. Keep `campaign` in places where it's functioning as product-positioning copy for the current D&D-targeted V1.

### What gets renamed

**Database:**
- Table `public.campaigns` → `public.workspaces`.
- FK columns `campaign_id` → `workspace_id` on `nodes`, `connections`, `text_nodes`.
- All RLS policies, indexes, FK constraints, and helper functions follow.
- See `supabase/migrations/006_rename_campaigns_to_workspaces.sql`.

**Storage:**
- Bucket `card-media` → `workspace-media`. The name's "card" prefix was historical accident — the bucket has held node-scoped images (avatars + inspiration) AND was about to hold container-scoped images (thumbnails). Renaming to `workspace-media` reflects the bucket's actual scope: media owned by a workspace and its contents.
- Helper `user_owns_card_media_path` → `user_owns_workspace_media_path`.
- See `supabase/migrations/007_rename_card_media_bucket.sql`.

**Code:**
- `lib/campaigns.js` → `lib/workspaces.js`; functions `listCampaigns` / `createCampaign` / `getCampaign` / `updateCampaign` / `deleteCampaign` / `getCampaignLastEditedAt` renamed; `BUILT_IN_TYPES` constant and `*NodeTypes` functions unchanged (user-scoped, not workspace-scoped).
- `lib/CampaignContext.jsx` → `lib/WorkspaceContext.jsx`; `CampaignProvider` → `WorkspaceProvider`; `useCampaign` → `useWorkspace`; exported `activeCampaign(Id)` → `activeWorkspace(Id)`.
- `hooks/useCampaignData.js` → `hooks/useWorkspaceData.js`; Realtime channel `campaign:{id}` → `workspace:{id}`; filter strings updated.
- Variable names throughout: `campaignId` → `workspaceId`, both as identifier and as object key.
- Undo store internal field: `campaignId` → `workspaceId`. The sessionStorage key prefix `mastermind:undo:{userId}:{...}` never carried the literal text "campaign" — both segments are UUIDs — so no on-disk key migration was required.
- localStorage `mastermind:activeCampaignId` → `mastermind:activeWorkspaceId`, with a one-time read shim in `WorkspaceContext` that migrates the legacy value transparently on first load.

**User-facing copy (audit-driven):**
- `CampaignPicker`: "Your campaigns" → "Your workspaces"; "New campaign" → "New workspace"; "Campaign name" → "Workspace name"; empty state and delete-confirm updated.
- `UserMenu` breadcrumb: "Campaigns" → "Home". This is a *navigation destination*, not a data-model label — the user clicks it to navigate back to the picker (the landing experience), not to a list of containers. Tooltip + aria-label match.
- `UserMenu` dropdown: "Switch campaign" → "Switch workspace"; "No other campaigns." → "No other workspaces."
- `MigrateImages`: "Scanning your campaigns…" → "Scanning your workspaces…".

### What intentionally stays

Three kinds of references survive the rename:

**1. Representation-level names** — names that describe *how a node is rendered*, not *what the underlying entity is*.

- `nodes/CampaignNode.jsx` — file name describes the React component that renders a node *as a card in the canvas view*. "Campaign" here is a historical wart, not architectural debt; renaming forces cascade decisions about file organization that aren't paying for themselves yet. Flagged for a separate follow-up cleanup.
- React Flow type identifier `'campaignNode'` — same reasoning. It's a string key registering the canvas-card renderer.
- Bucket name reflects *container-scoped media* (workspace-media); function names like `uploadCardImage`, `cardImagePipeline` reflect *card-level images*. Both are correct under the same principle: entity-level names default to the entity, representation-level names default to the representation.

**2. Product-positioning copy for V1** — user-visible text that's intentionally D&D-flavored for the current audience.

- `CampaignPicker.jsx` file name — implements the picker for the campaign-positioned UI surface. When the surface itself gets a generic name, the file follows.
- Placeholder examples in the new-workspace form ("e.g. Curse of Strahd, The Lost Mines...") stay because they're targeted product flavor for V1 testers. Will broaden when the audience does.
- Product brand ("MasterMind: Story Builder," taglines "your story builder").

**3. Historical text in older ADRs** — accurate at the time of writing. Footers point at this ADR; no rewrites.

### Naming convention going forward

The principles that emerged from the planning conversation, captured here so future-you doesn't re-derive them:

1. **Distinguish entity from representation in code names.** Entity-level work uses entity names (`workspaceImagePipeline`, `nodeImagePipeline`). Representation-level work uses representation names (`CampaignNode.jsx` renders a node *as a card*). Bucket / helper / data-access names default to the entity.
2. **Bucket / helper scope matches the table that owns it.** Today: `workspace-media` matches table `workspaces`. If `workspaces` ever gets renamed again, the bucket follows in the same migration. One table, one bucket, one rename.
3. **Path prefixes inside a bucket use entity names, not representation names.** Inside `workspace-media`: `{workspace_id}/{card_id}/...` for node-scoped images, `{workspace_id}/thumbnail-...` for container-scoped assets. Don't introduce `cards/` as a path segment — would carve in the same kind of mistake we're fixing here.
4. **Name infrastructure for what it holds, not what triggered its creation.** `card-media` existed because cards were the first image consumer. That's a story about *history*, not *purpose*. New buckets / helpers / factories must pass the "two-years-later test": would the name still make sense if I came back with no context?
5. **Don't preemptively abstract V1 product language.** "Campaign" stays in product-positioning copy because we have one concrete audience (DMs). When a real second use case (organizational mapping, user journeys, knowledge systems) lands, the second-instance reality disciplines the right generalization. Until then, multiple-audience copy is guesswork.

## Consequences

**Benefits:**
- Architecture name matches what the object actually is (a bounded container for structured information), not what its first audience was.
- New container-scoped image roles (thumbnails, backgrounds, slideshow, AI-generated assets) land in a correctly-named bucket from day one. No naming debt to pay forward.
- The entity-vs-representation discipline is now an explicit convention. Future renames have a rulebook.
- One-time event handled cleanly: backwards-compat shim on `mastermind:activeCampaignId` means existing testers don't bounce back to the picker on first load after the rename ships.

**Accepted trade-offs:**
- `CampaignNode.jsx` and the `'campaignNode'` React Flow type identifier remain misnamed by the new convention. They're flagged as a future cleanup. Renaming now would expand the PR scope without delivering proportional value.
- Product copy and architecture say different things in places (e.g., the file `CampaignPicker.jsx` renders "Your workspaces" text). This is the intentional separation between product positioning and architectural identity. The audit lists every such location.
- Pre-rename undo entries on disk (sessionStorage, per-tab) that survive the reload that loads the new code will fail `canApply*` because they hold `entry.campaignId` instead of `entry.workspaceId`. They're dropped via the existing state-drift handling. Acceptable: sessionStorage undo is intentionally per-tab and ephemeral.
- The bucket rename requires a one-time object-copy migration. Mitigated by isolating it in its own migration (007) with a copy-then-verify-then-delete-old window.

## Migration / rollout

The rename ships as one PR with the commit sequence:

1. `Workspace rename (1/6)`: `lib/campaigns.js` → `lib/workspaces.js` + importers.
2. `Workspace rename (2/6)`: `CampaignContext` + `useCampaignData` hook + consumers.
3. `Workspace rename (3/6)`: DB queries, Realtime filters, props, user-facing copy.
4. `Workspace rename (4/6)`: persistence keys + backwards-compat shim.
5. `Workspace rename (5/6)`: tests.
6. `Workspace rename (6/6)`: docs (this ADR + CLAUDE.md sweep + BACKLOG entry + schema.sql + ADR footers).
7. Migration 006 (table + columns + RLS + helper body) — applied after all code commits land.
8. Migration 007 (bucket rename + helper rename) + object-copy script — applied after 006.
9. Drop old `card-media` bucket — destructive, last step, only after verifying renders against the new bucket.

The two migrations + the destructive cleanup are documented in the PR description's rollout instructions.

## Related decisions

- Builds on the implicit convention from [ADR-0005](./0005-image-storage.md) (image storage in Supabase) — extends its path-prefix discipline to container-scoped (non-card) image roles.
- Touches the helper described in migration `002_card_media_bucket.sql` (the SECURITY DEFINER cross-schema pattern); that pattern survives the rename, just with renamed function + bucket.
- Doesn't conflict with [ADR-0006](./0006-undo-redo.md) (the undo system's persistence shape changed field names but not the structural design).

## Future work flagged by this decision

Captured as separate BACKLOG items, not in scope here:

- **Product-language audit** (new Exploration entry): scan for "story-building" / "Dungeon Master" framing that may narrow the product identity in the same way `campaign` narrowed the architecture. Observations collected during this rename land in that entry as a starting list.
- **`CampaignNode.jsx` / `'campaignNode'` cleanup**: representation-level rename for the canvas-card renderer. Not architectural debt; cosmetic. Defer until a separate pass.
- **Migration 007's `card-media` bucket deletion**: destructive, scheduled as a follow-up commit after verification renders work against `workspace-media`.
