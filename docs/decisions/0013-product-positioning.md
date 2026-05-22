# ADR-0013: Product positioning
Date: 2026-05-21
Status: Accepted

## Context

MasterMind began as a personal tool for one D&D campaign. Through building and using it, a suspicion formed that the underlying problem extends well beyond D&D — the same difficulty appears in UX research synthesis, journey mapping, organizational-systems work, and other relationship-heavy thinking. ADR-0012 (the `campaign` → `workspace` rename) acted on an early form of that suspicion and explicitly flagged a "Product-language audit" as follow-up work.

This ADR is that follow-up. It records the outcome of a structured product-discovery exercise (2026-05-21) and settles V1 positioning. The discovery deliberately did not jump to "who else could use this." It first defined the problem precisely, then tested whether that problem is one problem or several different problems that merely resemble each other.

## Decision

### The problem MasterMind solves

**People struggle to identify important opportunities and insights when many interconnected elements must be considered simultaneously within a larger system.** When information is held in the head, or spread across linear documents and separate tools, elements can only be examined one at a time — and relationships, gaps, and opportunities stay invisible.

This problem is **broad** — genuinely felt across many kinds of complex creative and analytical work. Broad is not the same as vague, and broad is not wrong. The discovery produced strong evidence that this is **one shared underlying problem**, not several different problems that merely rhyme — strong evidence, not yet full proof. (The mechanism behind it — the value of a wide simultaneous view, low-cost manipulation of elements, and one-idea-per-object — will be captured in `vision.md` when it is updated; it is not restated here.)

### V1 target user

V1 is built for people whose work is **building an invented fictional world and developing a story within it** — inventing and growing an interconnected set of characters, locations, factions, and events over time, and shaping a narrative through them.

**Game masters (GMs) preparing tabletop-RPG campaigns are the concrete, currently-evidenced instance of this user** — the founder and both current testers (one DM, one game designer/writer) work this way. They are a **target user with initial evidence and planned validation**, not a validated user (see Assumptions). Initial evidence: the founder's own experience plus the two testers. Planned validation: guerrilla testing with DMs/GMs at Mox Boarding House.

Choosing this user is a deliberate beachhead decision — the problem itself is broad; the V1 *focus* is a choice, not a narrowing of the problem.

A durable *label* for this user is **not yet settled**. This ADR describes the user by behavior and deliberately does not coin one; naming is treated separately, alongside branding.

### Product terms

The top-level architectural object is the **workspace** (renamed from `campaign` in ADR-0012). Its V1 product-facing label is **not yet finalized** — product branding is placeholder and will be settled shortly before hard launch. Documentation and ADRs use the stable architectural term, "workspace."

### Scope boundaries

- **Custom card types are core** to the product — confirmed, not a speculative future feature. (The architecture supporting this is ADR-0014.)
- The broader **cross-domain "knowledge platform for any domain"** idea (UX research synthesis, organizational mapping, investigative work, etc.) is **demoted from product direction to a documented, unvalidated hypothesis.** It is recorded so it is not lost, but it does not shape V1.
- This ADR does **not** address the "Game Master Operating System" roadmap (running-the-game features such as scheduling, billing, session ops). That is a separate expansion question the discovery did not examine; it stands as previously documented and is neither endorsed nor demoted here.

## Assumptions (explicit, unvalidated)

- **The problem is felt broadly beyond the founder.** Believed, not yet validated — every concrete example examined in the discovery came from the founder. Validating this is the purpose of the planned tester round.
- **Everyone the behavioral definition above covers shares one coherent workflow.** Believed, untested. Game masters are the evidenced instance; others who build invented worlds and develop stories within them (for example, some fiction writers) may not share the same workflow.

## Open questions

- Does the broad problem genuinely recur, with the same shape, in the other domains where it appears to (UX research synthesis, organizational mapping, investigative work)? Unexamined — the cross-domain hypothesis rests on it.
- If validation shows the behaviorally-defined user is not one coherent group with one workflow, V1 scope narrows to game masters specifically.

## Consequences

- Documentation updates follow, tracked separately: significant updates to `vision.md`, `glossary.md`, and `CLAUDE.md`; lighter updates to `roadmap.md`, `design-system.md`, the root `README.md`, and the `docs/strategy/` files. The cross-domain idea is relocated into `roadmap.md` as an explicitly-labeled hypothesis.
- The "Product-language audit" future-work item flagged by ADR-0012 is resolved by this ADR.
- Product positioning and architecture remain intentionally separable (per ADR-0012): the architecture stays generic ("workspace"), while V1 product language stays specific and GM-flavored. The user-facing product label is unresolved and deferred to branding.

## Related decisions

- [ADR-0012](./0012-rename-campaign-to-workspace.md) — flagged the product-language audit this ADR resolves; its generic "workspace" architecture is the substrate this positioning sits on.
- [ADR-0014](./0014-workspace-schema-architecture.md) — the architectural companion: how the data model preserves a future path to customizable workspace schemas.
