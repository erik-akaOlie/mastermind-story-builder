# ADR-0007: Deferred image persistence — upload on Save, not on file pick
Date: 2026-05-08
Status: Proposed (will ship with the Image upload + cropper feature)

## Context

Today, every image upload follows the **optimistic-write** pattern set
out in [ADR-0003](./0003-optimistic-ui-persistence.md):

1. The user clicks "Add image" → file picker opens.
2. The selected file is immediately transcoded to WebP variants and
   uploaded to Supabase Storage.
3. The path is written to the database the moment Storage confirms.
4. The image appears on the card.

This works for "I picked the right file and want it there." It works
badly for the new Image upload + cropper flow, where the user is
staging composition decisions before they commit anything:

- The user pastes or picks an image, then drags / scales / reframes it
  inside the cropper.
- They might decide to start over with a different image.
- They might **Cancel**, expecting that nothing about the card changed.

Under today's pattern, by the time the user is shaping the crop, the
original full-resolution upload is already in Storage. Cancel would
have to clean up orphan files. Replacing an existing image with a new
one would briefly write two complete uploads to Storage. Switching
source images mid-flow leaves a trail.

## Decision

The Upload Image modal **defers all persistence until the user presses
Save**.

Between the moment an image enters the modal (file pick or clipboard
paste) and the moment the user presses Save:

- The image is held **in browser memory only**, as raw image data the
  cropper can manipulate.
- No Storage writes. No database writes. No signed-URL fetches.
- The user can replace the source image freely; the previous in-memory
  image is simply dropped.
- The cropper's UI transformations (scale, position, frame ratio) are
  tracked in React component state.

On **Save**:

1. The cropper produces a final cropped output respecting the
   1920×1080 strict box (width ≤ 1920 *and* height ≤ 1080), the user's
   positioning, and the user's chosen aspect ratio.
2. That cropped output is transcoded to the two WebP variants per
   [ADR-0005](./0005-image-storage.md) (`.thumb.webp`, `.full.webp`).
3. Both variants are uploaded to Storage.
4. The path is written to the database.
5. **For replace flows:** the previous image's two variants are deleted
   from Storage *after* the new path is confirmed in the database.

On **Cancel**:

- Nothing happens. No Storage writes occurred during the modal
  session, so there's nothing to undo.
- Existing images on the card (if the modal was opened from an
  edit-icon) remain untouched.

## Why this is *not* a regression of ADR-0003

ADR-0003 governs how persistence relates to the React UI for
**operations the user has already committed to**: typing, dragging,
deleting, connecting. For those, optimistic + background persist is
the right pattern — the user has already expressed intent, the UI
should reflect that immediately, and the network round-trip is hidden.

The Upload Image modal models a different user state: **staging, not
commitment**. The user isn't saying "this is my image" until they
press Save. The cropper is more like a draft buffer than a live edit.
Treating it as "live edit + optimistic persist" would force the
implementation to chase ghost files through Storage every time the
user pages through five candidate images before settling.

The optimistic pattern resumes the moment Save fires. From that point
on, deletion, reorder, and any future re-replacement follow ADR-0003's
standard flow.

## Implementation notes

- **Memory footprint.** Single image at a time, capped at the source
  file's natural size before transcoding. A 4000×3000 JPEG decodes to
  roughly ~48 MB in memory once the browser has unpacked it for
  display. Tolerable on desktop; we don't support phone uploads in V1.
- **Cropping happens before transcoding.** The current pipeline
  transcodes on upload using the source's natural dimensions and a
  long-edge resize. The new pipeline applies the user's crop (scale +
  position + frame) to the source on a Canvas, then runs the same
  transcode step against the cropped result. The 1920×1080 strict-box
  cap replaces the existing long-edge cap **for images saved via the
  cropper**; the long-edge cap remains the rule for any direct-upload
  paths that bypass the cropper (e.g., the `MigrateImages.jsx` legacy
  backfill route).
- **Replace ordering.** New path written → database updated → old path
  deleted, in that sequence. If the delete fails, we get a Storage
  orphan but user-visible state is correct. The orphan-cleanup script
  mentioned in ADR-0005 §7 reaps those.

## Consequences

**Benefits:**

- Cancel is clean — by construction, no orphan files, no half-written
  database rows.
- Switching source images mid-flow has zero persistence cost.
- Replace flow doesn't briefly double-write the same logical image.
- The mental model matches user expectation ("I haven't saved yet, so
  nothing has changed").

**Trade-offs accepted:**

- The cropper holds raw image data in memory for the duration of the
  modal session. Bounded by single-image-at-a-time and by realistic
  source file sizes; not a concern for desktop V1.
- The Upload Image modal diverges from ADR-0003's optimistic pattern.
  This is a deliberate, scoped exception, not a precedent for other
  modals.

**When to revisit:**

- If we ever support multi-image staging in the same modal (drag-in 5
  photos at once, crop each, save together) — the memory-bound
  assumption may need a re-look.
- If phone uploads land and source files routinely exceed available
  memory — at that point, transcode-then-stash-on-Storage as a temp
  file becomes worth considering.

## References

- [ADR-0003: Optimistic UI persistence](./0003-optimistic-ui-persistence.md)
  — the pattern this ADR scopes an exception to.
- [ADR-0005: Image storage](./0005-image-storage.md) — the storage and
  variant model the cropper output writes into.
- BACKLOG entry: *Image upload + cropper* (Foundational Progress).
