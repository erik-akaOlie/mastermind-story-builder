# Discovery: Grouping / "Nests" — Problem Definition

**Date:** 2026-06-11
**Participants:** Erik (founder/designer), Claude (discovery facilitation), ChatGPT (outside review), Chris (tester, relayed feedback)
**Status:** Discovery CLOSED (2026-06-12). Problem validated in full; "nesting as a capability of cards" adopted as the **leading hypothesis** — not a proven solution — entering a design/architecture spike. See Outcome section.
**Next artifact:** the spike; then an ADR committing (or revising) the direction.

---

## Why this discovery exists

The roadmap lists a **Nest component** ("FigJam-section-style containers grouping cards / connections / text into thematic units. Recursive. Move-the-nest-moves-the-contents."). That entry presumes a solution. Nests as roadmapped are the largest, riskiest item on the board (~L–XL: React Flow parent/child, marquee, z-index, bead morph, edge geometry, persistence, realtime, undo). This discovery session was gated in front of any design or build, with explicit permission to conclude that Nesting is the wrong solution.

## Evidence base

- **Erik's campaign (~70 cards).** Clusters ("constellations") emerge organically as the graph grows — mostly location-based (Village of Barovia, Death House, Vallaki), sometimes character-centered. Graph maintenance is largely repositioning whole constellations relative to each other to make room for growth, including moving *several constellations at once* (e.g., "everything in the top quarter moves up"). Today's tool is marquee select: it mostly works; occasional mis-grabs when constellations sit close together. Cost today: low.
- **Erik's strongest signal** (verbatim): *"I don't find myself thinking 'this is too much' but I do think 'these groupings could be represented more intentionally and clearer.'"*
- **Chris (1 of 2 testers).** Repeatedly asks to collapse a collection of nodes into a single node. On record from his 2026-05-27 usability session ([usability-findings.md](./usability-findings.md)): *"As the number of cards grows, organizing them visually gets hard; wants to collapse a group of notes/cards into a single block."* His underlying goal, as he explained it to Erik: control over the level of complexity displayed — a simplified campaign-wide view showing only the major structures, selective drill-down into a grouping, and fast switching between those perspectives. Secondary value he named: a high-level view communicates which parts of the world are developed deeply vs. thinly. His same-session positive signal — *"organizing visually helps him spot holes in the plan"* — directly supports the north star below.
- **Scale context.** Both real campaigns are ~70 cards. All three needs below intensify with scale; part of this work is a deliberate bet on 300+-card campaigns. We are choosing to know that, not discover it later.

## Root problem

> Meaningful structure — towns, families, factions, story arcs — exists in the user's head and is hinted at by where cards sit on the canvas, but **the system has no knowledge that these groupings exist**. So it cannot show them clearly, cannot summarize the map by them, and cannot move them as units.

Card View and Bead View change how each node *renders*; they never reduce how many objects are on screen. 70 cards are always 70 visible things. There is no level of abstraction between "every node" and "every node as dots."

## Three user needs (one root, two layers)

| # | Need | Whose | Severity today |
|---|------|-------|----------------|
| P1 | **Move constellations as units** — reposition one or more constellations without re-selecting members each time | Erik | Low (marquee is ~80% sufficient) |
| P2 | **View the campaign at multiple levels of abstraction** — shift between campaign-wide structure and area detail, fast | Chris | Unknown-but-repeated; scale-dependent |
| P3 | **Represent emergent structure intentionally** — the groupings the user already sees in their head are visible *as groupings* on the canvas | Erik | Present at 70 cards |

**Dependency:** P2 and P1 both require the system to know what the groups are — which is P3. Representation is the foundation; abstraction control is the payoff; group movement falls out almost for free. These are not competing problems.

## Success criteria

- **P1:** reposition one or more constellations with effort comparable to moving a single card — no repeated member re-selection.
- **P2:** Chris can shift between campaign-wide and area-detail understanding in ~5 seconds, with both per-group control and whole-map control.
- **P3:** a newcomer could look at the canvas and name its major formations without anyone explaining them.
- **North star (product outcome, not an acceptance test):** reorganizing and re-viewing the graph surfaces gaps and opportunities the user hadn't seen — the product's one-liner.

## Findings that constrain the solution phase

1. **Multi-constellation moves are routine.** Whatever ships must make selecting and moving *several* groups at once effortless.
2. **Marquee-clips-a-group needs a defined rule.** Erik never intends to slice through a group, but a selection rectangle doesn't know that. Not a core workflow concern — but the interaction needs one clear answer.
3. **Both state and lens.** Opening/closing an individual grouping should persist (state); an open-all/close-all toggle behaves like a quick lens. Users want both. Their interaction (toggle all → open one → toggle back) is a solution-phase question. Chris's own instinct here is an open thread.
4. **No evidenced need for multi-membership.** A card belonging to two groups at once: possible in theory, no concrete example found. Erik would move a card between groups rather than dual-home it. Moving a card between groups must be drag-simple.
5. **Group-to-group connections must stay visible.** When groupings are summarized, a connection between a node inside group A and a node inside group B should still read as a relationship between A and B; opening the groups reveals which nodes participate. Erik expects this to be a very common scenario.
6. **Hierarchy is plausible but unproven.** Erik can imagine groupings inside groupings (Village of Barovia ⊃ Death House ⊃ Durst family). Treat as a future direction to not paint out of, not a v1 requirement.
7. **Iteration cost is asymmetric.** "Build fast, test, iterate" holds only while the shipped thing is cheap to change. A grouping model touches stored data, undo, realtime, and users' mental models — v1 should be the smallest slice that tests the riskiest assumption.
8. **Tenet alignment.** P2 is a direct expression of tenet 2 (progressive disclosure); P3 supports tenet 3 (visible completeness); any solution is judged against tenet 5 (views stay flexible) and tenet 9 (no genre-specific assumptions — grouping principles vary by campaign: location, faction, character).

## Parked solution sketches (recorded, deliberately NOT evaluated yet)

- FigJam-style section box: draw a region; nodes inside become members; moves as a unit. (Erik)
- Group-with-parent-card: select nodes, group them, designate an existing card (e.g., Death House) as the parent; the parent's Inspector also shows the member graph. (Erik)
- "Nest" as a third node state alongside card/bead. (Erik)
- Counter-marker: nesting as a *capability of any node* ("any card can optionally contain a child graph") rather than a node *type* — keeps what-it-is, how-it-renders, and what-it-contains as separate layers. (ChatGPT; consistent with Erik's earlier "still technically a node" instinct.)

## Candidate solution space for the evaluation phase

Derived from the root problem — this list is a starting point, not the boundary: nests-as-containers (roadmap version), any-card-contains-a-graph, visual-only frames/regions (representation without containment semantics), tags/filters, "member of" relationship metadata, altitude-based clustering (extending ADR-0010's existing mechanism), inferred semantic structures (the system derives groups from connection patterns rather than the user authoring them — added 2026-06-12 per ChatGPT review), spatial convention alone (status quo). Candidates are scored against the three needs, the success criteria, the constraints above, and Erik's reshape-the-whole-map workflow.

## What is a group? (taxonomy, added 2026-06-12)

ChatGPT's review surfaced that "group" was covering at least four different things. Naming them exposed a structural split:

| Kind | Example | Face is… | Membership | Spatial? |
|---|---|---|---|---|
| Location hierarchy | Village of Barovia ⊃ Death House | a **location** card | exclusive | yes |
| Organizational | Order of the Silver Dragon ⊃ members | a **faction** card | exclusive | yes |
| Narrative | Winery storyline ⊃ people/places/events | a **story** card | exclusive | mostly |
| Working set | "Session 5 prep," "Important NPCs," "Player theories" | *no world entity* | **overlapping** | **no** — members stay scattered across the world |

The first three are **world structure**: a card lives in one place, the grouping is part of the world itself, and the face maps directly onto MasterMind's built-in card types (location, faction, story, character — the type system was designed around exactly these organizing principles). These are what P1/P2/P3 and every recorded constraint describe.

The fourth is a **working set**: temporary, cross-cutting, multi-membership by nature (Ireena belongs to "Session 5 prep" *and* lives in the Village of Barovia). Forcing a working set into ANY spatial containment model — section box or parent card alike — would require dragging scattered cards out of their world positions, destroying the layout the user built. Working sets are a different feature (cross-cutting highlight/filter/recall — where tags/filters re-enter as the natural mechanism), not a variant of this one. Discovery finding #4 (no evidenced need for multi-membership) was true precisely because the interview evidence was all world-structure groups.

**Scope consequence:** the grouping feature under evaluation models *world structure only*. Working sets are explicitly out of scope, recorded here so the boundary is a decision rather than an accident.

**Resolved (Erik, 2026-06-12):** what looked like "session prep" usage is actually *world-building ahead of the session* — Chris fleshes out the parts of the world players will engage with next. Node position is determined by the world's shape, never by session planning; prep decisions are *derived from looking at* the graph, not expressed by reorganizing it. **No working-set behavior is observed today.** The scope boundary above is clean, not precautionary.

This resolution exposed three distinct activities, of which only the first creates structure on the canvas:

1. **Building the world** — creating/positioning cards; where constellations emerge; where this grouping feature lives.
2. **Understanding the world** — noticing gaps, thin regions, unconnected arcs. The graph generates these insights itself (a core value proposition); no temporary structures are authored to get them.
3. **Preparing a session** — decisions (what needs fleshing out, which NPCs need voices) derived from activity 2, recorded elsewhere, not expressed spatially.

## Outcome (discovery closed 2026-06-12)

**Verdict on the roadmap's Nest entry: the problem space survives; the solution enters the spike as a hypothesis, reshaped.** Discovery did not select a solution — it selected the most promising hypothesis for the spike to try to break. That hypothesis: not a new container object (FigJam-style section) but **nesting as a capability of cards** — any card can optionally contain a child graph; the parent card is the group's face; collapse/expand is how abstraction control (P2) happens. Scoped to **world structure only**; working sets are out of scope (see taxonomy). Erik accepted it as the leading hypothesis on 2026-06-12: *"I do not consider the capability model proven, but I do consider it the leading hypothesis worth investigating."*

**Eliminated:** status quo (fails P2/P3), tags/filters as primary (hides, doesn't summarize; future complement for working sets), "member of" metadata alone (records but doesn't show — metadata without a consumer), automatic altitude clustering and inferred semantic structures (not *intentional*; unstable under growth; organizing principle is a user choice topology can't reveal — inference may return as an opt-in V2 suggestion layer per tenet 8), visual-frames-first as a stepping stone (teaches "group = region" immediately before a "group = card" model — mental-model collision), nest-as-new-container-object (duplicates what cards already are; second code path through every system).

**Erik's draw-a-box idea is retained** as a possible *creation gesture* on top of the capability model, not lost with the container model.

### Spike charter

The spike (timeboxed design/architecture investigation, no production code, future session) treats the capability model as a hypothesis to validate **or invalidate**. It must clear two bars:

1. **Technical feasibility** — expanded-group representation on canvas; member-connection re-routing on collapse; React Flow parent/child viability vs. fighting the framework; the marquee-clips-a-group rule; persistence/undo/realtime story; behavior at both altitudes (card and bead).
2. **Experience improvement (Erik, 2026-06-12):** the resulting experience must produce a *meaningful improvement in understanding, navigation, or graph maintenance compared to the current graph*. Technical feasibility alone is insufficient to proceed.

**Kill conditions (pre-committed, to guard against confirmation bias):**

1. **Containment confusion** — if mockup/prototype reactions show people can't predict what collapsing a parent card will do, the parent-card concept fails its core promise.
2. **Edge unreadability** — if re-routing member connections to a collapsed parent produces ambiguity or visual noise worse than the current map, P2's payoff is negative.
3. **Framework resistance** — if React Flow can't support collapse/expand without breaking edge geometry, marquee, or the altitude morph, the implementation route changes; if every route is prohibitively expensive, the model goes back on the table against the container and frames candidates.
4. **Hierarchy regret** — if one containment level works but recursion (Barovia ⊃ Death House ⊃ Dursts) creates navigation problems, ship one level and explicitly defer recursion.
5. **Value dilution** — if the capability model does not produce a meaningful improvement in understanding, navigation, or graph maintenance beyond what users already achieve with current card/bead behavior and spatial convention, the spike recommends against proceeding — regardless of technical feasibility. (This is bar 2 restated as an explicit failure condition, not merely a success aspiration.)

**After the spike:** ADR committing or revising the direction, then a phased build whose first slice tests the riskiest remaining assumption.

## Closed threads

- Chris's concrete collapse episode and his state-vs-lens instinct in his own words: **not pursued.** Per Erik (2026-06-11), no further input from Chris is expected before this work moves forward. The recorded 2026-05-27 usability finding is the evidence of record; the solution evaluation proceeds on it.
