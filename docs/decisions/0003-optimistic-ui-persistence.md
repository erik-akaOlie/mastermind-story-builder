# ADR-0003: Optimistic UI with fire-and-forget persistence
Date: 2026-04-22
Status: Accepted

## Context

Every data-mutating interaction (adding a card, editing a bullet, dragging a node, creating a connection) needs to update both React state and Supabase. Two things matter:

1. The UI should feel instant — MasterMind is the kind of tool a user uses in quick bursts during worldbuilding, and sluggish save cycles would be a paper cut.
2. The work is solo (one user per account for now), so network contention and concurrent writes are not a concern.

## Decision

**Optimistic UI + fire-and-forget persistence.**

Every handler:

1. Updates React state immediately (so the UI reflects the change instantly).
2. Calls the relevant `lib/*.js` function to persist to Supabase.
3. If the persist fails, `.catch(console.error)` — we log it and move on.

We do **not** await DB writes before updating the UI. We do **not** show loading spinners on individual writes. We do **not** roll back React state if a write fails.

## Consequences

**Benefits:**
- UI is fast. Dragging a card, editing a bullet, adding a connection — all feel immediate.
- Code is simpler. Handlers don't need to model loading/error states for individual saves.
- Works well with upcoming Sprint 1.5 Realtime, which will passively sync external changes into React state anyway.

**Accepted trade-offs:**
- Silent failures: if Supabase is unreachable, the user sees no warning. Next refresh would reveal the divergence. Mitigation path: when error-surfacing matters, add a global toast system that subscribes to `.catch()`s.
- No rollback: state in memory can drift from DB state if a write fails. For V1 (solo user on a reliable connection), acceptable.
- Race conditions across tabs: without Realtime, two tabs can each make local changes that overwrite each other on next refresh. Sprint 1.5 (Realtime) addresses this.

**When to revisit:**
- If multi-user editing becomes a product goal (deferred to later phases), we'll need conflict resolution and explicit error surfacing.
- If users start reporting silent data loss, add a lightweight "save status" indicator and retry-with-backoff on failed writes.

## References
- Patterns in `src/App.jsx` (all handlers)
- Patterns in `src/nodes/TextNode.jsx` (inline persistence)
- Fire-and-forget helpers in `src/lib/nodes.js`, `connections.js`, `textNodes.js`
