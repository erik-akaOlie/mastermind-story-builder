# ADR-0006: Undo / redo via command pattern with a per-tab, per-campaign action stack
Date: 2026-04-29
Status: Proposed

## Context

The app has no recovery path for accidental destructive or modifying
actions. Delete a card you didn't mean to → it's gone. Replace a summary
with the wrong text → the prior text is gone. As destructive features
grow (and especially once the AI copilot can write into cards in Sprint 5+),
the absence of undo becomes higher-stakes.

This ADR captures the implementation plan for the undo/redo work in
Sprint 2. It is the shared blueprint between Erik (product / UX) and the
implementer (Claude). Items are aligned through the conversation that
preceded this doc, captured in the
[Sprint 2 candidate entry of BACKLOG.md](../../BACKLOG.md).

### Trade-off considered: command pattern vs. snapshot pattern

| | Command pattern (chosen) | Snapshot pattern |
|---|---|---|
| What's stored | Per-action records of "what changed and how to reverse it" | Full canvas snapshots after every action |
| Memory cost | Tiny per entry, bounded by stack depth | Heavy — N copies of the whole campaign |
| Realtime interaction | Each undo flows through the existing optimistic-UI path; other tabs see it as a normal write | Restoring a snapshot becomes N writes; other tabs see a flurry; remote edits since the snapshot would be clobbered |
| Maintenance cost | Need a forward + inverse for each action type | Single mechanism, no per-action code |
| Awkward case | Delete-card requires capturing dependent rows (sections, connections) into the inverse | None per se, but conflict semantics are bad under Realtime |

**Command pattern is the better fit for this codebase.** The architecture
is already action-shaped (every user action calls a `lib/*.js` function;
the inverse is another `lib/*.js` call), so undo is a natural extension
of the existing optimistic-UI + Realtime model. Snapshot pattern would
fight Realtime.

### Tab and persistence model — matching industry standard, V1 scope

Researched the prevailing pattern across browser-based editors (Figma,
Google Docs, Notion, VS Code web). All use **per-tab undo stacks**, not
cross-tab-shared. Most also persist the stack across F5 / accidental
refresh within the same tab.

V1 follows the simplest version of this pattern:

- **Per-tab working stack.** Each tab has its own undo state in memory.
  No live cross-tab sync.
- **Persisted to sessionStorage**, keyed by `${userId}:${campaignId}`,
  so a refresh of the same tab doesn't destroy history. sessionStorage
  is automatically per-tab and clears on tab close.
- **No cross-tab-close survival in V1.** Closing a tab loses its undo
  history. (localStorage with multi-tab race handling is the V2 path,
  if the use case ever justifies the complexity — see "When to revisit"
  in Consequences.)

Why sessionStorage over localStorage for V1: localStorage with
correct multi-tab handling needs heartbeats, tab-claim resolution, and
a grace window — ~80–120 lines of plumbing. sessionStorage covers F5
protection (the most common "I lost my history" scenario) in ~5 lines
with no multi-tab race surface.

## Decision

Command pattern. Each undoable user action pushes a plain-object record
onto a per-tab stack scoped to the active user + campaign. Ctrl+Z reads
the top entry, validates it can still be applied, and applies its
inverse via the same `lib/*.js` functions any normal edit uses.
Ctrl+Shift+Z re-applies the forward action.

### Scope (V1)

- **Per-tab working stack, scoped per-user-per-campaign.**
  sessionStorage-backed for survival across F5 / accidental refresh of
  the same tab. Closing the tab clears the stack.
- **Capped at 75 actions.** When full, the 76th push drops the oldest
  entry off the bottom.
- **Per-action granularity, not per-keystroke** for everything except
  typing inside an active text field (see "Word-style exemption").
- **No chip rollback** on undo. The "Edited Nm ago" chip remains a pure
  save-status indicator. Undo feedback lives in the toast only — matches
  industry standard (Figma, Notion, Google Docs).
- **Conflict-aware in both directions.** Both undo and redo validate
  that current state matches what the action expects before applying.
  On mismatch, refuse and toast "Couldn't undo (or redo) — this changed
  elsewhere."

### Action set covered

Ten action types:

| # | Action type | Where it fires | Inverse |
|---|---|---|---|
| 1 | `createCard` | App.jsx (right-click → Add card) | Delete the card |
| 2 | `editCardField` | EditModal session-end (modal close, see "Edit sessions") | Restore prior value of that field |
| 3 | `moveCard` | App.jsx (`onNodeDragStop` + `onSelectionDragStop`) — per-card 4px filter; the entry groups every card from one drag into a single undo step | Move every card in the entry back to its prior position |
| 4 | `deleteCard` | App.jsx context menu (Delete) | Re-create card + all dependent rows (sections + connections) |
| 5 | `addConnection` | EditModal ConnectionsSection | Delete the connection |
| 6 | `removeConnection` | EditModal ConnectionsSection | Recreate the connection |
| 7 | `createTextNode` | App.jsx (right-click → Add text) | Delete the text node |
| 8 | `editTextNode` | TextNode session-end (blur or update) | Restore prior text/format/size |
| 9 | `moveTextNode` | App.jsx (`onNodeDragStop`) — only if Δ ≥ 4px | Move back to prior position |
| 10 | `deleteTextNode` | TextNode trash button + App.jsx context menu | Re-create the text node |

Custom-type creation is **not** in the undo stack — settings-y, low
frequency, low blast radius.

### Word-style typing exemption

When the user is actively typing inside a contenteditable / input /
textarea, **Ctrl+Z is left alone for the browser** to handle natively.
This is "Option A" from scoping — keystroke-level undo inside a field,
the way Word and every other text editor behaves.

When the user is NOT focused on an editable field, Ctrl+Z reverses the
last *campaign action* on the stack ("Option B").

The check is implementation-cheap: if `document.activeElement` matches
`input, textarea, [contenteditable=true]`, we don't preventDefault on
Ctrl+Z and don't call our undo. Otherwise, preventDefault and call our
undo.

This means once the user *blurs out* of a field, the field-level edit
is captured as one `editCardField` action (via the session-end hook on
modal close), and Ctrl+Z from outside the field will reverse the whole
field-level edit at once.

## Implementation plan

### 1. Action record shape

Plain JavaScript objects. NOT closures. NOT functions. Inspectable,
serializable (required for sessionStorage persistence), testable.

Common fields on every record:

```js
{
  type: 'editCardField',          // discriminator
  campaignId: 'abc-123',          // scoping
  label: 'Edit summary',          // human-readable, used by the toast
  timestamp: '2026-04-29T17:00Z', // ISO; used for grace-window hydration check
}
```

Plus per-type payload. Examples (all DB-shape, see section 7 on the
React→DB marshaling step):

```js
// 1. createCard — to undo, delete the created card
{ type: 'createCard', campaignId, label: 'Add card', timestamp,
  cardId, dbRow /* full DB-shape row, plus default empty section content */ }

// 2. editCardField — to undo, write `before` back into `field`
{ type: 'editCardField', campaignId, label: 'Edit summary', timestamp,
  cardId, field: 'summary', before: 'old', after: 'new' }

// 3. moveCard — to undo, move every card in `cards` back to its before position
//
// `cards` is always an array, even for a single-card drag. A multi-select
// drag (shift+click or marquee) collapses into ONE entry with N elements,
// so Ctrl+Z reverts the whole drag in one shot rather than N-times. The
// label pluralizes accordingly: "Move card" vs "Move 5 cards".
{ type: 'moveCard', campaignId, label: 'Move card' | 'Move N cards', timestamp,
  cards: [{ cardId, before: { x, y }, after: { x, y } }, ...] }

// 4. deleteCard — to undo, restore everything that cascaded with it
{ type: 'deleteCard', campaignId, label: 'Delete card', timestamp,
  dbCardRow,                          // full DB-shape, NOT React shape
  dbSectionRows: [{ kind, content, sort_order }, ...],
  dbConnectionRows: [{ id, source_node_id, target_node_id, ... }, ...] }

// 5. addConnection
{ type: 'addConnection', campaignId, label: 'Add connection', timestamp,
  connectionId, sourceNodeId, targetNodeId }

// 6. removeConnection
{ type: 'removeConnection', campaignId, label: 'Remove connection', timestamp,
  connectionId, sourceNodeId, targetNodeId }

// 7. createTextNode
{ type: 'createTextNode', campaignId, label: 'Add text', timestamp,
  textNodeId, dbRow }

// 8. editTextNode
{ type: 'editTextNode', campaignId, label: 'Edit text', timestamp,
  textNodeId, before: { ...DB-shape fields }, after: { ...DB-shape fields } }

// 9. moveTextNode
{ type: 'moveTextNode', campaignId, label: 'Move text', timestamp,
  textNodeId, before: { x, y }, after: { x, y } }

// 10. deleteTextNode
{ type: 'deleteTextNode', campaignId, label: 'Delete text', timestamp,
  textNodeId, dbRow }
```

**Crucial:** all snapshots stored in records are DB-shape, not React-
shape. The marshaling happens at record time via dedicated helpers (see
section 7).

### 2. Apply / reverse dispatcher with conflict checking (both directions)

Four functions, all in `src/lib/undoActions.js`. All use the same
switch-on-`type` pattern:

```js
// Decide whether the inverse can still be applied. Reads current local
// state to check the recorded `after` matches reality.
// Returns { ok: boolean, reason?: string }.
function canApplyInverse(entry, { nodes, edges }) { ... }

// Decide whether the forward action can still be applied (used by redo).
// Mirror of canApplyInverse, checks the recorded `before` matches reality.
function canApplyForward(entry, { nodes, edges }) { ... }

// Run the inverse via lib/*.js functions.
async function applyInverse(entry) { ... }

// Run the forward action again.
async function applyForward(entry) { ... }
```

`canApplyInverse` examples:

- `editCardField`: check that the current value of `field` on `cardId`
  matches `entry.after`. If not, the field has changed since the action;
  refuse.
- `moveCard`: check that the card still exists. If it was deleted in
  another tab, refuse.
- `deleteCard`: check that no card with `dbCardRow.id` exists currently.
  If one does, refuse (something else recreated it).
- `addConnection` / `removeConnection`: similar existence checks.

`canApplyForward` is the mirror — same checks but against `before`
instead of `after`. Examples:

- `editCardField`: current value matches `entry.before`. If something
  else has touched the field since the undo, refuse the redo.
- `moveCard`: card still exists.
- `createCard`: no card with this id exists currently (we're about to
  recreate it).
- `deleteCard`: card with this id exists currently (we're about to
  re-delete it).

When either returns `{ ok: false }`, the operation aborts, fires a
conflict toast, and pops the entry off the relevant stack (so subsequent
Ctrl+Z / Ctrl+Shift+Z addresses the next action over).

`applyInverse` and `applyForward` write to the DB through the existing
`lib/*.js` API, which means:

- Local React state updates because the existing optimistic-UI flow
  still wraps these calls.
- Other tabs see the change through Realtime as a normal write.

### 3. The store: `src/store/useUndoStore.js`

A new Zustand store, structurally similar to the existing `useSyncStore` /
`useCanvasUiStore`, with sessionStorage persistence and per-user-per-
campaign scoping.

```js
// Shape:
{
  userId: string | null,
  campaignId: string | null,
  past: Action[],               // most recent at end of array
  future: Action[],              // most recent undone at end of array

  setScope({ userId, campaignId }),  // hydrate-or-clear from sessionStorage
  recordAction(entry),               // push to past, clear future, persist, drop oldest if past.length > 75
  popLastAction(),                   // for rollback-on-persist-failure
  popLastFutureAction(),             // mirror, for redo conflict
  undo(),                            // canApplyInverse → applyInverse → move past[-1] to future
  redo(),                            // canApplyForward → applyForward → move future[-1] to past
  clear(),                           // wipe both stacks + sessionStorage entry
}
```

**Persistence shape (sessionStorage):**

```
key:   mastermind:undo:${userId}:${campaignId}
value: { past: [...], future: [...] }
```

**Hydration logic in `setScope`:**

1. Build the key from `userId` + `campaignId`.
2. Read sessionStorage. If absent → start with empty stacks.
3. Else → load `past` and `future` into the store.

(No grace window check — sessionStorage automatically clears on tab
close, which is the desired V1 lifecycle. F5 rehydrates because
sessionStorage survives a refresh.)

**Persistence triggers:**

- After every `recordAction`, `undo`, `redo`, `popLastAction`,
  `popLastFutureAction`, `clear` → write to sessionStorage immediately.
  sessionStorage writes are synchronous and fast for the volumes involved
  (75 entries × small payloads).

**Sign-out cleanup:** `AuthContext.signOut` should call
`useUndoStore.getState().clear()` before resetting auth state, AND scan
sessionStorage for any `mastermind:undo:${oldUserId}:*` keys for the
signing-out user and remove them. This protects against a fresh sign-in
as a different user inheriting the prior user's stacks.

`useCampaignData` calls `useUndoStore.getState().setScope({ userId, campaignId })`
in the same effect where it currently calls `setLastSavedAt(null)` —
keeping all per-campaign-scope plumbing in one place.

### 4. The `recordAction` helper + rollback-on-failure pattern

Each call site (~10 places) gets a few lines following this pattern:

```js
// Build the action record (DB-shape snapshots).
const entry = {
  type: 'moveCard',
  campaignId,
  label: 'Move card',
  timestamp: new Date().toISOString(),
  cardId,
  before: { x: oldX, y: oldY },
  after:  { x: newX, y: newY },
}

// Optimistic record so the entry appears in the stack immediately.
useUndoStore.getState().recordAction(entry)

// Persist. If it fails, roll back the undo entry so the stack stays
// honest (no phantom entries for actions that didn't actually happen).
try {
  await updateNode(cardId, { positionX: newX, positionY: newY })
} catch (err) {
  useUndoStore.getState().popLastAction()
  throw err  // let the existing optimistic-UI error path handle the rest
}
```

The helper itself (`recordAction`) handles internal bookkeeping:
- Pushes to `past`
- Clears `future` (a new action invalidates the redo path)
- Drops oldest entry if `past.length > 75`
- Persists to sessionStorage

`popLastAction` removes the most recent entry from `past` and persists
again, so rollback is symmetric.

### 5. Keyboard shortcut wiring

A new hook, `src/hooks/useUndoShortcuts.js`, registered once at the App
level:

```js
useEffect(() => {
  function onKeyDown(e) {
    const isCmdOrCtrl = e.metaKey || e.ctrlKey
    if (!isCmdOrCtrl) return

    // Word-style exemption: leave Ctrl+Z to the browser when typing.
    const tag = document.activeElement?.tagName?.toLowerCase()
    const isEditable =
      tag === 'input' || tag === 'textarea' ||
      document.activeElement?.isContentEditable
    if (isEditable) return

    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      useUndoStore.getState().undo()
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault()
      useUndoStore.getState().redo()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [])
```

- macOS Cmd+Z and Windows Ctrl+Z both work because of `metaKey || ctrlKey`.
- Ctrl+Y is a common Windows redo shortcut; we accept it in addition to
  Ctrl+Shift+Z.

### 6. Toast on undo / redo

Sonner is already wired into the project for error reporting. Each
successful `undo()` or `redo()` fires a transient toast:

- Position: bottom-left (just above the existing `SyncIndicator` chip).
- Content: `Undid: ${entry.label}` or `Redid: ${entry.label}`.
- Duration: ~3 seconds (Sonner default).
- No dismiss button — ephemeral, pure feedback.

Conflict toasts (on either `canApplyInverse` or `canApplyForward`
returning `{ ok: false }`):
- Same position.
- Content: `Couldn't undo — this changed elsewhere.` (or `…redo…`)
- Duration: ~5 seconds (slightly longer so the user can read it).

The chip itself stays a pure save-status indicator — no rollback logic.
Industry-standard behavior.

### 7. Edit session capture (the modal open/close pattern)

The cleanest way to capture per-field edits without spamming the stack
on every debounced auto-save:

1. **Modal open** → snapshot all editable field values into a ref:

   ```js
   const sessionStartRef = useRef(null)
   useEffect(() => {
     sessionStartRef.current = {
       label: card.label,
       summary: card.summary,
       avatar: card.avatar,
       typeId: card.typeId,
       storyNotes: [...card.storyNotes],
       hiddenLore: [...card.hiddenLore],
       dmNotes: [...card.dmNotes],
       media: [...card.media],
     }
   }, [])  // once on mount
   ```

2. **Auto-save fires** during the session → persist as today (no
   recordAction call, no undo entry).

3. **Modal close** (Esc, click-backdrop, X button) → flush the auto-save
   first, then for each field that differs from `sessionStartRef.current`,
   emit one `editCardField` action.

   ```js
   function onClose() {
     flushSave()  // existing behavior
     const start = sessionStartRef.current
     for (const field of EDITABLE_FIELDS) {
       if (!shallowEqual(start[field], currentValues[field])) {
         useUndoStore.getState().recordAction({
           type: 'editCardField',
           campaignId,
           label: `Edit ${friendlyName(field)}`,
           timestamp: new Date().toISOString(),
           cardId: card.id,
           field,
           before: start[field],
           after: currentValues[field],
         })
       }
     }
   }
   ```

This means: open card, change summary AND title, close → two undo entries
in chronological order. Two Ctrl+Z's reverts both. Matches "per-field
granularity" without spamming the stack on every keystroke.

Connection add/remove inside the modal is recorded *immediately* (not
session-bounded), since each is a discrete user click rather than a
freeform edit.

For TextNode in-place editing: same model. `onFocus` snapshots `before`,
`onBlur` (the existing `save()` path) records one `editTextNode` action
if anything changed. Toolbar formatting changes (font size, alignment)
each record their own entry immediately, since the user expects each
toolbar click to be its own undo step.

### 8. The hard one: delete-card-with-everything

When `onDeleteNode(cardId)` runs in App.jsx, we capture every dependent
row in DB-shape *before* deleting:

```js
async function onDeleteNode(cardId) {
  // 1. Capture DB-shape snapshots of everything the cascade will remove.
  //    Helper marshals React state → DB shape (parallels dbNodeToReactFlow).
  const snapshot = buildDeleteCardSnapshot(cardId, nodes, edges)
  if (!snapshot) return  // card not found

  // 2. Optimistic record.
  useUndoStore.getState().recordAction({
    type: 'deleteCard',
    campaignId,
    label: `Delete "${snapshot.dbCardRow.label || 'card'}"`,
    timestamp: new Date().toISOString(),
    dbCardRow:        snapshot.dbCardRow,
    dbSectionRows:    snapshot.dbSectionRows,
    dbConnectionRows: snapshot.dbConnectionRows,
  })

  // 3. Optimistic local removal.
  setNodes(nds => nds.filter(n => n.id !== cardId))
  setEdges(eds => eds.filter(e => e.source !== cardId && e.target !== cardId))

  // 4. Persist. Rollback the undo entry if it fails.
  try {
    await deleteNode(cardId)
  } catch (err) {
    useUndoStore.getState().popLastAction()
    throw err  // existing error path handles UI rollback
  }
}
```

The marshaler `buildDeleteCardSnapshot(cardId, nodes, edges)` lives in
`src/lib/nodes.js` next to `dbNodeToReactFlow`. It produces:

```js
{
  dbCardRow: {
    id, campaign_id, type_id, label, summary, avatar_url,
    position_x, position_y, /* timestamps reconstructed at restore time */
  },
  dbSectionRows: [
    { node_id, kind: 'narrative',  content: storyNotes, sort_order: 0 },
    { node_id, kind: 'hidden_lore', content: hiddenLore, sort_order: 1 },
    { node_id, kind: 'dm_notes',   content: dmNotes,    sort_order: 2 },
    { node_id, kind: 'media',      content: media,      sort_order: 3 },
  ],
  dbConnectionRows: edges
    .filter(e => e.source === cardId || e.target === cardId)
    .map(e => ({
      id: e.id,
      campaign_id: campaignId,
      source_node_id: e.source,
      target_node_id: e.target,
    })),
}
```

The inverse, `restoreCardWithDependents`, is a new function in
`src/lib/nodes.js`:

```js
export async function restoreCardWithDependents({ dbCardRow, dbSectionRows, dbConnectionRows }) {
  // Insert the card with its original UUID so connections relink.
  const { error: nodeErr } = await supabase.from('nodes').insert(dbCardRow)
  if (nodeErr) throw nodeErr

  // Insert all four sections in one batch.
  if (dbSectionRows.length) {
    const { error: secErr } = await supabase.from('node_sections').insert(dbSectionRows)
    if (secErr) throw secErr
  }

  // Insert connections in one batch (with original IDs).
  if (dbConnectionRows.length) {
    const { error: connErr } = await supabase.from('connections').insert(dbConnectionRows)
    if (connErr) throw connErr
  }
}
```

The Realtime channel will broadcast the INSERTs back to this tab, but
the existing handlers are idempotent (they skip rows whose ids are
already in local state).

**Discipline risk:** if a future feature adds a new table referenced by
cards (e.g., `tags`), `buildDeleteCardSnapshot` and
`restoreCardWithDependents` both need to be updated, or undo will
silently drop the new data. The integration test (section 11) catches
this — it asserts campaign state is identical after delete → undo, so a
missing dependent fails the test loudly.

### 9. File map

**New files:**

| File | Purpose |
|---|---|
| `src/store/useUndoStore.js` | Zustand store: past/future stacks, scope, recordAction, popLastAction, popLastFutureAction, undo, redo, clear, sessionStorage persistence |
| `src/hooks/useUndoShortcuts.js` | Keyboard listener with Word-style exemption |
| `src/lib/undoActions.js` | The dispatcher — `applyInverse`, `applyForward`, `canApplyInverse`, `canApplyForward` switch statements |
| `src/store/useUndoStore.test.js` | Vitest tests for stack semantics (push, cap-at-75, clear, undo/redo cursor logic, do-do-undo-undo-redo-redo, hydrate-from-sessionStorage) |
| `src/lib/undoIntegration.test.js` | The integration test from section 11 |

**Modified files:**

| File | Why |
|---|---|
| `src/App.jsx` | recordAction calls in `onAddCard`, `onAddTextNode`, `onDeleteNode`, `onNodeDragStop` (with 4px threshold). Render `useUndoShortcuts()`. |
| `src/components/EditModal.jsx` | Session capture — snapshot on mount, emit per-changed-field action on close. |
| `src/components/ConnectionsSection.jsx` | recordAction calls in add/remove (immediate, not session-bounded). |
| `src/nodes/TextNode.jsx` | Session capture for text edits; immediate recording for toolbar/resize/delete. |
| `src/lib/nodes.js` | Add `buildDeleteCardSnapshot` + `restoreCardWithDependents`. Allow `createNode` to take an explicit id (for createCard restore). |
| `src/lib/connections.js` | Allow `createConnection` to take an explicit id. |
| `src/lib/textNodes.js` | Allow `createTextNode` to take an explicit id; add `restoreTextNode`. |
| `src/hooks/useCampaignData.js` | Call `useUndoStore.getState().setScope({ userId, campaignId })` alongside the existing `setLastSavedAt(null)`. |
| `src/lib/AuthContext.jsx` | On sign-out, `useUndoStore.getState().clear()` and remove any `mastermind:undo:${oldUserId}:*` entries from sessionStorage. |

**Not modified:** `src/components/SyncIndicator.jsx` — chip stays a pure
save-status indicator.

### 10. Phase order

Each phase ends in a working, testable state. The integration test for
delete-card lands immediately after delete-card is wired (phase 6),
since it's the riskiest piece and benefits most from a safety net.

| Phase | What | Test |
|---|---|---|
| 1 | `useUndoStore` skeleton + unit tests for stack semantics, including do-do-undo-undo-redo-redo and 75-cap | Vitest passes |
| 2 | `applyInverse` / `applyForward` / `canApplyInverse` dispatcher (skeleton) | Compiles |
| 3 | Wire `moveCard` end-to-end + keyboard shortcut hook + 4px threshold | Drag → Ctrl+Z → returns. Ctrl+Shift+Z → moves back. Tiny mouse jitter does not pollute. |
| 4 | Wire `editCardField` (session-based capture in EditModal) | Edit summary → close modal → Ctrl+Z → prior summary restores. Edit two fields → close → two Ctrl+Z's revert both. |
| 5 | Wire `createCard` and `deleteCard` (the hard one) + restore helper | Create → Ctrl+Z → gone. Delete a card with connections + sections + avatar → Ctrl+Z → all returns. |
| 6 | **Integration test from section 11** | All round-trips pass. |
| 7 | Wire `addConnection` and `removeConnection` (immediate, not session) | Connect cards → Ctrl+Z → connection removed. |
| 8 | Wire all four text-node actions (session-based for text edits, immediate for toolbar/resize/delete) | Same drill, on text nodes. |
| 9 | Toast wiring + conflict toast | Visual verification. |
| 10 | sessionStorage hydration + sign-out cleanup | F5 mid-session → history restored. Sign out / sign back in as different user → no history leak. |

### 11. Integration test (the safety net)

Single Vitest file, `src/lib/undoIntegration.test.js`. Covers the
delete-card-with-everything round-trip first (the canonical case
identified during scoping):

```js
describe('undo round-trips', () => {
  it('restores a card with sections, connections, avatar, position after delete + undo')
  it('restores a card field edit after edit + undo')
  it('restores a card position after move + undo')
  it('restores a connection after addConnection + undo')
  it('restores a connection after removeConnection + undo')
  it('restores a text node after delete + undo (with text, font size, alignment, size, position)')
  it('cap at 75: pushing the 76th drops the oldest')
  it('switching campaigns clears both past and future stacks')
  it('do-do-undo-undo-redo-redo executes in correct order (A, B, undo B, undo A, redo A, redo B)')
  it('refuses to apply inverse when current state has diverged on undo ("changed elsewhere")')
  it('refuses to apply forward when current state has diverged on redo')
  it('hydrates from sessionStorage on mount of same tab (F5 protection)')
  it('clears stack on sign-out so next user does not inherit')
})
```

Each restore-test: create-and-arrange → snapshot relevant DB state →
do the action → undo → re-snapshot → assert equality (modulo
auto-updated timestamps).

## Consequences

### Benefits

- Recovery from accidental delete/edit, the explicit problem this ADR
  addresses.
- Foundation for AI copilot UX (Sprint 5+) — bad AI output becomes safe
  to try because it's reversible.
- Per-action records enable a future "undo history" panel ("show me the
  last 20 things I did") at no extra cost — the data's already shaped
  for it.
- Conflict-aware in both directions (undo and redo): avoids the
  silent-data-clobber failure mode that blind-apply could cause in a
  multi-tab environment.
- Survives F5 / accidental refresh of the same tab — matches the most
  common "I lost my history" scenario.

### Trade-offs accepted

- **No live cross-tab sync.** Tab A's actions don't appear in Tab B's
  stack while both are open. Industry-standard behavior; alternatives
  open semantic worms (whose action did I just undo?) we don't want to
  wrestle with.
- **No cross-tab-close survival in V1.** Closing the tab loses its undo
  history. Refresh is fine (sessionStorage handles it). The localStorage
  + multi-tab-coordination version is the V2 path if real users ever
  hit this.
- **Discipline burden.** Each new destructive feature must register its
  inverse, capture its dependent rows in DB-shape, and have
  `canApplyInverse` + `canApplyForward` checks. The integration test is
  the guardrail.
- **Non-transactional delete-restore.** The 3-step restore (card →
  sections → connections) is not atomic. A partial failure mid-restore
  could leave inconsistent state. The failure mode is rare given
  `persistWrite`'s retry/lock behavior; if it becomes real, swap the 3
  inserts for one Postgres RPC `restore_card_with_dependents(...)` —
  same call site, transactional underneath.
- **Realtime echo on undo.** Each undo writes to the DB and echoes back
  through Realtime, briefly increasing inFlight write count. Same as
  any normal edit; the existing optimistic-UI flow handles it.

### When to revisit

- If users ask for cross-tab-close survival, swap sessionStorage for
  localStorage with multi-tab handling (heartbeats, claim resolution,
  optional grace window). The current data shapes are already
  serializable, so the swap is local to the store + a new persistence
  helper file.
- If users ever ask for live cross-tab undo (Tab A's actions appearing
  in Tab B's history while both are open), design v3 around
  BroadcastChannel coordination.
- If a real partial-restore failure is observed, swap the 3-step
  delete-restore for a single Postgres RPC `restore_card_with_dependents`
  for transactional correctness.
- If we ever add a new table that's a dependency of cards (tags,
  comments, etc.) and the integration test catches the gap.
- If the 75-action cap turns out to be wrong in practice. Easy to tune.
- If users want a visible "undo history" UI. The data is there; just
  needs a panel.

## References

- Sprint 2 entry: [BACKLOG.md](../../BACKLOG.md) — "Undo / redo
  (user-scoped)" is the source of the problem statement and success
  criteria.
- ADR-0003 (optimistic-UI persistence) — the architecture that makes
  command pattern the natural fit here. Undo flows through the same
  optimistic write path.
- ADR-0002 (modular node sections) — the section data model that the
  delete-card inverse has to capture.
- Sprint 1.5 / 1.5b (Realtime) — the cross-tab sync that interacts with
  undo's DB writes. Each undo round-trips harmlessly through the channel
  because the handlers are idempotent.
