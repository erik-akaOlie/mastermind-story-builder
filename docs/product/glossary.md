# MasterMind: Story Builder — Glossary

*Project vocabulary. Each term has one meaning, one set of values, and one place in planning. When in doubt, this doc wins. Coined 2026-05-05 to retire the overloaded use of "Tier."*

---

## Planning vocabulary

These five terms cover everything we use to describe and prioritize work.

### Version

**Values:** V1, V2, V3, …

**What it describes:** which rollout an item ships in. Discrete and sequential.

**Where used:** [`roadmap.md`](./roadmap.md) (defines what V1 / V2 / V3 mean as scope), [`BACKLOG.md`](../../BACKLOG.md) (each item carries a target Version), ADRs (decisions reference the version they apply to).

**Notes:** Versions are about *when* something ships. They are independent of priority and effort. A Foundational Progress item can still be V2 if it depends on something else; a Quick Win can be V1 if it's S-sized and the user has been waiting on it.

---

### Value Add

**Values:** Quick Win, Foundational Progress, Strategic Bet, Exploration

**What it describes:** the *kind* of value the work delivers. Replaces the previously overloaded use of "Tier" in the backlog.

| Value Add | What it is | Typical Effort |
|---|---|---|
| **Quick Win** | Small, immediate user value. Ships fast, low risk, high leverage. | S |
| **Foundational Progress** | Builds the core experience. Required for the product to be what it claims to be. | M – L |
| **Strategic Bet** | Big differentiator features that need a spike + multi-sprint commit. The product's defensibility lives here. | XL |
| **Exploration** | Investigative or experimental work. Bug investigations, hobbyhorse ideas, things whose value isn't yet clear. | Variable |

**Where used:** [`BACKLOG.md`](../../BACKLOG.md) — each item lives in exactly one Value Add band.

**Notes:** Value Add describes the *nature* of the work, not its priority within a band. A given band can hold many items, ordered separately by judgment. The matrix on the canvas plots **Impact × Effort** to inform within-band ordering.

---

### Effort Size

**Values:** S, M, L, XL

**What it describes:** engineering complexity / time to ship.

| Size | Roughly |
|---|---|
| S | < 1 day |
| M | 1–3 days |
| L | 4–10 days (a sprint's "big thing") |
| XL | needs a spike + multi-sprint commit |

**Where used:** [`BACKLOG.md`](../../BACKLOG.md), ADRs, sprint planning.

**Notes:** Estimates are honest, not inflated. If an item is sized L, it really is 4–10 days; if XL, it really does need a spike. See the "process habits" section of `BACKLOG.md`.

---

### Impact

**Values:** described qualitatively in each item's problem statement. Not bucketed.

**What it describes:** user / product value. The matrix Y-axis.

**Where used:** problem statements in [`BACKLOG.md`](../../BACKLOG.md); priority discussions; the canvas-as-roadmap matrix.

**Notes:** Deliberately not a discrete scale (no "High / Medium / Low"). The discrete bucketing usually compresses meaningful nuance and creates phantom precision. We describe Impact in prose and let the matrix's spatial layout do the comparison work.

---

### Depth Level

**Values:** Depth 1, Depth 2, Depth 3, Depth 4, Depth 5

**What it describes:** how central a node is *in the user's knowledge graph*. Depth 1 is story-critical (Strahd); Depth 5 is peripheral (a tavern patron mentioned once).

**Where used:** knowledge-graph features only — not project planning. Depth Level is a *property of the user's content*, not of our work. Likely surfaces in features like the 5-tier visual hierarchy, search ranking, and zoom-out fade behavior.

**Notes:** This is the only term that describes the user's data rather than our backlog. Don't confuse Depth Level with Effort Size or Version.

---

## Deprecated terms

The following were used previously and should not appear in new docs. References in `CHANGELOG.md` (historical record) are left untouched.

| Deprecated | Replaced by |
|---|---|
| Tier 1 | Quick Win (Value Add band) |
| Tier 2 | Foundational Progress (Value Add band) |
| Tier 3 | Strategic Bet (Value Add band) |
| Tier 4 | Exploration (Value Add band) |
| Priority Band | Value Add |
| "Phase" (when used for the rollout) | Version |

If you encounter "Tier" in a new doc, replace it with the right term from the table above based on what the author meant.

---

## Other terms used throughout the project

These aren't planning vocabulary, but they're project-specific terms a new contributor might miss.

| Term | Meaning |
|---|---|
| **Card** | A node in the campaign — character, location, item, faction, story. Rendered as a colored rectangle on the canvas. |
| **Connection** | An edge between two cards. May or may not carry a relationship type (typed connections ship in V1). |
| **Nest** | A FigJam-section-style container that groups cards / connections / text annotations into a thematic unit. Recursive. Ships in V1. |
| **Run mode** | Live-session UI optimized for mid-play retrieval. Surfaces relevant cards based on conversation context. V2 feature. |
| **CoOS** | Campaign Operating System — the long-term product framing. The graph is V1–V2; ops layer is V3+. |
| **GMOS** | Synonym for CoOS, used in some older strategy docs. Same thing. |
| **Discovery state** | The two-layer model where the DM sees everything and players see only what their characters have encountered. Designed in `design-system.md` §4; player view ships in V3. |
| **Realtime** | Cross-tab sync for one user's edits, via Supabase Realtime channels. Already shipped. Not the same as multi-user collaboration. |
