# ADR-0005: Image storage on Supabase Storage with two variants per upload
Date: 2026-04-27
Status: Implemented (2026-04-27)

## Context

Today, every image attached to a card (avatars and mood-board media) is
stored as a **base64 data URI inside a JSONB column** on `nodes` or
`node_sections`. This worked for Sprint 1 because nothing better was wired up.
It's now a real bottleneck:

- A 200KB JPEG becomes a ~270KB base64 string. Loading a campaign with
  ten image-heavy cards pulls megabytes of base64 over the network on
  every page open.
- The DB row sizes balloon. Postgres works fine until JSONB rows blow past
  a few MB, then performance falls off a cliff.
- Realtime (Sprint 1.5) will broadcast row changes to subscribers — sending
  base64 image data over the wire on every save is unacceptable.
- The Sprint 5 AI copilot needs to ingest screenshot uploads to generate
  cards. Stuffing screenshots into JSONB blocks that path entirely.

Erik's product priorities for images (per design conversation 2026-04-27):

- Up to ~25 images per card on highly-developed cards; hundreds per
  campaign.
- Web-only — no offline support required for V1.
- Both quality and performance matter. Want a low-res fallback for fast
  load, plus a higher-quality web-optimized version for normal viewing.
- Auto-name uploads based on section + card name (e.g.
  `inspiration-{timestamp}-strahd-von-zarovich.webp`).
- Source paths: drag-and-drop, clipboard paste. URL paste deferred to
  Sprint 5 (needs server-side fetch).
- AI-generated images should be treated identically to user uploads.

## Decision

### 1. Backend: Supabase Storage

One Supabase Storage **bucket** named `card-media`, **private** (not
public-readable). Access is gated by RLS policies that match the existing
campaign-ownership model.

Why Supabase Storage rather than rolling our own or a third-party CDN:

- Already part of the stack — auth and storage RLS use the same JWT.
- Free tier covers ~1 GB of storage and 2 GB of bandwidth — plenty for
  Erik's nightly use, easy to upgrade later.
- Built-in image transformations available on paid tiers if we want them
  later; we don't depend on them.
- Deletes happen via the same client library as DB operations. No new
  infrastructure.

### 2. Path structure

```
card-media/{campaign_id}/{card_id}/{section}-{timestamp_ms}-{slug}.{variant}.webp
```

Examples:

```
card-media/c8a.../strahd-uuid/avatar-1714247531000-strahd-von-zarovich.full.webp
card-media/c8a.../strahd-uuid/avatar-1714247531000-strahd-von-zarovich.thumb.webp
card-media/c8a.../strahd-uuid/inspiration-1714247612482-castle-ravenloft.full.webp
card-media/c8a.../strahd-uuid/inspiration-1714247612482-castle-ravenloft.thumb.webp
```

Components:

- `campaign_id` — top-level grouping for cleanup + RLS scoping.
- `card_id` — second-level grouping for cascade delete.
- `section` — `avatar`, `inspiration`, `media`, etc. (the section kind).
- `timestamp_ms` — `Date.now()` at upload time. Globally unique per ms,
  no coordination needed, naturally tells upload order at a glance.
- `slug` — kebab-case of the card's label at upload time. Cached, may go
  stale if the card is renamed; that's fine, the path doesn't need to
  reflect the current name. Falls back to `untitled-card` if the card has
  no label yet.
- `variant` — `full` or `thumb`. Always two files per logical image.

### 3. Two variants per upload

Generated **at upload time in the browser** (Canvas API):

- `.thumb.webp` — max 256px on the long edge, ~40% quality. Used for
  zoomed-out canvas, lists, search results, and as a placeholder while the
  full image loads.
- `.full.webp` — max 1920px on the long edge, ~80% quality. Used for the
  edit modal lightbox and high-zoom canvas views.

Why generate both at upload (rather than transform on request):

- Predictable cost: one upload, two PUTs, done.
- The transform-on-request URL contract is something Supabase ties to
  paid tiers; generating ahead avoids that.
- Simpler RLS model (we authorize files, not transform parameters).

**Adding a third variant later (e.g., `xl` at 4096px) is trivial** — extend
the variant generator and add the new size to the renderer's optional
fetch list. Two lines of code; no migration required for existing images.

### 4. DB references — no schema migration needed

The shape of the data inside existing columns/JSONB changes; the column
definitions themselves do not.

**Avatar (`nodes.avatar_url` column):**

Stays as a column on `nodes`. As of 2026-04-27, EditModal writes the
Storage path directly; new avatars never land as base64 again. The
column still tolerates legacy base64 data URIs (so old data renders),
and `useImageUrl` resolves either shape transparently.

```
old:  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAY..."
new:  "c8a.../strahd-uuid/avatar-1714247531000-strahd.full.webp"
```

The client constructs the actual signed URL on demand from the path, so
URL format changes don't require data migrations.

**Mood-board media (`node_sections.content` for kind='media'):**

Stays as a JSONB array. Each entry transitions from a plain base64 string
to a structured object:

```jsonc
[
  {
    "path": "c8a.../strahd-uuid/inspiration-1714247612482-castle.webp",
    "alt": "Castle Ravenloft, looming above the village",
    "uploaded_at": "2026-04-27T18:42:11Z"
  },
  ...
]
```

The renderer reads `path`, asks the Storage SDK for the signed URL of
both `.thumb.webp` and `.full.webp`, and renders whichever variant fits
the current zoom level.

### 5. Migration

A one-shot script will:

1. Create the `card-media` bucket and its RLS policies.
2. For each existing image (avatar or mood-board entry) currently stored
   as a base64 data URI: decode → transcode to two WebP variants →
   upload to Storage → update the column/JSONB to point at the path.
3. Verify the new path resolves before deleting the old data URI.

Bucket creation + RLS lives in
`supabase/migrations/002_card_media_bucket.sql`. The base64 → Storage
transcode step lives in `scripts/migrate-images.mjs` and runs once in a
browser-like environment to use the Canvas API. The script is reversible
in the sense that it keeps the base64 source until the new path is
verified to load.

### 6. Upload paths

**In V1 ship:**

- **Drag and drop** — onto a card's avatar slot or any image-bearing
  section.
- **Clipboard paste** — `Cmd/Ctrl+V` while focus is on the upload zone.

**Deferred to Sprint 5 (when the kitchen ships):**

- **URL paste** — pasting `https://example.com/image.jpg` and having it
  ingested. Browsers can't fetch arbitrary cross-origin URLs without CORS,
  so this needs a server-side proxy. Held until we add Vercel functions
  for the AI copilot.

**Auto-naming on upload:**

- The slug component is derived from the card's current label, kebab-cased.
- If the card has no label, fall back to `untitled-card`.
- The timestamp component is `Date.now()` at upload time. Already unique
  per millisecond per card; no further coordination needed.

### 7. Lifecycle / cleanup

- **Card delete** → cascade-deletes node_sections rows → background job
  deletes orphaned objects under that card_id prefix.
- **Campaign delete** → same, but for the whole campaign_id prefix.
- **Image removed from a card** (user clicks X on a thumbnail) →
  immediately delete both variants from Storage. Path becomes invalid;
  JSONB entry is removed.
- **Orphan check** (periodic, manual for now) — a script that lists all
  Storage paths and compares against JSONB references, deletes anything
  not referenced. Run quarterly or as needed.

### 8. RLS for the bucket

```sql
-- Owner of the campaign can read any object under its prefix
create policy "owner can read card media"
  on storage.objects for select
  using (
    bucket_id = 'card-media' and
    exists (
      select 1 from public.campaigns
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

-- Same for insert / update / delete (separate policies)
```

The `(storage.foldername(name))[1]` pulls the first path segment
(campaign_id) and joins back to `campaigns.owner_id`.

## Consequences

**Benefits:**

- DB rows stay small. Loading a campaign no longer pulls image bytes.
- Realtime broadcasts no longer carry image data.
- AI screenshot upload (Sprint 5) has a place to land.
- Two variants give us fast first paint + high-quality detail without
  clever code.
- Images are addressable by stable paths; renames don't break references.
- **No schema migration required** — just a one-time data migration that
  decodes existing base64 and uploads to Storage.

**Trade-offs accepted:**

- Migration is non-trivial. Existing base64 images need to be transcoded
  and uploaded once. We'll script it; expect a few minutes of work for
  Erik's current data volume.
- Two variants doubles storage cost. Fine for now (free tier holds it),
  worth revisiting at 100+ users.
- Browser-side WebP transcoding is heavy on first upload (~200ms for a
  4K image). Tolerable on desktop; if phone uploads ever become a thing,
  we'll move transcoding to the kitchen (Sprint 5+).
- URL paste is deferred. People who want it can drag a downloaded file
  for now.

**When to revisit:**

- When we hit Supabase free-tier storage/bandwidth limits.
- When AI image generation lands and we need a separate path for "AI
  source" vs. "user upload" provenance (currently they share the same
  shape).
- If users ever need a third variant (e.g., 4096px for high-DPI displays).
- If phone uploads become a thing and browser-side transcoding gets
  sluggish on weaker hardware.

## References

- Schema: [`supabase/schema.sql`](../../supabase/schema.sql)
- Migration: [`supabase/migrations/002_card_media_bucket.sql`](../../supabase/migrations/002_card_media_bucket.sql)
- Related: [ADR-0002 (modular sections)](./0002-modular-node-sections.md) —
  image entries live as items inside an existing `node_sections` row.
- Future: this ADR will need to be amended once URL paste arrives in
  Sprint 5 and once AI image generation specifies its provenance fields.

## Implementation amendment (2026-04-27): SECURITY DEFINER on the bucket policy

The RLS expression as drafted in section 8 — inlining a `select 1 from
public.campaigns where id::text = (storage.foldername(name))[1] and
owner_id = auth.uid()` directly in the policy's `with check` /
`using` clause — **silently fails in practice**. Every upload returns
`new row violates row-level security policy`, and every signed-URL
request also fails. The diagnostics looked clean: the four policies
were in place, the bucket existed and was private, `storage.foldername`
indexed correctly, the user owned the campaign, and the JWT was being
sent with the request.

Root cause: when the storage policy's expression queries another
schema's table, the cross-schema lookup doesn't resolve the way the
policy author expects. The `EXISTS` subquery returns false for rows the
caller can otherwise read directly, so the policy denies the action.

The fix shipped in `002_card_media_bucket.sql` is a `SECURITY DEFINER`
helper:

```sql
create or replace function public.user_owns_card_media_path(object_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaigns
    where id::text = (storage.foldername(object_name))[1]
      and owner_id = auth.uid()
  );
$$;

grant execute on function public.user_owns_card_media_path(text) to authenticated;
```

The four bucket policies then call `public.user_owns_card_media_path(name)`
instead of inlining the lookup. Security is preserved — the helper still
pivots on `auth.uid()`, so it only ever returns true for the calling
user's own campaigns — but the cross-schema query runs with elevated
privileges and resolves correctly.

**Apply this pattern to any future Storage bucket whose ownership check
needs to read a `public` table.** The naive inlined version reads as if
it should work but doesn't.
