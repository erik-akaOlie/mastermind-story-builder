# Architecture Decision Records

This folder captures significant architectural decisions as **ADRs** (Architecture Decision Records). Each ADR is a short document that records the context, the decision, and the consequences.

## Why this exists

Solo projects (and small-team projects) accumulate architectural decisions that "feel obvious now but won't in six months." Writing them down costs ~10 minutes and saves hours of re-litigation later. This folder is append-only: superseded decisions get a new ADR pointing back to the old one, not an edit.

## Format

Each ADR is a file named `NNNN-short-description.md` where NNNN is zero-padded:

```
# ADR-0001: Short decision title
Date: YYYY-MM-DD
Status: Proposed | Accepted | Deprecated | Superseded by ADR-XXXX

## Context
Why are we making this decision? What problem does it solve?

## Decision
What did we decide?

## Consequences
What does this enable? What does it prevent? What are the trade-offs?
```

## What an ADR records

An ADR records **settled decisions and architecture.** It stays intentionally silent on terminology, naming, and product labels that are not yet resolved. Illustrative examples used while discussing a decision are not promoted into an ADR as terminology unless they are explicitly chosen as decisions.

## Index

- [ADR-0001: Supabase over Firebase as the backend](./0001-supabase-over-firebase.md)
- [ADR-0002: Modular node sections in the schema from day one](./0002-modular-node-sections.md)
- [ADR-0003: Optimistic UI with fire-and-forget persistence](./0003-optimistic-ui-persistence.md)
- [ADR-0004: Inline `@`-mention syntax for cross-card references](./0004-inline-mentions-syntax.md)
- [ADR-0005: Image storage on Supabase Storage with two variants per upload](./0005-image-storage.md)
- [ADR-0006: Undo / redo via command pattern with a per-campaign action stack](./0006-undo-redo.md)
- [ADR-0007: Deferred image persistence](./0007-deferred-image-persistence.md)
- [ADR-0008: Card-type defaults in code, customizations as sparse overrides](./0008-card-type-defaults-in-code.md)
- [ADR-0009: Behavioral analytics + session replay, scoped to invited testers via PostHog](./0009-behavioral-analytics-session-replay.md)
- [ADR-0010: Zoom-to-node-view — progressive disclosure via card↔circle morph at altitude](./0010-zoom-progressive-disclosure.md)
- [ADR-0011: Persistence failure escalation — silent retry, lock overlay, probe-not-requeue](./0011-persistence-failure-escalation.md)
- [ADR-0012: Foundational rename — campaign → workspace](./0012-rename-campaign-to-workspace.md)
- [ADR-0013: Product positioning](./0013-product-positioning.md)
- [ADR-0014: Workspace schema architecture — data-driven, deferred](./0014-workspace-schema-architecture.md)
- [ADR-0015: Float-or-dock Inspector for card editing](./0015-float-or-dock-inspector.md)
- [ADR-0016: Block-editor foundation](./0016-block-editor-foundation.md)
- [ADR-0017: Mox free-beta launch — model, recording posture, and operations](./0017-mox-free-beta-launch.md)
- [ADR-0018: Transactional auth email — reusable per-app sending infrastructure](./0018-transactional-email-infrastructure.md)
