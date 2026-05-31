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
| 2026-05-19 | Todd Agnello (game designer) | When a card was selected and the non-selected nodes faded into the background, the effect felt too strong — described as "everything goes black" and distracting. | Quick Win | Resolved (2026-05-30 — repeated by a second participant; selection dim softened from 15% to 45% opacity in `CampaignNode.jsx` so unselected cards recede but stay legible) |
| 2026-05-19 | Todd Agnello (game designer) | The connection lines on the canvas felt messy, overwhelming, and distracting in aggregate. | Monitor | Watching |
| 2026-05-19 | Todd Agnello (game designer) | Tried to pan the canvas using two-finger trackpad swipe and arrow keys; neither worked. Spacebar+drag was the only built-in pan and was not discovered. Once explained, the spacebar interaction felt right — issue is discoverability + missing input methods, not the interaction itself. | Quick Win | In Progress (2026-05-22 — adding trackpad two-finger pan + arrow-key navigation, FigJam-style) |
| 2026-05-19 | Todd Agnello (game designer) | Even after trackpad and arrow keys are added, the spacebar+drag pan affordance has no visible signifier. Some users won't think to try modifier-key interactions at all. What's the right discoverability cue — cursor change on canvas hover, in-canvas microcopy, first-run tip, something else? | Design Question | Open |
| 2026-05-19 | Todd Agnello (game designer) | Did not add a thumbnail image to any card during the session. The affordance to do so was not visible. | Quick Win | Resolved (2026-05-22 — pencil edit icon in the Inspector header; always visible when no thumbnail, hover-only when thumbnail present) |
