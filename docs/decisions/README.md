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

## Index

- [ADR-0001: Supabase over Firebase as the backend](./0001-supabase-over-firebase.md)
- [ADR-0002: Modular node sections in the schema from day one](./0002-modular-node-sections.md)
- [ADR-0003: Optimistic UI with fire-and-forget persistence](./0003-optimistic-ui-persistence.md)
- [ADR-0004: Inline `@`-mention syntax for cross-card references](./0004-inline-mentions-syntax.md)
- [ADR-0005: Image storage on Supabase Storage with two variants per upload](./0005-image-storage.md)
