# ADR-0010: Zoom-to-node-view — progressive disclosure via card↔circle morph at altitude
Date: 2026-05-11
Status: Accepted (V1 ships second in the current sprint, before tester invites; V2 ships during the first observation cycle)

## Context

The current canvas zoom-out limit caps below the threshold needed to
see a meaningful slice of any real campaign at once. From the
2026-05-11 planning conversation, Erik flagged this as **critical
daily friction**, blocking three specific high-frequency behaviors:

- **Demos.** Erik cannot comfortably demo MasterMind to a prospective
  tester or collaborator. The campaign visualization breaks down at
  the moment that should be most compelling — the "look at the whole
  world" moment.
- **Structural assessment.** While working on a campaign, Erik can't
  zoom out far enough to look at the campaign as a whole and assess
  progress. He's making decisions about a system he can't see.
- **Spatial placement.** When dropping a new card, Erik wants to see
  the surrounding structural context to decide where the new node
  belongs. The current zoom limit forces blind placement.

These are the same behaviors that the product's central promise rests
on — *"the campaign stops feeling like scattered notes and starts
feeling like a living world"* (from
[`docs/product/vision.md`](../product/vision.md)). Without an altitude
view, that promise has no surface.

Tester invites are scheduled for the next two weeks (see
[ADR-0009](./0009-behavioral-analytics-session-replay.md)). Shipping
the zoom feature alongside analytics matters for three reasons:

1. **Tester first impressions depend on the demo working.** A
   wounded zoom undercuts recruitment.
2. **Session replay budget shouldn't be spent watching testers stub
   their toes on known friction.** That's wasted research signal.
3. **At scale, the friction generalizes.** Tester campaigns won't
   grow as large as Erik's in the short term, but the structural
   problem is the same one Erik already lives in.

### Scope of the claim this ADR is making

This ADR commits to **one specific altitude visualization**: cards
morph into circular nodes below a zoom threshold, with full graph
structure (connections) preserved. It does *not* claim that node view
is the *only* answer to campaign-scale comprehension. Other altitude
visualizations — minimaps, semantic clustering overlays, filter-driven
views, focus+context lenses, temporal/story-arc views — remain valid
future directions and should be considered as the product matures.

The architecture is built to support multiple altitude-aware
visualizations stacking on top of the same threshold/state-change
machinery. This is a deliberate hedge against the natural tendency
for the first-shipped solution to psychologically lock the product
into "the only solution."

### What this is, mental-model-wise

This is a **progressive disclosure** pattern, applied to a spatial
canvas instead of a list or form:

- At normal zoom and zoomed in, cards render in full — title, type
  band, summary, body bullets, thumbnail. The interface is dense and
  detail-rich because the user is working at the level of individual
  cards.
- Below a defined zoom threshold, cards morph into circles. Each
  circle shows the card's thumbnail (or the type icon, as fallback)
  inside a type-colored border. Connection lines remain visible
  between circles. Text annotations remain at their normal size as
  regional labels. The interface is sparse and structural because
  the user is working at the level of the campaign.

The card↔circle transition is the visual mechanism that operationalizes
the disclosure.

## Decision

Build a **threshold-triggered card↔circle morph** with three
intentional fidelity reductions in V1 and a v2 perf-optimization
follow-up.

### Morph machinery

The same morph runs in response to two triggers:

1. **Zoom direction crossing the global threshold.** Every visible
   card morphs to its node-state equivalent (or back).
2. **Per-node hover or single-selection state changing.** Below the
   threshold, hovering or single-selecting a circle morphs *that one
   card* back to its full card form. Leaving the hover, or
   deselecting, morphs it back to a circle.

The two trigger paths share the same animation primitive. A node's
"shape mode" at any moment is one of: `card`, `circle`,
`morphing-to-card`, `morphing-to-circle`. The state machine resolves
the union of global zoom state and per-node hover/select state.

**Animation timing.** Morph duration ~200ms. CSS-driven for the
geometric parts (corner-radius, width, height). Content cross-fade
synced to the same timer. The animation is **interruptible and
reversible from current visual state**: if a user is mid-morph and
reverses zoom direction (or moves the mouse away from a hover-expanded
card), the reverse morph starts from the current frame, not from the
fully-completed end state. CSS transitions handle this natively for
geometry; the connection-line endpoints and content opacity inherit
the same interruption behavior by tracking the rendered shape's
measured position frame-by-frame.

### Visual spec — circle state

- Circular shape, type-colored border (same color used on the card's
  type band).
- Card thumbnail centered inside the circle when present.
- **No-thumbnail fallback:** the card type's Phosphor icon, centered,
  in the type color or contrast color (luminance-computed). No
  initial-letter overlay in V1 (deferred — type icon was the call
  Erik confirmed; revisit if observation shows it's not
  discriminating enough at small sizes).
- The colored border carries the type signal; the interior carries
  identity (thumbnail) or type-as-fallback (icon). The two roles are
  intentionally distinct.

### Connection lines

- Connection lines **stay rendered** below the threshold — they are
  the entire point of altitude view (the graph structure).
- **During the morph:** lines **fade out** during the first half of
  the morph and **fade back in** the moment the new shape is locked.
  This is the V1 fidelity reduction in place of smoothly
  interpolating each line's anchor points along the morphing border.
  Visually crisp; computationally cheap.
- **In V2 or later:** if observation shows the line-fade reads as
  abrupt, the connection-anchor interpolation can be revisited
  without changing any other part of the morph.

### Text annotations

Text annotations **stay zoom-stable** — they neither shrink with the
canvas nor collapse at the threshold. They function as regional labels
(*"the politics of Barovia"*, *"act 2 plot points"*), and at altitude
they become more useful as orientation anchors, not less. This
matches established practice in map design and diagramming tools.

### Hover-expand to readable card

This is the design move that **eliminates the tooltip entirely** and
also resolves the selection-visual question.

When a circle is **hovered** or **single-selected** below the
threshold, it expands back into a full card. The expanded card:

- Renders at **normal, readable card size — decoupled from canvas
  zoom.** At 20% canvas zoom, the expanded card still renders at its
  full readable size, not at 20%. The card visually leaves the
  canvas's spatial fabric while expanded.
- Carries all content the card has at normal zoom — title, type band,
  summary, body bullets, thumbnail.
- Anchors at the circle's canvas position with `z-index` above
  neighboring circles. Overlap is acceptable transient behavior; the
  user is actively interacting with this one card.
- Returns to circle form the moment hover ends or selection is
  cleared.

**This establishes a deliberate UX precedent:** hovered or selected
elements *may break out of canvas zoom rules in order to remain
readable.* The rule is contained to this interaction for now; it
should be applied judiciously elsewhere.

### Multi-select uses highlight, not expansion

Single hover or single select → expand. **Multi-select (shift-click,
marquee) → highlight all selected circles using the same
opacity/scale/shadow treatment that multi-selected cards get today.**
Expanding 50 marquee-selected circles at altitude would produce
overlap chaos and lose the bird's-eye context the user just made.

The underlying rule: *one selected thing → expand it (you want to
read it); many selected things → highlight them as a group (you're
operating on the set).*

### Drag, right-click, click-to-edit work identically to card view

Mouse interactions are unchanged. A circle accepts drag-to-reposition,
right-click → context menu, and click → open Edit modal, exactly the
way a card does today. The visual layer changed; the interaction
layer did not. Hover triggers the expand morph; the expanded card is
the active surface for any subsequent interaction.

### V1 fidelity reductions — captured deliberately

The V1 build takes three reductions off the "ideal" implementation,
in service of shipping before tester invites. Each is reversible
later without rearchitecting:

| Reduction | What V1 does | What "ideal" would do | Cost saved |
|---|---|---|---|
| Connection lines during morph | Fade out + fade back in synced to morph timer | Anchors interpolate along the morphing border, lines visually stay attached throughout | ~1.5 days |
| Hover affordance | Hover-expand (whole card returns) | Separately-designed tooltip with type-colored background + accessibility-tuned text | Eliminates a separate component entirely; net ~0 vs. a polished tooltip but removes a design surface |
| Selection visuals on circles | Inherit card lifted-state styling on the circular shape | Bespoke circle-specific selection effects (custom glow, halo, scale, etc.) | ~0.5 day |

Net V1 estimate after these reductions: **7–10 days** (the
upper-honest range, not the optimistic one).

### V2 — performance optimization for 500+ cards

V2 follows V1 by ~1 week, after tester invites have gone out. V2
adds:

- **Viewport culling.** Only render circles whose canvas position
  intersects the visible viewport, with a small margin so circles
  pop in before they slide on-screen.
- **Connection-line culling.** Hide connection lines whose on-screen
  length is below a pixel threshold (a 2-pixel line is visual noise,
  not signal), and hide lines whose both endpoints are off-viewport.
- **Selector memoization.** Per-node hover/select subscriptions to
  `useCanvasUiStore` are already narrow; verify with React DevTools
  profiler under load that no card re-renders more than the strict
  minimum during a hover or drag burst.

**Fidelity targets for "comfortably supports 500 cards":**

- Cold page load: < 3 seconds
- Drag responsiveness: stays at 60 frames per second
- Hover-state transition: visually instantaneous
- Morph animation: smooth at any zoom

Headroom to 1000 cards is the stretch goal but not the V2 commitment.

### Architecture — built as one altitude view among many

The morph state machine is implemented as a **canvas-level rendering
mode**, not as a property of the card component. A card subscribes
to the global "shape mode" (driven by zoom threshold) and to its own
per-node hover/select state, then renders accordingly.

Future altitude visualizations — minimap, semantic clustering
overlay, filter-driven view, focus+context lens — should plug into
the same threshold/state-change machinery rather than reinventing
altitude awareness. This is the architectural hedge against treating
node view as "the answer" rather than "a hypothesis we shipped first."

## Consequences

**Benefits.**

- **Removes the daily friction blocker that surfaced this work.** Erik
  can demo, assess structural progress, and place new cards with
  surrounding context visible — all the workflows the current zoom
  cap blocks.
- **Aligns with the product's central promise.** "Feels like a living
  world" only works if the user can see the world.
- **Hover-expand cuts a component.** No tooltip subsystem, no tooltip
  styling, no tooltip positioning logic. One less interaction surface
  to maintain, one less component to design accessibility for.
- **Sets a clean precedent for altitude-aware rendering.** The state
  machine is the reusable piece; the node-view rendering is the
  first consumer. Other altitude views drop in without rebuilding
  the foundation.
- **V1 / V2 split protects invite timing.** V1 is unblocking; V2 is
  scaling. Splitting them means invites aren't held hostage to perf
  work that doesn't pay off until tester campaigns grow.

**Trade-offs accepted.**

- **Expanded cards break out of canvas zoom rules.** This is a real
  UX precedent. It's the right call for *readable preview at
  altitude*, but it should be applied judiciously — not every hovered
  thing should leap out of canvas space.
- **The "fade lines during morph" reduction is visible.** A user
  watching the animation closely will see lines blink out and back
  in. Erik approved this consciously; it's reversible later if
  observation shows it bothers people.
- **Node view is being shipped before the campaign-scale
  comprehension problem has been validated with non-Erik users.**
  This is a conscious bet: Erik's daily friction is strong enough
  evidence to act on, and shipping the fix actually *unblocks* the
  validation rather than preempting it (testers can't surface
  large-campaign friction if they can't see large campaigns).
- **V1 will degrade as tester campaigns grow.** Mitigation: V2 ships
  during the first observation cycle, well before any tester campaign
  hits ~200 cards. Worst case, the very-heaviest current user (Erik)
  experiences degradation in his own campaign during the V1→V2 gap.
- **Estimate is the riskiest in the current sprint.** Connection lines
  following a morphing shape — even in the simplified fade-during-morph
  V1 — is engineering Erik and Claude haven't done before in this
  codebase. 7–10 days is the honest range; if it stretches past day 10,
  we re-scope at that point rather than push invites further.

**When to revisit.**

- After the first observation cycle (4–6 weeks of tester usage),
  review whether node view actually delivers structural comprehension
  for non-Erik users, or whether other altitude visualizations
  (minimap, clustering, filter view) should be added or substituted.
- If observation surfaces fresh friction at the threshold transition
  itself (e.g., "I keep losing track of where I am during the
  morph"), revisit the line-fade reduction and the threshold value.
- If the hover-expand pattern proves valuable beyond node view,
  consider promoting it to a general "preview without committing to
  zoom" interaction available at all zoom levels.

**Open questions left for implementation.**

- **Positioning of an expanded card at deep zoom.** If the
  underlying circle is near the viewport edge, the expanded card may
  extend off-screen. V1 default: anchor at the circle's canvas
  position; clamp to the viewport so the card slides into the
  visible region rather than clipping. Revisit if it reads oddly.
- **Threshold value.** The exact zoom level X at which the morph
  triggers will be tuned during implementation. Erik's current
  zoom-out limit is the starting candidate.
- **Connection point repositioning on the circular perimeter.** The
  existing `getSpreadBorderPoints` logic was designed for rectangular
  card edges. The circular analog is spreading points around the
  circumference; the math is simpler. Captured for implementation,
  not blocking the decision.

## Addendum — 2026-05-12 (refined decisions)

This addendum captures decisions made in the 2026-05-12 design session
that resolve items in "Open questions left for implementation" and add
implementation-level specifics. The original body above is unchanged;
where the two differ in vocabulary, this addendum is authoritative.

### Vocabulary

- **Node** — the umbrella term. Every connectable element on the canvas
  is a node, regardless of its current visual form.
- **Card** — the expanded rectangular form of a node.
- **Bead** — the collapsed circular form a node takes below the morph
  threshold.
- **Card View** / **Bead View** — the canvas modes corresponding to each
  form, named by what they show rather than by zoom altitude.

Where the original ADR body says "circle," read "bead." Future ADRs and
code should prefer "bead."

### Unit and threshold

The morph threshold is expressed in **millimeters of on-screen distance
between adjacent dots on the canvas's background grid**. Rationale:

- The grid is a canvas-level invariant — React Flow's `<Background />`
  default `gap = 20` canvas units. Its spacing is independent of card
  content, card width, avatar presence, title line count, or any other
  per-card variable. (Earlier candidates — title text size, body text
  size, card width, avatar size — all fail invariance because they
  depend on card content or per-card layout decisions.)
- Millimeters are physically grounded and survive any future change to
  React Flow's zoom mapping or grid defaults.
- Per the web spec, 1 CSS pixel ≈ 1/96 inch, giving a reliable
  conversion from canvas units → CSS px → mm at runtime.

**Constants:**

| Constant | Value | Meaning |
|---|---|---|
| `MORPH_BELOW_GRID_GAP_MM` | `2.65` | Bead View triggers when grid dots are below 2.65mm apart on screen. Maps to React Flow zoom ≈ 0.5 with the default 20-unit grid gap, matching the current `minZoom` so the morph activates exactly at the old zoom-out wall. |
| `MORPH_HYSTERESIS_RATIO` | `1.15` | Card View returns at 1.15× the bead threshold (~3.05mm dot spacing, zoom ≈ 0.575). 15% spread is the documented safe value against trackpad-pinch wobble; widen if observation surfaces flicker, narrow if return-to-cards feels sluggish. |

Both constants are tunables. Change them, observe, iterate.

### Connection points on the bead perimeter

Connection points distribute **by angle to the connected card** (the
direction from the bead's center toward the other node), with a minimum
arc-distance between adjacent points to prevent visual overlap.

| Constant | Value | Meaning |
|---|---|---|
| `MIN_CIRCLE_POINT_GAP_PX` | `4` | Minimum on-screen arc-distance between adjacent connection points on a bead. Tunable. |

The circular analog of `getSpreadBorderPoints` / `getBorderIntersection`
lives next to those utilities in `src/utils/edgeRouting.js`. The
existing rectangular logic is retained for Card View; the routing path
branches on shape mode.

### Dynamic zoom-out limit

React Flow's static `minZoom = 0.5` is replaced by a **dynamic limit
that scales with the user's content**. At any moment, the user can zoom
out far enough that all canvas nodes (cards + text annotations + future
content types) fit within the center 70% of the viewport, with both
width and height constraints honored — whichever is binding determines
the limit.

| Constant | Value | Meaning |
|---|---|---|
| `BIRDS_EYE_VIEWPORT_FILL` | `0.7` | Fraction of viewport (each dimension) that the bounding box of all nodes fills at max zoom-out. |

- **Recompute timing.** On each *settled* change — node add, node
  delete, drag-stop, text-node resize-stop. Not during a drag or resize
  in progress. Cheap enough that the user never feels the recompute;
  accurate the moment they reach for the zoom-out edge.
- **Empty / single-node fallback.** When the bounding box is degenerate
  (zero or one nodes), fall back to React Flow's default `minZoom = 0.5`.
  New campaigns and very-sparse campaigns retain today's zoom behavior.

This design has an emergent property worth naming: few nodes → tight
bounding box → can't zoom out far → morph rarely triggers → user stays
in Card View. Many nodes spread out → wide bounding box → zoom-out
reaches the morph threshold → Bead View activates when structural
overview is actually useful. The two features cooperate without
explicit coordination.

### Accessibility

The 200ms morph animation honors the OS-level
`prefers-reduced-motion: reduce` media query. When set, the morph is an
instant swap — geometry, content cross-fade, and connection-line fade
all collapse to a single frame.

### Cross-device assumption

The mm threshold is calibrated against Erik's primary monitor.
Cross-monitor variation within ±20% is expected in practice and is
acceptable for V1 tuning. **Device-class multipliers** for tablet and
phone are deferred to V3 (mobile/tablet builds per
[`docs/product/roadmap.md`](../product/roadmap.md)). When those builds
ship, the threshold gets a per-class multiplier applied to
`MORPH_BELOW_GRID_GAP_MM`.

### Resolved open questions

- **Threshold value** — resolved above (`MORPH_BELOW_GRID_GAP_MM = 2.65`).
- **Connection point repositioning on the circular perimeter** —
  resolved above (by-angle distribution + 4 px minimum arc-distance).
- **Positioning of an expanded card at deep zoom** — *still open.* V1
  default per the original ADR: anchor at the bead's canvas position;
  clamp to the viewport so the expanded card slides into view rather
  than clipping at the edge. Implement and observe.

### Altitude rail UI (2026-05-15)

The altitude axis gets a dedicated user-facing instrument on the left
edge of the canvas — the **altitude rail**
([`src/components/AltitudeRail.jsx`](../../src/components/AltitudeRail.jsx)).
It's the first concrete altitude visualization shipped under the
"altitude view among many" architecture outlined above (line 229 of
this ADR). The rail has two roles:

1. **Read.** Show the user where they are on the zoom spectrum and
   which side of the threshold they're on, without making them poke at
   the canvas to find out.
2. **Write.** Let the user retune the threshold by dragging the
   slider's thumb, so a DM who wants beads earlier (or cards longer)
   can set their own boundary.

#### State machine

The rail has two visual states, driven by mouse position over the
rail's container and by drag-in-progress:

- **Rest** — narrow track tucked toward the canvas edge, icons / thumb
  / label hidden, current-zoom marker simplified to a single chevron
  at half stroke. Ambient, not demanding attention.
- **Active** — track widens, magnifying-glass icons fade in above and
  below, threshold thumb appears, "card view" label fades in, current-
  zoom marker becomes the full chevron-bar-chevron at full stroke.

Transition between states is a 220 ms CSS animation on every property
(width, position, opacity, stroke width, gradient width). A subtle
dark scrim sits behind the rail in both states, scaling wider in active
state so the expanded UI keeps strong contrast against canvas content;
the scrim is tinted to the canvas hue rather than pure black so it
darkens the underlying canvas without drifting toward neutral gray.

#### Threshold drag mechanics

The thumb is a pointer-captured drag handle. Its TOP edge tracks the
down-trigger zoom (Card→Bead boundary); its BOTTOM edge tracks the
up-trigger zoom (= down-trigger × `MORPH_HYSTERESIS_RATIO`). Dragging
the thumb writes a new `thresholdGridGapMm` value to the store via
`setThresholdGridGapMm`. App.jsx subscribes to that value and re-runs
the same `evaluateAltitude` logic the zoom-driven trigger uses — so a
drag that crosses the user's current zoom morphs the canvas in real
time, not on the next pan or zoom.

#### Hysteresis representation

The thumb's vertical extent IS the dead-band. Top = down-trigger,
bottom = up-trigger. When the current-zoom indicator sits inside the
thumb, the previous altitude is preserved; only when it exits ABOVE
does Card→Bead fire, and only when it exits BELOW does Bead→Card fire.
Thumb height stretches to fill the actual dead-band region on the rail
(varies with the rail's responsive height and `dynamicMinZoom`), min-
clamped at 28 px so the grips stay legible when the dead-band
fraction is tiny.

#### Highlight semantics

The Card-View highlight band has different behavior in each state, by
design:

- **Active.** Highlight top sits at the down-trigger position (= thumb
  top) and extends UP behind the thumb in both altitudes. Square top
  corners; the thumb visually tucks over them. The highlight here
  reads as "Card View region defined by the current threshold." The
  current-zoom indicator's position vs the thumb tells the user which
  side of the dead-band they're actually on.
- **Rest.** No thumb, no dead-band visual. The highlight has to
  reflect the actual altitude on its own, so its top edge tracks
  `altitude`: down-trigger position in Card View (highlight covers
  the dead-band region, indicator sits inside it), up-trigger position
  in Bead View (highlight is below the indicator). Fully rounded
  corners since there's no thumb to tuck under.

This dual behavior is deliberate: in active state the rail shows the
*threshold structure*; at rest it shows the *current state*. Crossing
from rest to active while in Bead View animates the highlight top by
one dead-band's worth — the visible price of representing two different
things cleanly with one element.

#### Container & hover detection

The 64 px rail container is `pointer-events: auto` so it captures
mouse-enter / mouse-leave reliably without making the user aim for a
4 px line. Trade-off: marquee-select can't be initiated in the
leftmost 64 px of the canvas. Acceptable for an edge-mounted nav
tool; the rail slides out of the way on mouse-leave so the
expectation of marquee-select is reasonably managed.

#### Bbox stability

`computeMinZoom` uses canonical card dimensions (256 × 180) for every
card-type node regardless of measured size, so a morph from card to
bead doesn't shrink the bounding box (which would otherwise move
`dynamicMinZoom`, which would otherwise scoot the threshold thumb up
and down the rail every time the user crossed the morph boundary).
Text nodes keep their measured dimensions since they're user-resizable
and don't morph.

## References

- BACKLOG entries: *Zoom-to-node-view v1* and *Zoom-to-node-view v2*
  (Foundational Progress) — the implementation work this ADR governs.
- BACKLOG entry: *Physics layout layer* (Exploration) — surfaced
  during this design conversation; deferred to its own product call.
- BACKLOG entry: *Onboarding + first-session scaffolding*
  (Foundational Progress) — the post-observation work this ADR's
  research enables.
- [ADR-0009: Behavioral analytics + session replay](./0009-behavioral-analytics-session-replay.md) —
  ships first in the current sprint; the friction signals captured
  there will inform whether node view actually solves the
  campaign-scale problem for non-Erik users.
- 2026-05-11 planning conversation between Erik and Claude (this
  ADR captures the decisions reached there, including the ChatGPT
  critique of the conversation that prompted the V1 fidelity
  reductions and the modular-architecture hedge).
- Related: `useCanvasUiStore` (`src/store/useCanvasUiStore.js`) — the
  existing per-node hover/select subscription store the V1
  hover-expand will route through.
- Related: `getSpreadBorderPoints` / `getBorderIntersection`
  (`src/utils/edgeRouting.js`) — the V1 morph will need a circular
  analog of the existing rectangular edge-routing math.
