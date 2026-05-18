# ADR-0011: Persistence failure escalation — silent retry, lock overlay, probe-not-requeue
Date: 2026-05-16
Status: Accepted

> **Terminology note (post-2026-05-18):** This ADR predates ADR-0012's `campaign` -> `workspace` rename. References to "campaign(s)" / `campaign_id` here describe the architectural object now called "workspace" / `workspace_id`. The decision content remains accurate; only the names changed.

## Context

[ADR-0003](./0003-optimistic-ui-persistence.md) established optimistic UI with fire-and-forget persistence: handlers update React state immediately, call the relevant `lib/*.js` function, and `.catch(console.error)` on failure. That pattern works under happy-path conditions but is silent when something is actually wrong — the user has no idea their work isn't being saved.

Three follow-up questions emerged in practice:

1. Should a single failed save get any user-visible attention, or is silent retry enough?
2. When do persistent failures stop being "background noise" and start blocking the user?
3. Once the system recovers, how does it know — and what does the user have to do?

These are operationally non-obvious. The wrong answers cause data corruption (duplicates from retrying inserts that secretly succeeded), trust erosion (the user keeps editing while writes are silently failing), or excessive friction (locking on every blip).

## Decision

Three coupled mechanisms, escalating in visibility.

### 1. In-flight retry — `persistWrite()` ([src/lib/errorReporting.js](../../src/lib/errorReporting.js))

Every mutation passes through `persistWrite()`, which wraps the call in **up to 3 attempts** (initial + 2 retries at 250ms and 500ms delays). Failures with HTTP 4xx status codes short-circuit — retrying a 400/403/409 wastes time. Successful attempt resolves the chain; final failure throws to the caller AND fires `toastSaveFailed(context)` AND increments `consecutiveFailures` in `useSyncStore`.

Most transient failures (brief Wi-Fi blip, momentary backend hiccup, token refresh) heal here without any UI change.

### 2. Three-stage user-visible state — driven by `useSyncStore` ([src/store/useSyncStore.js](../../src/store/useSyncStore.js))

- **Sync chip text** ([src/components/SyncIndicator.jsx](../../src/components/SyncIndicator.jsx)): "Edited Xm ago" by default; flips to "Can't save" once `consecutiveFailures > 0` but below the lock threshold; flips to "Offline" when `navigator.onLine === false`.
- **Lock overlay** ([src/components/LockOverlay.jsx](../../src/components/LockOverlay.jsx)): full-screen modal blocking editing. Triggered by `consecutiveFailures >= 3` OR `isOffline === true` (selector: `selectLocked`).
- Lock auto-dismisses when `consecutiveFailures` resets to 0, which any successful write — including a probe — accomplishes.

### 3. Probe loop, not requeue — `useProbeLoop()` ([src/lib/useSyncLifecycle.js](../../src/lib/useSyncLifecycle.js))

While the app is locked, a lightweight `select id from campaigns limit 1` fires every 3 seconds. A successful probe resets `consecutiveFailures` to 0 and the lock dissolves. **We do NOT re-run the original failed writes.**

## Consequences

**Benefits:**
- The user is shielded from transient failures — `persistWrite`'s internal retry handles most blips invisibly.
- Persistent failures get clear graduated escalation rather than either silent loss or alarmist-on-first-failure.
- Offline state recovers without any user action when connectivity returns.
- Data integrity is preserved across the failure boundary — no duplicate creates, no half-applied state.

**Accepted trade-offs:**
- A failure-triggered lock requires a manual page refresh to escape. Recent unsaved work — anything in flight when the lock appeared, or typed into modals after — is lost. We accept this in exchange for not duplicating writes that may have silently succeeded server-side.
- `persistWrite`'s retry-3-times pattern can produce duplicates on INSERT paths if the server accepted a request but the response was lost. `createCampaign` opts out with `{ retries: 0 }` because duplicate campaigns + duplicate seeded `node_types` rows would be destructive. Any future INSERT-path that's destructive on duplicate must do the same.
- The 3-second probe interval means up to a 3-second delay between server recovery and lock dismissal. Negligible in practice.

### Why probe instead of requeue

A failed write might have succeeded server-side, with only the response lost in transit. Re-running it could create duplicates — particularly destructive for INSERT paths (a duplicate `createCampaign` orphans its seeded types; a duplicate node creates a phantom card with the same data). The probe answers a strictly side-effect-free question ("is the server reachable?") and the user's path back to a known state is a refresh — clean and explicit.

### Why 3 failures, not 1 or 10

- **1** would lock on a single network blip, which `persistWrite`'s internal retry already handles — too eager.
- **10** would let the user keep typing through ten failed saves, compounding lost work — too slow.
- **3** is the smallest count with enough statistical signal that the next save is unlikely to spontaneously succeed, while short enough that the user hasn't typed many more keystrokes into limbo.

### Why a full overlay instead of a banner or toast

A banner can be dismissed or visually ignored. The danger of "save is broken" is that **every additional keystroke is more potentially-lost work** — passive UI lets the user worsen their own position. The overlay halts editing-flow until either the probe confirms recovery (passive resolution) or the user makes a deliberate choice (active refresh).

### When to revisit

- **Multi-user editing** (V3+ territory): the probe-only model probably stays, but the requeue question gets harder because other users may have changed state in the meantime — conflict resolution layers on top.
- **Session replays show frequent lock encounters**: widen the threshold (e.g. to 5), shorten the probe interval, or add state-preservation across refresh.
- **A real production data-loss incident traced to the refresh-resets-recent-edits behavior**: revisit whether some bounded requeue with idempotency keys becomes worthwhile.

## References

- [ADR-0003](./0003-optimistic-ui-persistence.md) — the optimistic-UI foundation this layers on
- [src/lib/errorReporting.js](../../src/lib/errorReporting.js) — `persistWrite()` retry wrapper
- [src/lib/useSyncLifecycle.js](../../src/lib/useSyncLifecycle.js) — `useOnlineListener()` + `useProbeLoop()`
- [src/store/useSyncStore.js](../../src/store/useSyncStore.js) — state machine, `selectLocked` derivation
- [src/components/SyncIndicator.jsx](../../src/components/SyncIndicator.jsx) — the bottom-left chip
- [src/components/LockOverlay.jsx](../../src/components/LockOverlay.jsx) — the full-screen lock modal
- [docs/design/design-system.md §7.7](../design/design-system.md) — user-visible escalation behavior
