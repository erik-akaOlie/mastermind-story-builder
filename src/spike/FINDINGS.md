# Block Editor Spike — Findings (BlockNote vs Tiptap)

Throwaway notes from the isolated spike at `#editor-spike`. Delete with `src/spike/`.
Both prototypes implement the four deciding factors: inline `[[Node]]` links,
custom Connections + Image Album blocks, two zones, and a hand-written Markdown
serializer.

## Status
- Both libraries install on the project's **React 18.3**.
- `npm run build` compiles cleanly with both editors bundled — code is sound.
- Full in-browser render was **not verifiable in the agent sandbox** (no Supabase
  connectivity → the app shell never clears its loading gate; the preview tool
  aggregates multiple browser contexts). Verify visually on a real machine at
  `#editor-spike`.

## Concrete findings from implementing both

### 1. React 18 compatibility (install friction)
- **BlockNote:** its default `@blocknote/mantine` theme auto-resolves Mantine v9,
  which requires **React 19**. Had to pin `@mantine/core@^8 @mantine/hooks@^8` to
  install on our React 18. Signal that BlockNote's happy path is moving to React 19.
- **Tiptap:** installed clean on React 18, no pinning.

### 2. Custom data-rich blocks (Connections, Image Album) — the biggest gap
- **BlockNote:** block `propSchema` values are **primitives only**
  (string | number | boolean). The Image Album's list of images cannot be stored
  as an array — it must be `JSON.stringify`'d into a string prop and `JSON.parse`'d
  on every render (see `BlockNoteSpike.jsx` `ImageAlbum`). Awkward for exactly the
  data-rich blocks we need.
- **Tiptap:** node `addAttributes()` holds **arbitrary arrays/objects**
  (`images: { default: [] }`) — natural fit. NodeViews give full control over a
  non-editable, data-driven block like Connections (`contentEditable={false}`).

### 3. Inline `[[Node]]` link trigger
- **Tiptap:** `@tiptap/suggestion` accepts a **multi-character** `char: '[['`
  directly, and exposes a `command` hook — the exact place to fire the
  create-connection side effect. Purpose-built for this.
- **BlockNote:** `SuggestionMenuController` uses a **single-character**
  `triggerCharacter`. `[[` is not natively supported; the spike falls back to `"["`.
  Emulating `[[` needs extra custom handling.

### 4. Clean Markdown export
- **Both** need a hand-written serializer for `[[wikilinks]]` + custom blocks
  (BlockNote's built-in `blocksToMarkdownLossy` is lossy and cannot emit custom
  inline content or custom blocks). Implemented in both spikes.
- **Tiptap** additionally supports per-node `renderHTML` / markdown hooks, so the
  serialization can live with each node definition — cleaner long-term.

### 5. Two zones (Card View / GM's Eyes Only)
- **Tie.** Both do this trivially with two editor instances. Not a differentiator.

### 6. Notion-style UX out of the box (slash menu, drag handles)
- **BlockNote** wins here — built in. **Tiptap** assembles from (now MIT) extensions.
  This is the *demo-speed* axis, explicitly de-prioritized for this decision.

## Recommendation
**Tiptap.** It wins the four deciding factors that matter for long-term fit
(custom data-rich blocks, multi-char inline trigger, export control, two-zone tie),
and installs clean on React 18. BlockNote's only edge is out-of-the-box Notion UX
(demo speed), which we agreed not to optimize for — and its primitive-only block
props fight precisely the Connections/Image Album blocks central to this product.
