# Usability findings

Running log of observations from MasterMind usability sessions. The point is to **spot patterns across multiple participants before reacting** — one-off reactions to single-participant feedback are deliberately deferred until a signal repeats.

## Categories

- **Monitor** — single-participant observation. Watch for repeat signals before any work; if it doesn't repeat after a few more participants, close as "no repeat."
- **Quick Win** — discoverability or polish issue with a clear fix. Promoted to [`BACKLOG.md`](../../BACKLOG.md) (or actioned directly if the fix is small enough to land in the same session as the finding).
- **Design Question** — needs a UX decision before any work can start. Lives here until the decision is made; once made, it either becomes a Quick Win or is closed.

## Status values

`Open` · `Watching` · `Promoted to BACKLOG` · `In Progress` · `Resolved` · `Closed (no repeat)`

## Promotion rule

A **Monitor** observation graduates to **Quick Win** or **Design Question** once the same observation appears from a *second independent participant*. Until then, it stays in `Watching` and we don't change the product.

---

## Observations

| Date | Participant | Observation | Category | Status |
|---|---|---|---|---|
| 2026-05-19 | Todd Agnello (game designer) | When a card was selected and the non-selected nodes faded into the background, the effect felt too strong — described as "everything goes black" and distracting. | Quick Win | Resolved (2026-05-30 — repeated by a second participant, Chris Fedak (2026-05-27); selection dim softened from 15% to 45% opacity in `CampaignNode.jsx` so unselected cards recede but stay legible) |
| 2026-05-19 | Todd Agnello (game designer) | The connection lines on the canvas felt messy, overwhelming, and distracting in aggregate. | Monitor | Watching |
| 2026-05-19 | Todd Agnello (game designer) | Tried to pan the canvas using two-finger trackpad swipe and arrow keys; neither worked. Spacebar+drag was the only built-in pan and was not discovered. Once explained, the spacebar interaction felt right — issue is discoverability + missing input methods, not the interaction itself. | Quick Win | In Progress (2026-05-22 — adding trackpad two-finger pan + arrow-key navigation, FigJam-style) |
| 2026-05-19 | Todd Agnello (game designer) | Even after trackpad and arrow keys are added, the spacebar+drag pan affordance has no visible signifier. Some users won't think to try modifier-key interactions at all. What's the right discoverability cue — cursor change on canvas hover, in-canvas microcopy, first-run tip, something else? | Design Question | Open |
| 2026-05-19 | Todd Agnello (game designer) | Did not add a thumbnail image to any card during the session. The affordance to do so was not visible. | Quick Win | Resolved (2026-05-22 — pencil edit icon in the Inspector header; always visible when no thumbnail, hover-only when thumbnail present) |
| 2026-05-27 | Christopher Fedak (DM) | Focus-vs-dim on selection felt too extreme — dimming the non-focused cards made moving around the map annoying. | Quick Win | Resolved (second independent signal for the 2026-05-19 dimming finding; selection dim softened 15%→45% on 2026-05-30, `CampaignNode.jsx`) |
| 2026-05-27 | Christopher Fedak (DM) | While editing a card, the centered editor covered the map; wanted the card docked to one side with the map still visible on the other, to stop clicking back and forth. | Quick Win | Resolved (drove the float-or-dock Inspector — docked mode keeps the map visible; shipped 2026-05-30, [ADR-0015](../decisions/0015-float-or-dock-inspector.md)) |
| 2026-05-27 | Christopher Fedak (DM) | Zoom-to-cursor felt right, but having to hold Ctrl while scrolling to zoom felt strange; he rarely wants to deliberately zoom in/out. | Monitor | Watching |
| 2026-05-27 | Christopher Fedak (DM) | Didn't use DM Notes or Hidden Lore (both sit below the fold in the editor; while writing he stays with what's at the top), and didn't add pictures. | Monitor | Watching |
| 2026-05-27 | Christopher Fedak (DM) | As the number of cards grows, organizing them visually gets hard; wants to collapse a group of notes/cards into a single block. | Monitor | Watching (aligns with the planned **Nest** feature — BACKLOG.md / glossary) |
| 2026-05-27 | Christopher Fedak (DM) | Making a connection requires clicking into a card and choosing one; wants to create links directly from the canvas. Also wants right-click "Add card" to optionally create the new card already connected to the one he started from (currently ~3 steps to associate). | Monitor | Watching (aligns with the designed-not-built canvas-drag connections — design-system §5.4) |

### Positive signals (Chris Fedak, 2026-05-27)

Recorded because they validate current direction, not just to flag problems:

- The summary + short story-notes box is a good **creative prompt** — it nudges him to add key details.
- Organizing visually helps him **spot holes in the plan**.
- The **color + symbol coding** for card types anchors him on the page quickly.
- Right-click **"create card"** is his main go-to.
- Overall: "useful and focused."
