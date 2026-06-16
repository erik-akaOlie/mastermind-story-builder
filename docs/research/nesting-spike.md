# Spike: Nesting as a Capability of Nodes — Working Document

**Date started:** 2026-06-12
**Status:** Q0 revised after Erik's first review — awaiting sign-off
**Charter:** the Outcome section of [grouping-discovery.md](./grouping-discovery.md) — binding. Two bars (technical feasibility + experience improvement), five kill conditions. The hypothesis under test, restated in correct vocabulary: *any node can optionally lead a group of other nodes; the leader is the group's face; opening/closing the group is how abstraction control happens.* World structure only; working sets out of scope.

**Plan (agreed 2026-06-12):**

| Step | Question | Form | Box |
|---|---|---|---|
| Q0 | What does opening/closing a group actually mean? | Paper — expectations, then invariants | 0.5 day |
| Q1 | Does a closed group make the map easier or harder to read? | Rough mockups, 4 scenarios × 3 states | 1 day |
| Q2 | Will our canvas (React Flow + our custom systems) fight us? | Reading (0.5d) + throwaway prototype (1.5d), gated on Q1 | 2 days |
| Q3 | Can it be stored, undone, and synced without horror? | Paper + spike verdict | 1 day |

Erik reviews after Q0 and Q1. Prototype code lives on a throwaway branch, saves nothing, never merges.

---

## Terminology (binding — restores ADR-0010 / ADR-0012 vocabulary)

- **Node** is the entity. Everything else is presentation.
- **Bead** and **card** are existing display states of a node (ADR-0010).
- **Nest** / **group leader** (naming TBD) — the candidate *new* display state this spike explores: a node that leads a group, rendered in a modified version of its card mode. A closed nest may also have a bead-altitude rendering — open design space.
- Never "cards contain cards." Nodes may lead groups; display states render that fact.
- **Naming of open-state behaviors: ON HOLD** (see Q1 round 3). Earlier drafts called the two candidate behaviors "window/room," then "Model W/N," then "on-canvas open / in-card open" — all retired or rejected. Erik's authoritative framing: the **lens** is "sub-groupings on or off" (OFF = every node on the canvas; ON = leaders only, each holding its subgroup's knowledge graph inside its card). Pending Erik's confirmation that no boundary-drawn-on-canvas open state exists, the fork itself dissolves and no names are needed. **Standing rule: no term enters this project's vocabulary without Erik authoring or approving it; new terms are introduced with an inline definition and flagged for his approval.**

This is not pedantry: "card contains card" quietly imports a containment architecture; "node has display states" keeps what-it-is, how-it-renders, and what-it-leads as separate layers — which is the capability model's entire premise.

---

## Q0 — Group semantics (the contract) — REVISED 2026-06-12

> Framing: **product truths are the rules I believe must outlive the spike — challenge them. Spike constraints expire with the spike. Candidate behaviors are deliberately undecided and get explored, not assumed.**

### Step 1 — What does a GM expect when they close a group?

| Expectation | In the GM's words | Maps to |
|---|---|---|
| A. Unify | "Show me Barovia as a single thing" | P3 (represent structure) |
| B. Disclose progressively | "Hide what's not relevant right now" | P2 / tenet 2 (progressive disclosure) |
| C. Summarize | "Tell me what's in there / how developed it is, at a glance" | P2; Chris's developed-vs-thin signal |
| D. Move | "Let me move the town" | P1 (move as unit) |

**Revision note (B):** previously framed as suspect; Erik and ChatGPT both corrected this. B *is* a legitimate need — it is tenet 2 operating on the canvas. The real distinction is **good hiding** (details recede, awareness preserved — a face remains that says what's in there) vs **bad hiding** (content vanishes from the user's mental model). The diagnostic survives in narrower form: hiding that costs *awareness* is the kill-condition-5 signal, not hiding itself.

**Correction (tags/filters):** discovery eliminated tags/filters *as the primary solution to the world-structure problem* ("hides, doesn't summarize"). They were not retired from the product — the discovery doc itself marks them a future complement for working sets, search, and filtering.

### Step 2a — Product truths (challenge these; they outlive the spike)

- **T1 — Closing a group changes what you see, never what exists.** Nothing created, destroyed, or rewritten; close → open is a lossless round trip. *(Erik: agreed.)*
- **T2 — Nothing is ever unintentionally obscured.** The user must always be able to see content that isn't deliberately tucked away, so no narrative element is forgotten by accident. *(Erik's formulation — replaces the old "nothing gets rearranged."*)
- **T3 — Spatial memory is honored.** Content stays where the user put it; if the system ever moves content on the user's behalf (e.g., to satisfy T2 when a group opens), closing the group returns that content to its original position — or as close as possible without violating T2. *(Erik's formulation. T2 and T3 are in deliberate tension; resolving HOW is candidate behavior C2, not a truth.)*
- **T4 — Moving the leader moves the world it leads.** Relocating a closed group relocates its members; this is the P1 payoff. *(Erik: agreed.)*
- **T5 — Relationship awareness survives simplification, one line per visible pair.** The product already renders exactly one line between any two nodes regardless of how many relationships they share; groups extend this: a closed group shows one line per (group, outside-node) pair; opening the group splits lines to show which members carry which relationships — still one line per visible pair. Awareness of a relationship's existence is never lost; line *count* is always minimal. *(Erik's strengthening, consistent with the shipped one-line-per-pair invariant.)*
- **T6 — Membership is explicit and user-authored.** Never inferred from position. Moving a node in or out of a group is drag-simple.
- **T7 — A node has at most one direct group; groups may nest.** Sibling groups never share a member (Erik: agreed), but a group can live inside another group — the cultist sits in Cult ⊂ Death House ⊂ Barovia and that is *intended product direction*, not an edge case (Erik's vision; discovery finding #6 "do not paint out"). Structurally this means group membership forms a tree.
- **T8 — Grouping and altitude are independent concepts.** A group exists at any zoom; closing/opening is never a side effect of zooming. **How a group leader renders at each altitude is open design space** — and visual differentiation of leaders is likely *required*, not optional: P3's success criterion (a newcomer can name the major formations) fails if a closed group is indistinguishable from an ordinary node. *(Weakened from the old "a closed parent is just a node," which prescribed a rendering before exploration.)*

### Step 2b — Spike constraints (temporary; expire with the spike)

- **S1 — The spike evaluates one nesting level.** Recursion (T7) is product truth; testing it is not in this spike's box. The spike MUST verify the candidate model doesn't structurally preclude recursion, and the verdict must state what recursion would add in cost. Erik's acceptance is conditional: postpone only if genuinely a major complication, and prioritize it soon after — record that in the ADR.
- **S2 — Four scenarios, rough over polished:** Death House (small location), Village of Barovia (large location), Durst family, Order of the Silver Dragon (faction — stresses scattered members and the sibling-exclusivity rule).
- **S3 — No production code.** Prototype on a throwaway branch; saves nothing; never merges.

### Step 2c — Candidate behaviors (Q1/Q3 explore these; nothing here is decided)

- **C1 — Erik's nest-section vision (leading visual hypothesis for Q1).** The group leader's card mode gains a large section — peer to Card View / GM's Eyes Only / Connections in spirit, not in implementation — that works like a **mini canvas**: the member graph lives and is engaged with *inside* the leader's frame, in both the canvas card and the Inspector. Q1 draws this first.
  - **The fork C1 opens (O7):** do member nodes keep *world* positions (closing hides them in place; opening traces a boundary around them on the canvas), or do their positions become *relative to the nest's interior* (the group renders as a mini graph inside the leader's card)? These differ on spatial memory, on what ungrouping restores, and on what "move the town" means mechanically. Q1 must sketch both models at least once.
- **C2 — What happens when an opened group needs room.** Candidates: (1) overlap neighbors — violates T2; (2) permanently shove neighbors — violates T3; (3) temporarily displace neighbors, restore on close — Erik's instinct; (4) opening is a view/focus mode rather than an in-place expansion. Q1 tests how (3) and (4) *feel*; Q3 prices them honestly (restore-on-close has real machinery: displaced-position bookkeeping, multiple groups open at once, the user hand-moving a displaced node mid-open, what a second tab sees).
- **C3 — Line merge/split rendering** as groups close/open (count badges? thickness? plain lines?). Bounded by T5.
- **C4 — Leader rendering at each altitude** — closed nest as card-with-signal, bead-with-halo, something new. Bounded by T8's differentiation requirement.

### Step 3 — The picture Q1 will draw

For each scenario, three states against today's graph: **closed** (leader renders as a nest face; outside lines re-routed per T5), **open** (member graph visible — drawn per C1, with at least one sketch each of the two O7 models), and **the transition moment** (what the map does the instant Barovia opens — C2 candidates 3 and 4). Plus both altitudes for the closed state (C4). Headline judgment: readability, per kill condition 2.

### Open questions

| # | Question | Answered in |
|---|---|---|
| O1 | Drag-while-open: does moving the leader move members? How do you reposition the leader itself within an open group? | Q1 |
| O3 | Line merge/split rendering details | Q1 (C3) |
| O4 | Is open/closed state shared world state (syncs to other tabs/users) or per-viewer? Discovery constraint #3 says per-group state *persists*; for whom is open. | Q3 |
| O5 | Marquee-clips-a-group rule | Q3 (candidate rules for Erik) |
| O6 | Open/close transition visual | Q1 |
| O7 | Member positions: world coordinates vs nest-relative (the C1 fork) | Q1 sketches both; Q2/Q3 price the survivor. Likely resolving to leader-relative + in-card (see Q1 round 3) |
| O8 | Reorganize-while-grouped: collision/nudge rule when members unfold into a reshaped, crowded neighborhood | Q3 |

*(Former O2 — "does an open group have a visible boundary?" — absorbed into C1: the nest frame is the boundary in Erik's vision; Q1 still tests whether it reads well.)*

---

## Q1 — Readability mockups (in review)

Five sketch sets delivered in-session 2026-06-12 (rough SVG, disposable; findings live here, not the sketches): (1) Barovia today vs closed — 12 objects/13 lines → 5 objects/4 lines, line-merge per T5 shown; (2) three closed-nest face candidates (badge+stack, living preview, member row) + three bead-altitude treatments (plain, double-ring+count, constellation glyph); (3) the O7 fork drawn — on-canvas open (boundary traces members at world positions) vs in-card open (mini graph inside the leader's card); (4) C2 candidates — displace-and-restore vs focus mode; (5) faction stress test — scattered members open vs closed.

**Findings surfaced by drawing (provisional until Erik reacts):**

- **F1 — The faction scenario breaks on-canvas open.** A scattered group has no traceable boundary — a boundary around its members would enclose half the map including non-members. Closing a scattered group under hide-in-place punches ghost holes across the map and stretches re-routed ties arbitrarily far. On-canvas open is only coherent for spatially clustered groups (locations, mostly). In-card open handles scatter (no boundary is ever drawn on the map). Possible resolutions to evaluate: (a) spatial grouping is for spatial structures only and factions get marked, not nested (the orange-ring treatment); (b) in-card open for all groups; (c) hybrid. This is the spike's sharpest open finding.
- **F2 — The "living preview" face is Chris's developed-vs-thin signal made literal.** A dense town shows a dense miniature constellation; a thin one shows two dots. Summarize-without-numbers. Risk: noise at small sizes.
- **F3 — Every group needs a leader node; not every group has a natural one.** Village of Barovia: obvious leader exists. Durst family: no single world entity IS the family — the user must create one (likely a faction- or story-type node, which the type system already supports). "Create the leader as part of grouping" needs to be a first-class flow, not an error case.
- **F4 — Sibling exclusivity held in the sketches** via "member of one group, *related* to others" (Ireena: member of Barovia, line to the Order's leader). Whether that reads as sufficient is Erik's call on the faction sketch.

**Erik's reactions (2026-06-12):**

- **D1 — Closed view validated.** "Less cluttered and therefore less overwhelming, which is the point of progressive disclosure." Kill condition 5 (value dilution) does NOT fire on the readability sketch. Toggle control between the two views must be user-driven (consistent with discovery constraint #3: per-group state + whole-map lens).
- **D2 — Faces chosen: living preview (card altitude) + double ring with count (bead altitude).** The miniature-constellation face wins — which also bakes in Chris's developed-vs-thin signal (F2). Small-size legibility of the preview is a Q2 prototype check.
- **D3 — REVISED 2026-06-12 (same day): O7 is NOT resolved — two open-state models carry forward.** Erik's first reaction favored on-canvas open, then he corrected the record with a mockup: he had not meant to prescribe members-on-the-canvas as the only open state. The two candidates now both alive:
  - **On-canvas open:** members appear on the world canvas at their world positions with a boundary traced around them. Members render on the map.
  - **In-card open (Erik's mockup):** the leader's card opens (Inspector-like surface) with the member graph rendered as a mini bead-graph *inside a section of the card*, beside the Card View content. The world canvas behind does not change. While the lens is collapsed, the map shows only the leader.
  - Consequences mapped so far: in-card open *appeared* to eliminate the C2 space problem and the "members leave the world map" cost — **both claims corrected same-day, see D6 and T9 below**. In-card open does handle scattered factions cleanly (F1 dissolves). On-canvas open keeps the whole world on one map and member-level cross-links visible in place, but requires a spatial-only scope line.
- **D4 — Focus-mode dimming rejected for group-open** ("doesn't make sense to hide data at a time when the user is actively trying to expose more data"). Erik confirmed the elimination reading: displace-and-restore is the only standing C2 candidate. (Initially recorded as needed only under on-canvas open; D6 supersedes — needed under both models.)
- **D5 — Resolved: one node per narrative element, ever.** No dual membership. A node lives in at most one group and may be *connected* to any number of others (Ireena: lives in Barovia's group, line to the Order). T7 confirmed as written.
- **Spatial-only scope line — now contingent on O7.** Under on-canvas open, groups must be spatially clustered (a boundary can't trace scattered members); the "circles for things that live together, lines for things spread apart" rule applies. Under in-card open, scatter is a non-issue and no scope line is needed. Decision travels with the O7 choice.

**Round 2 corrections (Erik, 2026-06-12, after the Model N mockup):**

- **D6 — The space problem survives under in-card open.** The open nest card is a large surface that covers canvas nodes beneath it. Erik's requirement: nodes underneath slide out from under the card and return to their saved spots when it closes. Displace-and-restore machinery is therefore needed under BOTH models (on-canvas open: make room in the world's layout; in-card open: clear the area under the overlay card). **Open consistency question for Erik (flagged, not answered):** today's Inspector also covers canvas nodes and does not displace them — does the same slide-aside rule apply to the Inspector too, or is there a reason nest-open differs? The answer defines whether displacement is a nest behavior or a general overlay behavior.
- **T9 (new product truth) — Every node keeps a world position, always; grouping is state AND lens.** Per-group open/closed persists (state). Additionally a whole-map control exists: groupings OFF renders every node of the campaign on the canvas at its world position ("the entire campaign in all its glory"); groupings ON collapses members into their leaders' nest cards — mini knowledge graphs inside nodes. Members never lose their world positions; the lens only changes where they *render*. This kills the earlier "members leave the world map" cost claim — they leave it only while the lens is collapsed, reversibly.
- **F1 clarified (scatter):** the scattered-faction problem was only ever about on-canvas open (a boundary drawn on the map around scattered members would enclose strangers). In-card open draws no boundary on the map — members render inside the card — so scatter never arises there. Closed behavior is identical under both models (members vanish from their spots; ties re-route to the leader).
**Round 3 (Erik, 2026-06-12):**

- **Proposed names rejected; naming on hold.** "On-canvas open" read as if it named the all-nodes-visible lens state, which makes no sense. Erik's own framing of the model, recorded as authoritative: **the lens is "sub-groupings on or off."** Groupings OFF → every node visible on the canvas. Groupings ON → only the high-level nodes are visible; a leader holds its subgrouped nodes as a knowledge graph inside its card. A node still has card view and bead view; additionally a node either is a plain narrative element or is the parental narrative element of a group. **Open confirmation question:** in this framing there appears to be NO state where members sit on the main canvas with a boundary drawn around them (the old "frame" sketch) — opening a group always means looking inside the leader's card. If Erik confirms, the O7 fork resolves to the in-card behavior, the second model is dead, and no model names are needed at all.
- **O8 (new) — Reorganize-while-grouped.** Erik: if the user significantly rearranges the graph while groupings are ON, then turns groupings OFF, restoring members to their *old absolute* positions would defeat the reorganization. Resolution direction: T4 already stores member positions *relative to their leader* — so members unfold around the leader's NEW location automatically; "original position" means "original position within my group," not absolute coordinates. Residual hard case for Q3: unfolding into a neighborhood that the reorganization made crowded (members would land on top of strangers) needs a collision/nudge rule — the system "does its best job to merge" the old in-group arrangement with the new map shape. No auto-layout beyond that.
- **T7 rationale strengthened (Erik's articulation, preserve for the ADR):** nodes are like note files and the canvas is like a folder — spatial, but flat. Groupings add depth: a Z-axis of organization, toggled by the lens between a 2D view (all files spread out) and a 3D view (files filed inside their parents). File structures being more than one layer deep is fundamental — the same will be true here. Multi-level grouping is a committed product direction; V1 ships ONE level (S1 confirmed by Erik), and the one-level-per-surface rendering rule is what keeps arbitrary depth buildable later without canvases-inside-canvases.

- **Nested-canvas architecture (Erik's compounding concern + mitigation, see Q2):** recursion in DATA must not become recursion in RENDERING. Candidate rule: **one level per surface** — each open nest card renders exactly one flat mini-graph of its direct children; a child that is itself a nest renders as a closed nest bead inside that graph; drilling deeper opens another card surface (or repoints the same one, Inspector-style, with breadcrumb back-navigation). Depth in the world = number of open surfaces (in practice 1–2), never canvases-inside-canvases-inside-canvases. With that rule, the implementation question reduces to: render the mini-graph with (a) a second React Flow instance inside the card vs (b) a small bespoke bead-graph renderer reusing edgeRouting.js. Q2 prototypes whichever probe is riskier after the homework; scoped state (one shared `useCanvasUiStore` singleton today) is a known collision point either way.

---

### Review log

- **2026-06-12, round 1 (Erik, with ChatGPT review).** B reframed from "suspect" to legitimate progressive disclosure; good-hiding/bad-hiding distinction adopted. Tags/filters wording corrected (eliminated for this problem, not retired from product). Old I2 ("nothing gets rearranged") split into T2 (nothing unintentionally obscured) + T3 (spatial memory + restore-on-close), with the resolution mechanism moved to candidate C2. Old I4 strengthened to T5 (one line per visible pair — extends shipped invariant). Old I6 ("parent stays a normal card") replaced by candidate C1 (Erik's nest-section vision) — flagged as a possible mental-model fork (O7). Old I7/I8 recategorized: tree-shaped membership + intended recursion are product truth (T7); one-level-only is spike constraint (S1). Old I9 weakened to concept-independence (T8); leader rendering opened up, with visual differentiation noted as likely P3-required. Terminology corrected throughout: nodes with display states (bead / card / nest), never "cards contain cards."
