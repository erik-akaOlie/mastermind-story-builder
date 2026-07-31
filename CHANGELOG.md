# Changelog

A running log of meaningful changes to MasterMind: Story Builder. Append-only. Newest at top.

## [Unreleased]

### Connection hover: equal emphasis in Card View and Bead View (2026-07-31)

Hovering a connection line now creates the same meaningful emphasis
whichever way the canvas is currently showing your nodes. In Bead View
this already worked: both endpoints pop into readable cards, and an
off-screen endpoint is pulled into the window. Card View previously
gave only a faint nudge (a generic 3% hover lift — incidental styling,
never a designed rule) and left off-screen endpoints off-screen. Now,
hovering a line in Card View grows both endpoint cards to the same
familiar highlighted-card size beads expand to; if you're zoomed in far
enough that a card already renders larger than that, it grows a modest
10% instead — highlighting never shrinks a card. Off-screen endpoints
are pulled into view exactly as in Bead View, everything restores when
the hover ends, and — unlike Bead View's read-only peeks — Card View
cards stay fully clickable while emphasized. Ordinary card hover,
selection, and search are unchanged; this applies to connection-line
hover only. The hover session also survives zooming across the
card/bead threshold mid-hover, re-deriving each endpoint's form
instead of cancelling. Known deferred polish (BACKLOG): when both
endpoints resolve into the same constrained viewport corner, the
incoming card can overlap the visible one — pair-aware placement is a
recorded follow-up.

### Fix: a deleted workspace can no longer masquerade as an empty one (2026-07-31)

The active workspace lives in the URL (`?w=…`), and a URL can outlive
its workspace — delete a workspace and press Back, reload a tab whose
workspace was deleted on another device, or follow a stale bookmark.
Before: that dead workspace opened as a perfectly normal-looking empty
canvas (loads filter by workspace and silently return nothing), and
every attempt to create content failed with a misleading connection
error. Now: when the app can definitively tell the workspace is
unavailable to you, it returns you to your library with a notice that
connects the outcome to what you just did — "The workspace you were
trying to reach is no longer available, so we've returned you to your
library" — shown in the error (red) banner treatment with a × to
dismiss (it also clears itself the next time you open or create a
workspace). The dead URL is replaced in browser history so Back can't
loop into it. A flaky network can never
trigger this — transient fetch errors keep you where you are — and deep
links still survive the sign-in round-trip. Known limitation, tracked:
a tab whose canvas is already open when the workspace is deleted
elsewhere gets no live signal and discovers via failing saves.

### Fix: save-failure messages no longer blame your connection without evidence (2026-07-31)

"Can't save … — check your connection" used to appear for every
persistence failure, whatever the cause (found in QA when saves failed
over a perfectly good connection). The message now names the connection
only when the browser itself reports it's offline; otherwise it reports
the failure neutrally ("Couldn't save your new card"). Text blocks also
now use their proper name in these messages (was "text note").

### Fix: the Inspector can no longer outlive its card (2026-07-31)

Undoing the creation of the card you were editing left its Inspector
open on a ghost — the card vanished from the canvas but the editing
panel stayed, its auto-save pointed at a deleted row, and the returning
first-run introduction rendered misaligned beside the leftover panel
(found in Erik's empty-canvas QA). The app now enforces one invariant
instead of patching each removal path: whenever the inspected card no
longer exists on the canvas, the Inspector closes immediately — without
writing anything. This covers undo, redo, deletion from another device
via live sync, and workspace switching alike, and is guarded so a
workspace still loading can never trigger a false close.

### Empty canvas: altitude rail appears only when there's something to navigate (2026-07-31)

The left-edge altitude rail now follows a present-state rule (Erik's
call): it renders only while the canvas actually contains content —
a node, text block, or line. An empty canvas (including during the
first-run introduction) stays visually quiet; the rail appears the
moment the first object lands, hides again if the last object is
deleted, and returns on undo. The rule reads the canvas's current
state, never its history — completing the FTUE grants nothing
permanent. Pan and zoom stay fully live while the rail is hidden, and
the camera's reserved left band is unchanged, so nothing shifts when
the rail appears. Verified on desktop and Android (full checklist:
hidden-when-empty, appears per object kind, delete-to-empty re-hides,
undo restores, workspace switching shows no stale rail or flash);
iPhone not yet verified.

### Empty homepage: handwritten guidance + primary New-workspace button (2026-07-30)

A brand-new account (or one whose last workspace was deleted) no longer
lands on a page that reads unfinished. When the library has zero
workspaces, the + New workspace control promotes to the primary
treatment (sky fill, white text — the same weight as Create), and the
empty gallery area shows a handwritten instruction in the FTUE's Caveat
voice with an INTENTIONAL two-line hierarchy — "Add a new workspace"
dominant at twice the size of the supporting "to get started" — plus a
hand-drawn arrow bridging the message to the button. The text and arrow
are one composition computed from live element measurements (never
fixed positions), optically centered in the available empty space and
re-laid-out on resize (including after the webfont settles). The arrow
follows adapt-before-remove: its tail prefers the text's right edge,
and when a narrower layout no longer leaves room there it re-attaches
to the text's top edge instead of disappearing — the tail's tangent
always emerges from the message, the head always aims at the button's
center, and both ends keep the same breathing room so the arrow bridges
the relationship rather than belonging to either element. The whole
guide steps aside while the create flow is open (the arrow must never
point at a control that has morphed into the name input). Short
viewports (landscape phones, short desktop windows — caught in Erik's
Android landscape QA) adapt on the height axis too: below 320px of
available space the compact type scale renders (same 2:1 hierarchy)
and the arrow accepts a shallow sweep instead of demanding tall-layout
rise, so the instruction keeps its arrow in every orientation; page
scroll re-anchors it. The end gaps themselves adapt as a ladder
(32 → 24 → 16, always equal at both ends — the balance invariant is
equality, not a fixed number), which is what finally kept the arrow on
a real 617×290 landscape phone where rigid 32px gaps missed both
attachment forms by single digits. This makes
the handwritten-guidance pattern a shared product asset: the FTUE's
arrow-path helpers moved to `lib/handDrawn.js` with both surfaces
consuming them. A dev-only `#empty-picker-preview` harness (absent from
production builds, same pattern as `#ftue-preview`) renders the real
empty state without needing a zero-workspace account. 8 new tests;
suite 686/686.

### Quick-connect: outward carets replace the plus signs (2026-07-29)

The four buttons that appear around a hovered, selected card now show
outward-facing chevrons (up / right / down / left) instead of plus
signs. Tester evidence drove it: a plus reads as "add or duplicate a
node here," not "begin a connection between existing nodes." The
chevron points the way you drag — outward from that edge — and
deliberately avoids full arrow icons, which could imply the resulting
relationship itself has a direction (MasterMind connections don't).
Each button also gains an accessible label ("Connect upward" etc.).
Iconography only: sizing, placement, hover behavior, dwell timing, and
drag behavior are unchanged. This delivers the icon slice of the
BACKLOG quick-connect redesign early; the rest stays pending.

### Connections panel: add connections directly again — searchable picker (2026-07-29)

The Inspector's Connections panel can create connections again, not just
delete them — restoring the second door the block-editor cutover removed
(since then, typing `[[` in the text was the only way to add one).
A circular plus at the end of the chip row (chip-sized) expands into a
search input; a menu beneath lists every connectable node in the
workspace — alphabetized, excluding the card itself and nodes already
connected — and filters live as you type (the same search the `[[` menu
uses; when more than 12 match, a "+N more — keep typing to narrow" hint
makes clear the list isn't complete). Selecting a node creates the same
canonical connection as every other method (one connection per pair,
canvas line, auto-save, undo, Realtime) and the control collapses back
to the plus. Full keyboard support (arrows, Enter, Escape), click-away
to dismiss, and the search field's keystrokes are contained so the
surrounding text editor never reacts to them. The legacy
connection-funnel analytics (started / completed / abandoned) fire
again from this surface. 14 new tests; suite 676/676.

### Desktop FTUE: content-vs-structure composition, responsive to both window dimensions (2026-07-29)

The desktop first-run introduction now teaches the same mental model as
mobile — a dominant "Welcome" hero, the mission line "Use the tools
below to build your workspace" (now canonical wording on BOTH variants),
and the two-column tool legend ("add content with / Nodes" primary,
"or structure and organize with / Labels & Lines" secondary) with three
hand-drawn arrows down to the real toolbar buttons — replacing the old
"Get started / You can also…" tiers. Direct tester evidence drove the
reopening (Mark couldn't tell nodes, text blocks, and lines apart on
desktop); Erik supplied the desktop mockup (Figma 286-148) and drove
three implementation passes to a two-dimensional responsive model:
every desktop type size and designed gap derives from viewport width
AND height through pure, unit-tested functions, the arrow zone is a
designed distance (not leftover space), overlap is structurally
impossible on short windows, and at the 640px breakpoint the desktop
values converge to what the mobile layout itself renders there — so
narrowing a browser flows into the phone composition instead of
snapping between two layouts. The device-QA'd mobile FTUE is unchanged
except the canonical mission wording. A dev-only preview harness
(`#ftue-preview`) renders the real FTUE + toolbar without sign-in for
design QA at any window size; verified absent from the production
bundle. Deferred polish recorded in BACKLOG (breakpoint positional
drift, arrow curve character, narrow-and-short mobile-branch overlap).
Full suite 662/662.

### Inspector: reverting an edit now saves — the A→B→A silent-loss bug (2026-07-29)

Change a card's title, type, thumbnail image, or thumbnail visibility in
the Inspector, let the auto-save land (400ms), then change it back — and
the revert was silently never saved: the Inspector showed the reverted
value while the canvas and database kept the intermediate one, until
closing and reopening the Inspector made a second attempt stick. Found
live in a tester session (2026-07-28, hide-thumbnail repro; matches the
earlier "hide thumbnail needs close/reopen + a second try" report). Root
cause: the auto-save's skip-on-no-change guard compared against the
session-START snapshot, so a value equal to the session start read as
"nothing changed" even when a different value had been saved in between.
The guard now compares against the last-SAVED state (seeded at mount,
advanced after every save). Four regression tests pin the A→B→A scenario
across title, type, and hide-thumbnail (all header fields share the one
guard) plus a no-save-loop check; full suite 659/659.

### Analytics: first-party reverse proxy — tester sessions survive ad-blockers (2026-07-28)

A new tester's session (2026-07-27) produced zero PostHog data — no
person, no events, no recording — despite a healthy production profile
(`is_test_user=true`), unchanged analytics code since the last verified
new-user recording (2026-07-09), and Erik's own sessions recording fine
on the same build. That fingerprint matches client-side blocking:
ad-blockers and privacy browsers blocklist PostHog's ingestion domains,
so the data never leaves the tester's machine. Analytics traffic now
routes through MasterMind's own domain at `/relay` — rewritten to
PostHog's US servers by `vercel.json` in production and mirrored by the
vite dev proxy locally — so domain-blocklist blockers no longer swallow
tester sessions. Disclosed, not silent (Erik's option-C call): the
signup recording notice now says recording works even with an
ad-blocker, so the clickwrap disclosure matches the behavior.
`VITE_POSTHOG_HOST` is retired; the PostHog region lives in the two
proxy configs. Accepted limitation: the strictest privacy tools can
still block same-origin proxies — beta observability is high-coverage,
not total. See the 2026-07-28 amendment to ADR-0009. Production
verification pending first post-deploy session (the rewrite only exists
on Vercel).

### Bead View: expanded cards render at a constant readable size — the zoom-threshold slider no longer controls card size (2026-07-20 — smoke-tested by Erik on desktop, Android, and iPhone same day)

Hover-expanding a bead (or selecting one, or hovering a connection line /
search result) rendered the card at "threshold size" — the size a card
would have at the exact zoom where cards morph into beads. That was
coherent while the threshold was a fixed constant, but the altitude rail
made it user-draggable, silently turning a navigation control (when do
beads happen?) into a size control: slider at the bottom produced gigantic
peeks, slider at the top unreadably tiny ones, and the earlier "desktop
card content is a little too small" observation was the same coupling at
the default threshold. Now the expanded peek renders at a constant screen
scale, decoupled from both zoom depth and slider position:
`EXPANDED_PEEK_ZOOM` (desktop, 1.0 — the card exactly as it looks at 100%
zoom, so Card View body text is readable), and on touch a
**viewport-proportional** rule (same-day revision after the two-phone QA):
the same fixed-scale card read right on Erik's Android (320-CSS-px
display-zoomed viewport → card ≈40% of screen) but too small on the QA
iPhone (430-px viewport → ≈30%), and the honest variable is viewport
width, not platform — so no user-agent sniffing. The base card targets
40% of the viewport width, rounded to the 8-grid and clamped [0.5, 1.0]:
Erik's Android computes to exactly its approved 128px (unchanged by
construction), the iPhone lands at 176px (~41% of screen), touch tablets
cap at desktop size. Viewport widths were Erik-measured on both devices.
The slider still fully controls when the card↔bead morph happens. 12
tests (`CampaignNode.peek.test.jsx`) pin scale constancy across slider
positions and zoom depths, the per-viewport values, the clamps, and the
8-grid discipline (suite at 655). Applies to expanded beads only — normal
Card View rendering at ordinary zoom is untouched.

### Canvas cards: deterministic sizing — no more clipped title words or history-dependent card widths (2026-07-20 — smoke-tested by Erik on desktop, Android, and iPhone same day)

The same card could render at visibly different sizes depending on
zoom/hover/expand history, and in the bad state its longest title word
clipped at the card edge (e.g. "Evergreen" in "1- Evergreen Candle Co.").
Root cause: the avatar circle's width was measured from the header's own
rendered height, closing a feedback loop (avatar width → room for the
title → wrap line count → header height → avatar width) with two stable
solutions; ordinary bead↔card morphs and zoom font changes could knock the
layout into the degenerate one. Fix: the header layout math is extracted
to a pure module (`src/nodes/cardHeaderLayout.js`) that returns the
converged avatar size, and the rendered avatar width now uses that value —
one deterministic layout regardless of navigation history. The avatar's
height/radii still track the measured header (visual fit only, no feedback
path), and the title span gains a `break-words` safety net so a word
soft-wraps rather than clips if canvas text metrics ever drift a few px
from the browser's. 6 new unit tests pin the no-clip and
single-fixed-point invariants across a grid of titles and zoom font sizes
(suite at 643). Display behavior is otherwise unchanged — no card
redesign.

### Mobile: node thumbnail no longer opens the lightbox (2026-07-19, `3e7d79e` — real-device validated on Android + iPhone in production same day)

On touch-primary devices (phones/tablets), tapping a node's thumbnail no
longer launches the image lightbox — the avatar is now inert on touch, so
a tap behaves like a tap anywhere else on the card: single tap selects,
double tap opens the Inspector. Root cause of the maddening bead symptom:
tapping a bead selects it on finger-down, the bead morphs to a card
mid-tap, and the browser aims the resulting click at whatever is under
the finger at lift — which, post-morph, is the card's avatar and its
lightbox handler. Desktop is byte-for-byte unchanged (hover pre-expands
beads, so clicks land where aimed; the avatar keeps its zoom-in cursor
and lightbox). Guard = the existing `useTouchPrimary` media-query hook.
New `CampaignNode.avatar.test.jsx` pins both sides (5 tests; suite at
637). The separate desktop question — whether canvas thumbnails should
open the lightbox at all vs. Inspector-only — stays with the card
display types design discussion.

### Terms of Service + Privacy Policy — operator LLC + beta hardening (2026-07-19, `bd6d90a`)

Both legal documents now name **Just Living The Dream LLC** (a Washington
limited liability company) as the operator, replacing the "Erik Olsen, an
individual… personal project… not a registered business entity" language
(the LLC's reinstatement was confirmed by the WA Secretary of State
2026-06-30). Beta-hardening additions to the Terms: a **Feedback clause**
(product suggestions are usable by us without compensation — with an
explicit carve-out that users' story content stays theirs), a narrow
**competitive-misuse clause** (don't use the service itself to build or
benchmark a competitor), and a beta **seat-cap/waitlist disclosure**.
Privacy precision pass: recordings are reviewed by "the MasterMind product
development team… limited to the Operator's internal product work" (no
forever-promise naming one person; sub-processor exception referenced),
the PostHog sub-processor row now lists IP address and drops the
inaccurate "anonymized," and the avatar location in the deletion
instructions is corrected to top-left. Date lines fixed to render on
separate lines; Last Updated 2026-07-19. The PostHog
delete-recordings-on-account-deletion claim was verified against the
`delete-account` Edge Function before being retained. Deployed +
verified live on `#terms` / `#privacy` (a Vercel queue delay meant the
build started ~25 minutes after push; `e6aae63` is an empty re-trigger
commit from that window — no content of its own).

### FTUE introduction — Chunk 1: desktop handwritten guidance (2026-07-16)

A brand-new (or still-empty) workspace now teaches itself. Per Erik's
storyboard (Figma 225-1971), an empty canvas shows handwritten guidance in
**Caveat** — established here as the reusable brand "direct-to-user" voice
font (`font-hand`): *"Welcome to your new workspace — get started by adding
your first node"*, with hand-drawn-styled SVG arrows pointing at the real
toolbar buttons (measured live via `data-ftue-target` tags — never
hardcoded coordinates), plus a quieter "You can also…" aside for text
blocks and lines. The toolbar tray is held open while the intro is showing.
Arming a creation tool swaps the copy to *"Now place the node wherever you
like on the canvas"* (per-tool variants); the first successful creation
fades everything out — and the existing creation flow already opens the
Inspector with the title focused, so naming is the obvious next step.

**Completion semantics (Erik's timeline model).** The intro is completed by
*the user's own first creation* (per-workspace localStorage flag — UX
state, deliberately not a DB column). **Undoing** that creation back to an
empty canvas rewinds time and brings the intro back; **deleting** content
back to empty is forward motion and does not — a deliberately blank canvas
is honored. Remote (Realtime) inserts hide the overlay while the content
exists but never mark the intro completed. Redoing a creation completes it
again. New analytics events: `ftue_shown`, `ftue_completed`,
`ftue_rewound`.

**MB-8 completed: first node is always a card.** Empty-workspace entry
framing now floors the zoom comfortably card-side of the live card↔bead
threshold (small windows used to open an empty workspace deep in Bead
View, so the first-created node appeared as a tiny bead). Occupied
workspaces keep pure envelope-fit framing, unchanged.

**Mobile portrait included** (iterated across Erik's on-device Android QA
to a revised mockup, 2026-07-17): phones teach **content vs. structure**
instead of mirroring the desktop copy — a large "Welcome," the mission
line "Use these tools to build your workspace," then a small two-column
tool legend directly above the always-visible tray, its rows aligned like
a table: *add content with **Nodes*** and *structure and organize with
**Labels & Lines***, with three short hand-drawn arrows — one under each
tool name (Nodes, Labels, Lines) — bridging the legend down to its tool. The legend introduces **"Labels"** as
the user-facing name for text blocks — reframing them as an organizing
tool rather than a place for story content. Decided (2026-07-17): "label"
is the FTUE-only introduction name — the mobile placement message says
"Now place the label…" to match — while the object remains a "text block"
across the rest of the product, deliberately, so the name never limits
how people use it. Everything is
bottom-anchored and safe-area aware, so the rhythm is identical across
phones and surplus height becomes headroom above the welcome. Tablets and
phone landscape render no intro (they have no toolbar to point at). Erik's
design-QA passes on desktop are folded in: a three-tier visual hierarchy
(96px centered title / 48px instruction near the tray / tertiary aside
pushed right with a laptop-safe clamp), lighter shortened arrows whose
arrival tangents aim at the icon centers with breathing room above the
buttons, the placement message one tray-height above the tray, and the
`leading-hand` token (tightened line spacing for wrapped Caveat — now a
standing design-system rule). **Responsive desktop rules** (from Erik's
narrow-window QA): the title and instruction scale together through one
band locked at a 2:1 ratio, so narrowing a window can never make the
instruction outweigh the welcome; and the tertiary "You can also…" block
(with its arrows) drops out entirely — via a measured minimum-gap rule,
not a breakpoint — before it could ever slide over the instruction. Unit
tests cover the flag semantics, both layout variants' state derivation,
the collision rule, the path helpers, and the entry-zoom floor.

### Mobile zoom tool: deterministic tap-to-open + dead-column fix (2026-07-16)

The left-edge zoom tool (altitude rail) now has a real touch model on
phones — and stops blocking the canvas around it.

**Bug fixed: the tool "opened without the slider" at random.** The rail's
only opening mechanism was mouse hover; on phones that meant iOS Safari's
unreliable fake tap-hover aimed at a 4px line, so whether the tool opened
(slider and all) was effectively a coin flip per session. On phone
portrait the rail now ignores hover entirely: **tap the rail strip to
open** — deterministically, every time. The opening tap never jumps zoom;
while open, the threshold slider is visible and draggable and a tap on the
strip jumps zoom; **tap anywhere else to close** (the outside tap still
does its normal canvas work — nothing is swallowed).

**Dead column fixed.** The invisible 64px hover column stopped
intercepting taps on phones — only a 24px strip over the rail line is
interactive while closed (tunable constant), so nodes/text/lines near the
left edge are tappable again. The dark gradient narrows from 96px to 40px
at rest, widening only as the deliberate open-state response.

**Closed visuals matched to Erik's mockup (Figma 265-226).** The closed
rail and its card-view highlight slim from 4px to hairline 2px, and the
current-zoom marker was redrawn: an 8px notch now sits CENTERED on the
rail (it used to trail off to the right from the rail's edge) with only
the arrowhead breaking the symmetry, its tip 8px right of the rail
center. The open state keeps the full desktop-active look.

Desktop hover behavior is unchanged; regression tests pin the mobile
open/close model, the no-intercept closed state, and the desktop hover
path.

### Bottom toolbar — Chunk 3: mobile portrait toolbar + touch fixes (2026-07-16)

Phones (held upright) now get their own bottom toolbar — the primary
creation surface on mobile, where right-click doesn't exist. Passed Erik's
two-round on-device QA.

**The mobile tray.** Always visible, always expanded, bottom-center:
**Node · Text Block · Line · divider · Undo · Redo**. Detection is
deliberately conservative (touch-primary AND portrait AND ≤640px wide, all
at once — new `useMobilePortrait` hook): touchscreen laptops, tablets,
narrow desktop windows, and phones held sideways all keep their current
behavior (landscape stays out of scope for this cut). Final geometry from
live on-device tuning with Erik: 40px buttons sitting flush (8px around
each 24px icon; gaps only beside the divider; 8px tray padding → 233×56).
40px is a deliberate product call below the 44px touch guideline — it felt
right in hand, and flush buttons mean a grazed tap lands on a neighbor,
not dead space.

**Creation on touch = Chunk 2's one-shots, adapted to fingers.**
- A tap **places on finger-lift, not press** — sliding past 10px or a
  second finger joining abandons the placement (tool stays armed), so
  two-finger pan/zoom while armed can never drop an accidental node.
- **Tap the armed tool again to switch it off** — the phone stand-in for
  Esc. Mid-line-draw, tapping the armed Line button throws the half-line
  away (the one chrome press allowed through mid-gesture).
- A second finger mid-line-drag discards the gesture safely (pan intent);
  known first-cut limitation: that pan attempt itself is lost.

**Undo / Redo on mobile (scope amendment, Erik).** Phones have no Ctrl+Z,
and undo is trust-related. The two buttons ride the SAME per-workspace undo
history as the keyboard shortcuts — one history, two triggers — and are
disabled until usable (fresh load: both off; an edit enables Undo; an undo
enables Redo).

**Feedback strip on phones.** Only the passive "Edited Nm ago" pill is
hidden (bottom-edge de-crowding, deferred not permanent); **"Offline",
"Can't save", and all toasts stay** on every device, and the whole strip
rises above the tray so feedback is never covered.

**Fixed (found in phone QA round 1)**
- **Drawing a line could grab and drag an existing line.** React Flow's
  drag machinery listens to raw touch events — a separate stream from the
  pointer events the line tool intercepted. The overlay now claims both
  streams while armed; regression-tested with a draw starting on top of
  another element.
- **Text block font-size menu opened behind the bottom toolbar and ran
  off-screen.** Nothing inside the canvas can layer above fixed chrome, so
  the menu now renders at the same top layer as right-click menus, flips
  upward near the window bottom, and clamps in-viewport — via a new shared
  `placeDropdown` helper (CanvasToolbar.jsx) ready for future dropdowns.
- **Placing a node/text block showed NOTHING until the database round-trip
  finished** — seconds of doubt on a slow connection. Creation is now
  optimistic: the element appears the instant the tap lands (client-side
  id; Realtime echo dedups; rolled back with the standard save-failure
  surfacing if the insert fails). The Inspector still opens after the save
  confirms — deliberately, so its auto-save can't race a not-yet-landed
  insert and silently lose the first keystrokes.

### Bottom toolbar — Chunk 2: one-shot creation tools + line edge-pan (2026-07-15)

The toolbar's three creation tools are now live **one-shots**: click
**Node**, **Text Block**, or **Line** to arm the tool (sky chip moves,
cursor becomes a crosshair), place once on the canvas, and the toolbar
returns to **Pointer** — always, even from Hand, and on the Canvas Tool
Menu's create actions too. **Esc is the only explicit cancel.** Right-click
while armed behaves exactly as it does in Pointer/Hand mode (canvas menu on
empty space, node menu on a card) and does NOT disarm the tool — a
deliberate change from the line tool's original right-click-cancels
behavior, per Erik's corrected spec (2026-07-15).

- **Node** places via the same quick-add as the Canvas Tool Menu (first
  type, same undo entry) and opens the Inspector immediately for naming —
  the FTUE path.
- **Text Block** places a text block that drops straight into typing.
- **Line** arms the same drawing mode as the Canvas Tool Menu's "Add line"
  — which now also lights up the toolbar's Line chip, since the tool store
  became the single owner of line arming.

**Interaction model — "placement only captures the left click."** There is
no full-screen blanket anymore (the line overlay's old surface owned every
event): a capture-phase listener intercepts only primary clicks aimed at
the canvas. Everything else stays live while armed — right-click menus,
scroll-wheel pan/zoom, and all app chrome (toolbar, altitude rail), so
clicking another tool switches, clicking Pointer/Hand disarms, and nothing
can ever be placed "behind" the toolbar.

**Spacebar during placement (Erik's resolved rule).** Before the first
click/anchor, holding spacebar suspends placement and pans; release
re-arms. Once a line's anchor A is placed, the spacebar (and right-click,
and chrome clicks) are **ignored** until the line completes or Esc cancels
— a half-drawn line is never thrown away. The chip doesn't flip to Hand
mid-gesture either.

**Line edge-pan (new).** After anchor A, pushing the cursor to the window
edge pans the camera in that direction and stops when the cursor comes back
inside — the way to reach an off-screen anchor B now that mid-gesture
spacebar is ignored. Same speed/threshold as the marquee's auto-pan. The
line preview is now anchored in canvas space (it re-projects every frame),
so the half-line stays pinned to the canvas through any camera motion —
which also means wheel pan/zoom keeps working while drawing.

**Added**
- One-shot placement hook [`src/hooks/useOneShotPlacement.js`](./src/hooks/useOneShotPlacement.js)
  (Node/Text single-click placement + Esc-cancel for all creation tools) + tests.
- `placementGestureActive` flag in `useToolStore` (the "gesture in flight"
  signal that makes the spacebar a no-op mid-line); `effectiveTool()` gained
  the matching third parameter.
- [`LinePlacementOverlay`](./src/components/LinePlacementOverlay.jsx) tests
  (flow-coord commit, gesture flag, right-click pass-through/swallow rules,
  chrome-click protection, camera re-projection).

**Changed / Removed**
- `LinePlacementOverlay` reworked from a full-screen pointer-owning surface
  to a pointer-events-none preview + capture-phase listeners (see model
  above); its z-index dropped from above-everything to below app chrome.
  Right-click no longer cancels line drawing. Its `onCancel` prop is gone
  (Esc lives in the shared hook).
- Canvas Tool Menu "Add line" arms the Line tool through the tool store
  (was a private App.jsx boolean).
- All three create paths (`addCardNode` / `addTextNode` /
  `addLineFromPlacement`) revert the active tool to Pointer.

**Not yet in this chunk** — the always-expanded creation-only mobile
variant + hiding the passive sync pill on phones is Chunk 3 (starts only
after Erik's desktop QA of Chunk 2).

### Bottom toolbar — Chunk 1: tool system + desktop tray + spacebar rework (2026-07-10)

First cut of the approved bottom toolbar (Figma 225-1970): the canvas now
has a visible **active tool**. An invisible 288×72 hover hotspot sits
bottom-center; at rest it shows a small 48×44 tab holding a 32px sky-blue
chip that displays the current tool. Mousing into the hotspot grows the tab
into the full 288×72 tray (40px buttons, 20px icons) — the chip slides into
the active tool's slot while the other icons fill in: **Pointer · Hand · |
· Node · Text Block · Line**. Picking a tool is an instant on/off highlight
(the chip only animates during the open/close morph — a sliding highlight
read as the toolbar reorganizing). The hotspot never eats clicks (hover
detection is a document-level hit-test), so marquee/pan still start from
that region while collapsed. Tool tooltips are custom-rendered (native
browser tooltips triggered unreliably). **Inspector-aware centering:** with
the Inspector docked, the toolbar slides left to center in the display area
(between the altitude rail and the docked panel — same constants as the
camera rule); closed or floating, it centers in the window itself. Pointer and Hand formalize existing behavior with no
interaction change — Pointer: drag-on-empty = marquee select; Hand:
drag = pan (canvas elements inert, same as spacebar panning before).

**Spacebar is now a temporary while-held tool switch** (replaces plain
hold-to-pan): with any tool except Hand active, holding spacebar switches
to Hand (drag pans); with Hand active, holding spacebar switches to
Pointer (click selects, drag marquees). Release always restores the tool
you started with. The collapsed chip flips live while the key is held.
Typing in a field still keeps the spacebar (no hijack), and losing window
focus mid-hold releases the switch.

**Added**
- Active-tool store [`src/store/useToolStore.js`](./src/store/useToolStore.js)
  (`pointer | hand | node | text | line` + the pure `effectiveTool()`
  spacebar derivation).
- Bottom tray [`src/components/BottomToolbar.jsx`](./src/components/BottomToolbar.jsx)
  + tests (collapsed/hover-expand, tool switching, spacebar display,
  touch-primary hidden).
- Spacebar hook [`src/hooks/useSpacebarToolSwitch.js`](./src/hooks/useSpacebarToolSwitch.js).

**Changed / Removed**
- `useSpacebarPan` deleted; App derives its pan mode from the tool store.
- **React Flow's built-in spacebar pan activation disabled**
  (`panActivationKeyCode={null}`) — RF v11 silently defaults it to Space
  and internally ORs it into `panOnDrag`, which fought the Hand+spacebar→
  Pointer switch (the chip flipped but drags kept panning). The tool
  system is now the single spacebar owner.

**Not yet in this chunk** — Node / Text Block / Line buttons render but are
inert (one-shot placement is Chunk 2); the always-expanded creation-only
mobile variant + hiding the passive sync pill on phones is Chunk 3.

### Line tool — free-standing canvas lines (2026-07-10)

A third primary canvas element joins nodes and text blocks: **lines** —
straight two-anchor annotations for organizing the canvas visually
*without* creating false node relationships (they live in their own
`lines` table and are structurally incapable of becoming connections; see
ADR-0019). Canvas Tool Menu → "Add line" arms a placement mode: click
anchors point A, move to preview, click anchors point B — or, in one
gesture (and on touch), press-drag-lift. **Shift** while drawing or
re-anchoring constrains the line to the four axes through the fixed
anchor (horizontal, vertical, both 45° diagonals). The finished line is
selected and a floating style toolbar appears: stroke weight (default 8),
solid/dashed, and — only while dashed — dash length + gap, all as direct
type-in fields (click in, type, Enter/blur commits; invalid input
reverts). Lines are selectable, movable (drag the stroke), re-anchorable
(drag an endpoint handle), duplicatable + deletable (right-click menu,
toolbar trash, Delete key, multi-delete/duplicate); every action
round-trips through Ctrl+Z (duplicate excepted — same known gap as
cards/text), and Realtime mirrors lines across tabs like every other
canvas element.
**Requires migration 015** — but loading is fail-soft: if the table is
missing (e.g. a deploy lands before the migration runs), workspaces still
open normally with lines disabled for the session + a console warning,
instead of failing the whole load.

**Added**
- `lines` table + RLS + Realtime (migration 015; `schema.sql` updated) —
  also folds line edits into the picker's "Last modified" sort.
- Data layer [`src/lib/lines.js`](./src/lib/lines.js); renderer
  [`src/nodes/LineNode.jsx`](./src/nodes/LineNode.jsx); placement overlay +
  style toolbar ([`src/components/LinePlacementOverlay.jsx`](./src/components/LinePlacementOverlay.jsx),
  [`src/components/LineStyleToolbar.jsx`](./src/components/LineStyleToolbar.jsx)).
- Undo family `createLine` / `moveLine` / `editLine` / `deleteLine` +
  batch-delete support; 23 new unit tests (incl. the Shift axis-snap).
- Canvas Tool Menu reworked so the three creation tools read as equal
  peers: **"Add node"** (relabeled from "Add card" — node is the entity,
  card/bead are display states) / "Add text" / "Add line", divider
  removed, icons per the Figma toolbar set (filled article square /
  TextT / plain diagonal line — deliberately no endpoint dots, which
  would read as a node connection).

**Changed**
- Element right-click menus (nodes, text blocks, and now lines)
  simplified to **Duplicate + Delete** — Edit and Lock rows removed
  (opening lives on double-click/repoint; lock is scoped out of V1).
- Undo/redo toast labels now use **node** language ("Add node",
  "Move 3 nodes") — card is a display state, not the entity.
- Dashed lines use **butt end caps** (solid lines keep round caps),
  per the Figma/Illustrator convention: a round cap extends every dash
  by half the stroke weight per end, so weight 8 / dash 8 / gap 8
  rendered as solid. With butt caps, dash + gap values are literal and
  weight affects thickness ONLY.

**Removed**
- React Flow attribution tag (bottom-right). License verification
  2026-07-10: `reactflow` + `@reactflow/core` are plain MIT with no extra
  binding terms; the visible tag is a maintainer request tied to React
  Flow Pro, not a license condition. The MIT notice ships intact in the
  package. Revisit only if the project ever subscribes to Pro.

### Signup success panel — email-first confirmation step (2026-07-09)

After creating an account, the signup form is replaced by a green
"Check your email" panel (iPhone QA Finding E; the old inline gray banner
mid-form was easy to miss). The panel is **email-first**: the real next
step lives in the user's inbox — the confirmation link brings them back
to MasterMind — so there is deliberately **no primary button**. Three
scannable sections (bold heading, the destination email bold on its own
line, the open-the-link instruction) per Figma node 223-102, with 14px
supporting text and the mode toggle relabeled to a real "Back to sign in"
text link (sky-600 + underline) as the escape hatch. Panel state resets
when leaving signup. Commit `c29cae8`.

**Added**
- Email-first signup success panel + escape-hatch link
  ([`src/components/Login.jsx`](./src/components/Login.jsx)).
- 3 Login tests: panel replaces form, no-primary-CTA hierarchy +
  escape hatch + reset, error keeps the form
  ([`src/components/Login.test.jsx`](./src/components/Login.test.jsx)).

### Inspector — float-or-dock card editing surface (2026-05-30)

The card-editing surface (formerly "EditModal") is now the **Inspector**,
and it can live in two places: an undocked floating modal that morphs out
of the clicked card (the previous behavior), or a docked panel pinned to
the bottom-right of the canvas. A single click on another card while the
Inspector is open **repoints** it at the new card instead of closing and
reopening — the same surface re-binds to a new card via an inspector-
instance model rather than a teardown/rebuild cycle. A detach gesture pops
a docked Inspector back into a floating modal, and the Inspector remembers
which mode it was last in so the next open honors the user's preference.
Close is directional: a docked Inspector slides down off the bottom edge,
a floating Inspector morphs back into its origin card.

Alongside the Inspector work, a non-functional **search bar placeholder**
landed in the top-right (visual scaffolding for the real search feature),
and the node-selection dimming was softened so unselected cards recede but
stay readable.

**Added**
- Undocked draggable Inspector — the floating modal can be grabbed and
  repositioned (Chunk 1).
- Single-click repoint + inspector-instance model — clicking a different
  card while the Inspector is open re-binds the existing surface to the new
  card instead of closing and reopening
  ([`src/App.jsx`](./src/App.jsx),
  [`src/components/Inspector.jsx`](./src/components/Inspector.jsx),
  [`src/hooks/useMorphAnimation.js`](./src/hooks/useMorphAnimation.js),
  [`src/nodes/CampaignNode.jsx`](./src/nodes/CampaignNode.jsx)).
- Docked mode — Inspector can dock as a bottom-right overlay panel
  ([`src/components/Inspector.jsx`](./src/components/Inspector.jsx),
  [`src/components/InspectorHeader.jsx`](./src/components/InspectorHeader.jsx),
  [`src/index.css`](./src/index.css)).
- Detach gesture, mode memory, and directional close — docked detaches to
  floating; the last-used mode is remembered across opens; close animation
  matches the current mode (slide-down docked, morph-to-card floating).
- Top-right search bar placeholder + smoother hover morph
  ([`src/components/SearchBar.jsx`](./src/components/SearchBar.jsx),
  [`src/components/HoverReveal.jsx`](./src/components/HoverReveal.jsx),
  [`src/components/UserMenu.jsx`](./src/components/UserMenu.jsx)). The
  search bar is visual-only — no query logic yet.
- 3 Inspector tests covering repoint commit, docked close, and directional
  close ([`src/components/Inspector.test.jsx`](./src/components/Inspector.test.jsx)).

**Changed**
- Node-selection dimming softened from `0.15` to `0.45` opacity in
  [`src/nodes/CampaignNode.jsx`](./src/nodes/CampaignNode.jsx) — testers
  found the original dim too aggressive; unselected cards now recede but
  stay legible.

**Renamed**
- `EditModal.jsx` → `Inspector.jsx`, `EditModalHeader.jsx` →
  `InspectorHeader.jsx`, `EditModal.test.jsx` → `Inspector.test.jsx`
  (components `EditModal` → `Inspector`, `EditModalHeader` →
  `InspectorHeader`); App state `editingNode` → `inspectorNode`. The "edit
  modal" terminology is retired in favor of "the Inspector" throughout code
  comments and docs.

### Legal — agreements, in-app policy pages, and self-serve account deletion (2026-05-26 – 2026-05-27)

Pre-tester-invite legal groundwork. New users now agree to the Terms of
Service and Privacy Policy at signup, both documents are readable in-app at
`/#terms` and `/#privacy`, and users can delete their own account end-to-end
without contacting anyone.

**Added**
- Terms of Service + Privacy Policy drafts under
  [`docs/legal/`](./docs/legal/).
- In-app `/#terms` and `/#privacy` hash routes
  ([`src/components/LegalDocPage.jsx`](./src/components/LegalDocPage.jsx),
  [`src/components/TermsOfServicePage.jsx`](./src/components/TermsOfServicePage.jsx),
  [`src/components/PrivacyPolicyPage.jsx`](./src/components/PrivacyPolicyPage.jsx),
  wired in [`src/main.jsx`](./src/main.jsx)).
- Signup-time agreement to ToS + Privacy Policy
  ([`src/components/Login.jsx`](./src/components/Login.jsx),
  [`src/lib/AuthContext.jsx`](./src/lib/AuthContext.jsx)); acceptance
  recorded on the profile row.
- Self-serve account deletion — a Supabase Edge Function
  ([`supabase/functions/delete-account/index.ts`](./supabase/functions/delete-account/index.ts))
  that tears down the user's data and auth record, fronted by a "Delete
  account" button with an email-confirmation modal in
  [`src/components/Profile.jsx`](./src/components/Profile.jsx).

**Changed**
- The in-app delete flow is now the **primary** account-deletion path in the
  policy docs ([`docs/legal/privacy-policy.md`](./docs/legal/privacy-policy.md),
  [`docs/legal/terms-of-service.md`](./docs/legal/terms-of-service.md)).

**Migration/SQL**
- [`supabase/migrations/008_profiles_terms_acceptance.sql`](./supabase/migrations/008_profiles_terms_acceptance.sql)
  — adds terms-acceptance tracking to `public.profiles`.

### campaign → workspace rename (2026-05-18 – 2026-05-19)

Closes [ADR-0012](./docs/decisions/0012-rename-campaign-to-workspace.md). The
architectural object previously called "campaign" is now "workspace"
throughout the data-access layer, contexts, hooks, DB queries, Realtime
subscriptions, persistence keys, tests, and user-facing copy. Representation-
level holdouts (`CampaignNode.jsx`, the `'campaignNode'` RF type id,
`CampaignPicker.jsx`) are deliberately retained per ADR-0012's entity-vs-
representation principle and logged as Known Divergences.

The Storage bucket was renamed in the same pass: `card-media` →
`workspace-media`. A render regression on 2026-05-18 — hardcoded bucket-name
string literals left pointing at the old name — was fixed by routing every
consumer through the `BUCKET_WORKSPACE` constant in
[`src/lib/imageStorage.js`](./src/lib/imageStorage.js).

**Changed**
- `lib/campaigns.js` → [`src/lib/workspaces.js`](./src/lib/workspaces.js);
  `CampaignContext` / `useCampaignData` → `WorkspaceContext` /
  `useWorkspaceData`.
- DB queries, Realtime filters, props, and user-facing copy updated to
  workspace terminology.
- Persistence keys migrated (`mastermind:activeWorkspaceId`) with a
  backwards-compat shim for the old localStorage key.
- Tests updated to the new names.

**Fixed**
- Image-render regression from hardcoded bucket strings — all bucket-name
  references now flow through `BUCKET_WORKSPACE` / `BUCKET_PROFILE`; no
  hardcoded literals remain.

**Migration/SQL**
- [`supabase/migrations/006_rename_campaigns_to_workspaces.sql`](./supabase/migrations/006_rename_campaigns_to_workspaces.sql)
  — renames the `campaigns` table → `workspaces` and dependent columns.
- [`supabase/migrations/007_rename_card_media_bucket.sql`](./supabase/migrations/007_rename_card_media_bucket.sql)
  — renames the bucket to `workspace-media` and its RLS policies/helper in
  place; drops the deprecated `card-media` policies (the bucket itself is
  retained briefly as a rollback artifact, scheduled for deletion).

**Note**
- `card-media` is deprecated, not deleted — clients can no longer read or
  write it. Permanent deletion is a deferred Stage 5 cleanup task.

### Zoom progressive disclosure — Bead View + Altitude Rail (2026-05-12 – 2026-05-15)

Implements [ADR-0010](./docs/decisions/0010-zoom-progressive-disclosure.md)
and its 2026-05-15 addendum. The canvas zoom-out limit no longer caps below
the threshold needed to see a meaningful slice of a campaign at once. As the
user zooms past a tuned altitude, every card morphs from its full rectangular
form into a compact circular **bead**; zooming back in morphs it home. A
left-edge **Altitude Rail** visualizes navigation state and lets the user
retune the morph threshold by dragging.

**Added**
- Altitude state + zoom-threshold trigger driving the Card↔Bead morph; a
  production threshold, dynamic minZoom, and reduced-motion handling
  (Bead View Chunks A–F).
- Card↔bead morph visual: a card collapses to a circular bead with a label
  initial as the no-thumbnail fallback (revises ADR-0010 in commit 401303a).
- Circular connection-point routing for beads;
  [`src/utils/edgeRouting.js`](./src/utils/edgeRouting.js) refactored to take
  rect params so card and bead geometry share one routing path. Crowded-bead
  dot distribution sorts by natural angle and anchors to the natural
  midpoint.
- Hover-expand: hovering a bead temporarily expands it to card form, with
  edges re-routing to the expanded card's visible edges and a per-node morph
  signal; drag-with-frozen-clamp + drop-drift handling so a bead can be
  repositioned while expanded.
- [`src/components/AltitudeRail.jsx`](./src/components/AltitudeRail.jsx) —
  left-edge instrument that reads navigation state (current zoom, threshold,
  dynamic minZoom, altitude) and writes back exactly one value
  (`thresholdGridGapMm`). Two visual states (ambient line at rest, expanded
  controls on hover); the draggable thumb's vertical extent IS the hysteresis
  dead-band, and dragging it retunes the threshold and morphs the canvas in
  real time. Includes click-to-zoom, log-normalized scale, hue-matched scrim,
  and a11y.

**Changed**
- Bbox stability: `computeMinZoom` uses canonical card dimensions
  (256 × 180) for every card-type node regardless of measured size, so a
  card↔bead morph doesn't shift the bounding box and scoot the threshold
  thumb up and down the rail.

**Trade-offs accepted**
- The 64px rail container is `pointer-events: auto`, so marquee-select can't
  be initiated from the leftmost 64px of the canvas — acceptable for an
  edge-mounted nav tool that slides out of the way on mouse-leave.

### Behavioral analytics + session replay — PostHog Cloud, tester-gated (2026-05-11)

Implements [ADR-0009](./docs/decisions/0009-behavioral-analytics-session-replay.md).
Session replay plus ~16 named events via PostHog Cloud, restricted to invited
testers. The whole subsystem revolves around an `is_test_user` boolean on
`public.profiles` — false for everyone by default. Non-testers download zero
bytes of `posthog-js`.

**Added**
- [`src/lib/analytics.js`](./src/lib/analytics.js) — all PostHog
  interaction. `posthog-js` is fetched via dynamic `import()` (its own Vite
  chunk, ~64 KB gzipped) only after `profile.is_test_user === true` is
  confirmed. Three safety guards: conditional load, try/catch on every public
  function, and early-bail on `track()`/`resetAnalytics()` when init never
  ran.
- [`src/components/AnalyticsBootstrap.jsx`](./src/components/AnalyticsBootstrap.jsx)
  — mounted inside `<ProfileProvider>`; watches the profile and fires the
  idempotent `initAnalytics(profile)` on load.
- ~16 named events wired at action sites across
  [`src/App.jsx`](./src/App.jsx), `ConnectionsSection`, `TypePicker`, and
  [`src/hooks/useUndoShortcuts.js`](./src/hooks/useUndoShortcuts.js). Three
  events use windowing/timer logic (`zoom_changed`, `pan_burst`,
  `card_repositioned_quickly`).
- Password protection layered, not selector-based: the login screen renders
  pre-init, PostHog's default `type=password` masking, and a `.ph-mask`
  class honored by `maskInputFn`/`maskTextFn` even when the user toggles the
  show-password eye.

**Changed**
- `AuthContext.signOut` now also calls `resetAnalytics()` so a tester's
  PostHog session/identity can't bleed across users on the same browser.
- Per the ADR revision (commit cb85d5d): **no content masking** in the
  canvas — the words testers type are themselves research signal.

**Migration/SQL**
- [`supabase/migrations/004_is_test_user_flag.sql`](./supabase/migrations/004_is_test_user_flag.sql)
  — adds the `is_test_user` boolean to `public.profiles` (default false).
- [`supabase/migrations/005_default_test_user_true.sql`](./supabase/migrations/005_default_test_user_true.sql)
  — flips the default to true for the invite-only stage. **Revert before
  public launch.**

**Note**
- `VITE_POSTHOG_KEY` must be set at **build time** — Vite substitutes the
  literal at build, and an empty value lets Rollup dead-code-eliminate the
  dynamic `posthog-js` import entirely.

### Profile avatars + `public.profiles` table (2026-05-09)

Users can now upload, replace, and remove a profile photo from a Profile
page. Profile avatars get a 1:1 crop, a single 256×256 WebP variant, and live
in a dedicated `profile-media` Storage bucket distinct from card media.
Introduces `public.profiles` as the canonical home for app-level user
metadata, auto-created per user by an `auth.users` INSERT trigger.

**Added**
- [`public.profiles`](./supabase/migrations/003_profiles_and_profile_media.sql)
  — one row per user (`avatar_path`, `display_name` — no UI yet —
  timestamps), linked 1:1 to `auth.users`, with an `on_auth_user_created`
  trigger plus a backfill for pre-existing users.
- [`src/lib/profile.js`](./src/lib/profile.js) — data-access layer
  (`getProfile`, `setAvatarPath`, `clearAvatar`, `setDisplayName`).
  `clearAvatar` nulls the DB column first, then best-effort deletes the
  Storage object.
- [`src/lib/ProfileContext.jsx`](./src/lib/ProfileContext.jsx) — shared store
  (`useProfile() → { profile, loading, error, updateProfile, refresh }`) so
  the Profile page header and the top-left UserAvatar chip share one source
  of truth; an avatar change propagates without a reload.
- Profile page UI ([`src/components/Profile.jsx`](./src/components/Profile.jsx))
  and UserAvatar integration ([`src/components/UserAvatar.jsx`](./src/components/UserAvatar.jsx)),
  routed at `/#profile` in [`src/main.jsx`](./src/main.jsx).
- Shared image pipeline: `UploadImageModal` becomes domain-agnostic via
  `cardImagePipeline()` / `profileAvatarPipeline()` factories in
  [`src/lib/imageStorage.js`](./src/lib/imageStorage.js); `ImageCropper`
  gains a `profile-avatar` mode (square 256×256 frame + output).

**Migration/SQL**
- [`supabase/migrations/003_profiles_and_profile_media.sql`](./supabase/migrations/003_profiles_and_profile_media.sql)
  — creates the `profiles` table + trigger + backfill and the `profile-media`
  Storage bucket with same-schema RLS (path prefix `= auth.uid()`; no
  SECURITY DEFINER helper needed since there's no cross-schema lookup).

### Sprint 3 — Image upload + cropper (2026-05-08)

A new Upload Image modal replaces the old direct-to-Storage file
picker for both card thumbnails and image-section tiles. Users can
pick a file or paste from the clipboard, position and scale the
image inside a crop frame, and Save commits a single coherent
upload. Per [ADR-0007](./docs/decisions/0007-deferred-image-persistence.md),
no Storage or DB writes happen until the user explicitly Saves;
Cancel discards everything cleanly.

Two cropping modes:

- **Image-section mode** (e.g., the "Inspiration" section). Frame
  defaults to the source image's natural aspect ratio (clamped to
  1:3–3:1). Four corner handles on the frame let the user reshape it
  freely within those bounds; default anchor is the opposite corner,
  Ctrl/Alt switches to symmetric (anchor at frame center). Image
  cover-fits the frame; mouse wheel zooms within cover-min and 5x
  cover. Saved output capped at the 1920×1080 strict box.
- **Thumbnail mode** (the card avatar). Frame is a fixed 280×224
  rectangle centered in the cropper canvas. No frame corner handles.
  Source larger than the frame enters at native pixel size with its
  top-left aligned to the frame's top-left, bleeding right and
  bottom. Source smaller scales up to cover. The image gets four
  corner handles for uniform scaling; same modifier convention as
  image-section. Saved output is exactly 280×224.

The card thumbnail's pencil edit-button is replaced by a Phosphor
`Swap` icon. Clicking opens the Upload Image modal pre-loaded with
the existing thumbnail; from there the user can re-crop, paste a
new image, or click an in-cropper "Remove image" button. Remove
clears the cropper to the empty state and marks the modal as
pending-removal — the user has to press Save to commit (which
deletes the old variants from Storage), or Cancel to discard.
Empty-state thumbnail click opens the modal in fresh-upload mode.

Image-section tiles keep their existing × / + flow — no in-place
replace. To swap a tile, the user removes (×) and uploads a new
one (+).

**Added**
- [`src/components/UploadImageModal.jsx`](./src/components/UploadImageModal.jsx)
  — the modal itself. Document-level paste listener (capture phase)
  so it fires before any focused input's paste handler. Esc handler
  also uses capture phase + `stopImmediatePropagation` so closing
  the upload modal doesn't bubble up and close the parent EditModal.
  OS-aware paste-key label (Cmd+V on Mac, Ctrl+V elsewhere).
- [`src/components/UploadImageProvider.jsx`](./src/components/UploadImageProvider.jsx)
  — context that lets components inside an EditModal open the
  modal. Mirrors LightboxProvider.
- [`src/components/ImageCropper.jsx`](./src/components/ImageCropper.jsx)
  — the cropper component. `forwardRef` so the parent modal can ask
  for the cropped Blob on Save via `computeCroppedBlob()`. Pointer
  events with capture for drag tracking; native wheel listener
  (`{ passive: false }`) so `preventDefault` on zoom doesn't trip
  React 18's passive-by-default behavior on root-level synthetic
  listeners. Cropper canvas has a slightly grey background
  (`bg-gray-100`) so pure-white images keep visible edges against
  the crop surface.
- [ADR-0007](./docs/decisions/0007-deferred-image-persistence.md)
  — records the deferred-save pattern: image data is held in
  browser memory between paste/pick and Save; no Storage or DB
  writes until the user explicitly commits. Deliberate exception to
  ADR-0003's optimistic-write rule, scoped to the
  staging-not-commitment user state of the upload modal.

**Changed**
- [`src/components/MediaSection.jsx`](./src/components/MediaSection.jsx)
  — the +Add button now opens the Upload Image modal via
  `useUploadImage().open(...)` instead of triggering a hidden file
  input directly. Removed the parallel-upload tracking
  (`uploadingCount`, spinner placeholders, `currentItemsRef`) — the
  modal handles one image at a time and shows its own progress.
- [`src/components/EditModalHeader.jsx`](./src/components/EditModalHeader.jsx)
  — pencil edit-button replaced with Phosphor `Swap`. Empty-state
  avatar click and Swap button click both route through the Upload
  Image modal in thumbnail mode. Removed the local upload-progress
  state and the file input.
- [`src/components/Inspector.jsx`](./src/components/Inspector.jsx)
  — wrapped in `<UploadImageProvider>` so MediaSection and
  EditModalHeader can reach the modal.

**Trade-offs accepted**
- **Replace asymmetry between thumbnail and image-section.** The
  thumbnail supports single-click replace via the Swap button;
  image-section tiles don't (they use × + + only). Justified by
  frequency: swapping a card's avatar is routine, replacing an
  image-section tile is rare and the existing × → + flow is two
  single clicks anyway.
- **No re-cropping a previously-saved image without supplying a
  new file.** The cropper is reached only via fresh upload
  (image-section) or via Swap (thumbnail). When re-cropping a saved
  thumbnail, the user is working with the previously-cropped,
  capped output — the original source is not retained.
- **No drag-and-drop, no web-address upload.** File picker +
  clipboard paste only.
- **Multi-image clipboards take the first silently.** Multiple
  images on the clipboard aren't a supported batch path.
- **Storage orphan window on undo of a removal/replace.** Replace
  and remove paths delete the old image's two variants best-effort.
  If the user undoes the resulting `editCardField` action, the
  database reference is restored but Storage no longer has the file
  — the rendered avatar will fail to load. The orphan-cleanup
  script (ADR-0005 §7) is the long-term fix for the inverse
  direction; tightening the Save → DB-update → Storage-delete
  ordering is on the table if this becomes an issue in practice.

### Sprint 2 — Undo / redo + chip-style feedback toasts (2026-05-04)

Closes [ADR-0006](./docs/decisions/0006-undo-redo.md). Recovery from
accidental deletes / edits is now a Ctrl+Z away; a small bottom-left
"feedback strip" reports each undo and redo as a chip-style toast that
slides in from behind the SyncIndicator chip. Foundation for the
Sprint 5+ AI co-pilot (which will write into cards) to feel safe to
try, since bad output is reversible.

**Added**
- 14 action types covering everything destructive or modifying:
  `createCard`, `editCardField`, `moveCard`, `deleteCard`,
  `addConnection`, `removeConnection`, `addListItem`, `removeListItem`,
  `editListItem`, `reorderListItem`, `createTextNode`, `editTextNode`,
  `moveTextNode`, `deleteTextNode`. Each carries a DB-shape snapshot of
  what changed and how to reverse it; the dispatcher reads the top of
  the stack on Ctrl+Z and runs the inverse via the same `lib/*.js`
  write path that normal edits use.
- [`src/store/useUndoStore.js`](./src/store/useUndoStore.js) — per-tab,
  per-(user × campaign) past + future stacks capped at 75 entries.
  sessionStorage-backed so F5 mid-session preserves history; closing
  the tab clears it.
- [`src/lib/undo/`](./src/lib/undo/) — dispatcher + 14 per-type modules
  + 4 family helper files (card / connection / list-item / text-node)
  + a `_shared.js` for universal helpers like `deepEqual`. Each per-
  type module exports
  `{ canApplyInverse, canApplyForward, applyInverse, applyForward }`
  so the dispatcher is a thin `Map<type, handlers>` lookup.
- Conflict-aware in both directions. Both `undo` and `redo` validate
  current state matches what the entry expects (drift detection from
  e.g. another tab's Realtime updates) before applying. On mismatch:
  refuse, pop the orphan entry, fire a "Couldn't undo — this changed
  elsewhere" toast.
- Word-style typing exemption: while focused inside an
  input / textarea / contenteditable, `Ctrl+Z` is left to the browser
  (keystroke-level undo). Outside of those, `Ctrl+Z` reverses the last
  campaign action. `Ctrl+Shift+Z` and `Ctrl+Y` both work for redo.
- [`src/hooks/useUndoShortcuts.js`](./src/hooks/useUndoShortcuts.js)
  — keyboard listener with the typing exemption above.
- [`src/components/FeedbackChip.jsx`](./src/components/FeedbackChip.jsx),
  [`src/components/ChipToast.jsx`](./src/components/ChipToast.jsx),
  [`src/components/FeedbackChipBar.jsx`](./src/components/FeedbackChipBar.jsx)
  — the bottom-left feedback strip. The SyncIndicator chip stays
  light/frosted (ambient "Edited Nm ago"); toasts are dark gray-900
  with white text and slide in from behind the chip via CSS
  `@keyframes` (no JS state ping-pong, no entry delay). Undo/redo
  toasts lead with a Phosphor curved-arrow icon
  (`ArrowUUpLeft` / `ArrowUUpRight`) followed by the entry's label
  ("[↶] Move card"). Conflict and save-fail toasts render text-only on
  the same dark body. 2s visible, 300ms fade-out, hover pauses both
  the dismiss timer and (mid-fade) the visual opacity transition.
- [`src/store/useFeedbackToastStore.js`](./src/store/useFeedbackToastStore.js)
  — custom queue + lifecycle replacing Sonner for the chip toasts.
  Sonner couldn't carry the slide-from-behind-chip + masking pattern.
  When a new toast pushes, any existing visible toast immediately
  starts fading out (no horizontal stacking) so old and new cross-
  fade smoothly during the overlap. Sticky id (`persist-fail`)
  replaces in place so repeated save-failures collapse to one toast.
- [`src/lib/feedbackToasts.jsx`](./src/lib/feedbackToasts.jsx) —
  thin public API (`toastUndoSuccess`, `toastRedoSuccess`,
  `toastUndoConflict`, `toastRedoConflict`, `toastSaveFailed`) so
  `.js` modules can fire chip toasts without owning JSX.
- 31 new tests across `useUndoStore.test.js` and
  `useFeedbackToastStore.test.js` covering stack semantics, F5
  rehydrate end-to-end, conflict + failure paths, toast call paths,
  no-stacking supersession, sticky-id replace, lifecycle phase
  transitions, and pause/resume in both phases.
- [`src/lib/undoIntegration.test.js`](./src/lib/undoIntegration.test.js)
  — round-trip integration test for delete-card-with-everything
  (card + sections + connections), the riskiest action type's
  snapshot/restore cycle.

**Changed**
- The persist-write final-failure toast (in `errorReporting.js`)
  shifted off Sonner onto the same chip-toast system, so all
  bottom-left feedback shares one visual family. The `sonner` npm
  package is no longer imported anywhere — left installed for a
  separate cleanup commit.
- `AuthContext.signOut` now wipes the in-memory undo stack AND every
  sessionStorage `mastermind:undo:${userId}:*` entry (across any
  campaigns the user touched in this tab) before Supabase clears the
  session. Prevents a different user signing in next on the same tab
  from inheriting the prior user's undo history.
- The original 1044-line `src/lib/undoActions.js` and 1565-line
  `src/lib/undoActions.test.js` were each split per-type so the
  dispatcher reads as 14 small focused modules instead of a switch-
  on-type monolith. New action families (e.g. AI-generated batch
  writes when Sprint 5+ lands) drop in as a new file alongside
  rather than disentangling helpers from a grab-bag.

**Trade-offs accepted**
- **No live cross-tab sync.** Tab A's actions don't appear in Tab B's
  stack while both are open. Industry-standard behavior (Figma,
  Notion, Google Docs). If users ever ask, the V2 path is
  BroadcastChannel coordination.
- **No cross-tab-close survival.** Closing the tab loses its undo
  history. F5 is fine (sessionStorage handles it). The localStorage +
  multi-tab-coordination version is the V2 path if real users hit it.
- **Non-transactional delete-restore.** The 3-step restore (card →
  sections → connections) isn't atomic. A partial failure mid-restore
  could leave inconsistent state. `persistWrite`'s retry/lock-overlay
  flow makes this rare; if observed, swap the 3 inserts for one
  Postgres RPC `restore_card_with_dependents`.
- **Residual flicker on chained Ctrl+Z** (create → move → delete
  combos). Functionally correct — round-trip property holds, undo
  history intact — but a sub-frame visual stutter remains. Documented
  in `BACKLOG.md` as Tier 4 polish.

### Sprint 1.6 — EditModal refactor + first component tests (2026-04-28)

The 792-line EditModal was the largest single source of "fragile" code in the
project. Sprint 3 (modular sections UI) would have added more to it. Decomposed
into 5 focused components + 2 hooks, with 10 happy-path tests pinning down
behavior across the refactor.

**Added**
- 4 testing dev dependencies — `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
- [`vitest.config.js`](./vitest.config.js) — jsdom environment + globals.
- [`src/setupTests.js`](./src/setupTests.js) — jest-dom matchers, cleanup
  between tests, jsdom polyfills for `crypto.randomUUID` and `matchMedia`.
- [`src/components/EditModal.test.jsx`](./src/components/EditModal.test.jsx)
  — 10 happy-path tests covering open/populate, debounced auto-save (title +
  type + bullets + bullet removal), connection add/remove, Esc to close
  (with flush), and avatar upload (mocked).
- 5 new components extracted from EditModal:
  - [`src/components/EditModalHeader.jsx`](./src/components/EditModalHeader.jsx)
    — avatar + title + TypePicker + close button. Owns its own
    `uploadingAvatar` state and avatar upload handler.
  - [`src/components/BulletSection.jsx`](./src/components/BulletSection.jsx)
    — reusable section with DnD reorder, focus-on-new, add/remove/update.
    Exports `newItem` for parents that need to seed initial state.
  - [`src/components/MediaSection.jsx`](./src/components/MediaSection.jsx)
    — Inspiration grid with DnD reorder + parallel-safe upload (uses a
    ref to track the latest items so concurrent uploads don't clobber).
  - [`src/components/ConnectionsSection.jsx`](./src/components/ConnectionsSection.jsx)
    — chip list + picker with click-outside-to-dismiss.
  - [`src/components/TypePicker.jsx`](./src/components/TypePicker.jsx)
    — type dropdown with hover highlighting and "Create new type…" row.
  - [`src/components/SectionLabel.jsx`](./src/components/SectionLabel.jsx)
    — small uppercase-tracked label utility used at the top of each section.
- 2 new hooks:
  - [`src/hooks/useAutoSave.js`](./src/hooks/useAutoSave.js) — debounced
    save with explicit `flush()` for use on close.
  - [`src/hooks/useMorphAnimation.js`](./src/hooks/useMorphAnimation.js)
    — modal-from-card morph in/out animation with three phases (pre-paint
    setup via `useLayoutEffect`, animate-in via `useEffect`, animate-out
    via the returned `animateClose` function).

**Changed**
- `src/components/EditModal.jsx`: 792 → 228 lines (71% reduction). Now
  pure orchestration: form state declarations, hook calls, sub-component
  composition. State (title, type, summary, bullet sections, media,
  thumbnail, localConns) stays in EditModal so the auto-save useEffect
  can read all of it from one place.

**What this unblocks**
- Sprint 3 (modular sections UI) lands on small focused files instead of
  a 792-line behemoth.
- Sprint 5 (AI copilot inserting content) can hand each section a clean
  `items` + `onChange` interface.
- Future contributors can read EditModal end-to-end in one sitting.

### Sprint 1.5b — Cascade of polish + bug fixes (2026-04-28)

Sprint 1.5 (Realtime) shipped, but exposed several bugs and UX issues
underneath. All fixed in the same session and verified end-to-end.

**Fixed**
- **Multi-tab DELETE propagation** — Realtime DELETE events on RLS-protected
  tables silently dropped because Postgres' default `REPLICA IDENTITY` only
  sends the primary key in DELETE broadcasts, so the `campaign_id=eq.X`
  subscription filter doesn't match. Required SQL:

  ```sql
  alter table public.nodes          replica identity full;
  alter table public.node_sections  replica identity full;
  alter table public.connections    replica identity full;
  alter table public.text_nodes     replica identity full;
  ```
  Apply this pattern to any future table whose Realtime DELETE events need
  to pass an RLS check or column filter.
- **Right-click context menu position bug** — switched
  [`src/App.jsx`](./src/App.jsx) from the deprecated `rfInstance.project()`
  with manual `getBoundingClientRect` subtraction to
  `rfInstance.screenToFlowPosition({ x: clientX, y: clientY })`. The old
  pattern produced bad coordinates when DevTools or other panels shifted
  the viewport.
- **TextNode trash icon** broken on every edit session after the first.
  Two compounding causes:
  1. `useReactFlow().setNodes((nds) => nds.filter(...))` doesn't propagate
     removals to App's `useNodesState` — RF v11 only emits `'reset'` changes
     for kept nodes when controlled-mode `onNodesChange` is wired up, never
     `'remove'` for the missing one. Fix: new
     [`src/lib/CanvasOpsContext.jsx`](./src/lib/CanvasOpsContext.jsx)
     exposes App's `onDeleteNode` to descendants; TextNode's trash now
     routes through there.
  2. RF v11's NodeWrapper interferes with React's synthetic event delegation
     for selected nodes — `onMouseDown`/`onClick` on toolbar buttons fail to
     fire after the second-and-later edit sessions. Fix: new internal
     `NativeButton` wrapper in
     [`src/nodes/TextNode.jsx`](./src/nodes/TextNode.jsx) attaches
     native `pointerdown` + `click` listeners directly to each toolbar
     button, bypassing React's event system. Also calls `preventDefault()`
     on `pointerdown` so contenteditable focus isn't shifted mid-click.
- **Text-block focus on create** — programmatic `el.focus()` on a freshly-
  mounted contenteditable inside a React Flow node was a no-op in Edge
  even though `document.hasFocus()` was true and tabindex was set. Fix in
  [`src/nodes/TextNode.jsx`](./src/nodes/TextNode.jsx): added `autoFocus`
  attribute + a retry loop (up to 10 attempts at 50ms intervals) that
  bails as soon as `document.activeElement === el`.
- **Submenu hover gap on right-click → Add card → \[type\]** — the 4px gap
  between the primary menu and submenu let mouseleave fire mid-traversal.
  Fix in [`src/components/CanvasContextMenu.jsx`](./src/components/CanvasContextMenu.jsx):
  16px-wide invisible bridge overlapping both menus + 200ms hover-intent
  close delay (cancellable on re-enter).

**Added**
- [`src/lib/CanvasOpsContext.jsx`](./src/lib/CanvasOpsContext.jsx) — small
  context that exposes App-level operations (`onDeleteNode`) to React
  Flow's custom node renderers. See file header for the React Flow
  removal-propagation issue it works around.

### Sprint 1.5 — Realtime cross-tab sync (2026-04-27)

**Added**
- `useCampaignData` opens a Supabase Realtime channel per active campaign with
  four `postgres_changes` listeners (`nodes`, `node_sections`, `connections`,
  `text_nodes`). Incoming events translate back to React/React Flow shape via
  the existing marshalers (`dbNodeToReactFlow`, `dbTextNodeToReactFlow`) and
  merge into `setNodes` / `setEdges`. Channel teardown on campaign switch /
  unmount via `supabase.removeChannel`.
- `dbTextNodeToReactFlow` is now exported from `src/lib/textNodes.js` so the
  hook can reuse it for INSERT/UPDATE handlers.

**Database (run once per project)**
- The four data tables must be members of the `supabase_realtime` publication.
  Idempotent SQL block:

  ```sql
  do $$
  declare t text;
  begin
    foreach t in array array['nodes','node_sections','connections','text_nodes']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end$$;
  ```

  (Erik's project already had `nodes` published from a Supabase template; the
  idempotent form skips it cleanly.)

**Trade-offs accepted (V1)**
- No echo filter. Self-writes round-trip through the channel and re-set
  identical values — harmless for inserts/updates of the same data, but two
  tabs simultaneously typing the same field could drop a character. Revisit
  as 1.5b only if Erik notices it.
- `node_sections` has no `campaign_id` column, so the DB-side filter is
  omitted; RLS scopes events to the user's own rows and the handler
  client-side drops events whose `node_id` isn't in local state.
- `text_nodes` UPDATE handler preserves `data.editing` so a remote update
  can't kick the local tab out of edit mode mid-keystroke.

### Sprint 1 hygiene — Image storage migration + App.jsx refactor (2026-04-27)

**Added**
- Supabase Storage bucket `card-media` with row-level security gated by a
  `SECURITY DEFINER` helper (`public.user_owns_card_media_path`).
  See [`supabase/migrations/002_card_media_bucket.sql`](./supabase/migrations/002_card_media_bucket.sql).
- `src/lib/imageStorage.js` — browser-Canvas transcode → two WebP variants
  (`thumb` 256px / 40% q, `full` 1920px / 80% q) → Storage upload.
- `src/lib/useImageUrl.js` — single hook that resolves any image reference
  (legacy base64, external URL, or Storage path) to a renderable URL.
- `src/components/Lightbox.jsx` — single shared lightbox provider; the
  card avatar (canvas), modal avatar, and inspiration tiles all open it.
- `src/components/MigrateImages.jsx` — one-shot tool at `#migrate` to
  backfill any existing base64 image entries to Storage. Idempotent.
- `src/hooks/` directory with four extracted hooks:
  `useSpacebarPan`, `useCampaignData`, `useEdgeGeometry`, `useNodeHoverSelection`.
  These were carved out of App.jsx to give Sprint 1.5 Realtime work
  clean places to land.
- `src/store/useCanvasUiStore.js` — Zustand store for transient hover/select
  flags. Cards subscribe via narrow selectors; a hover event mutates one
  atomic value instead of forcing a re-render of every card.
- `:has(.is-lifted)` rule in [`src/index.css`](./src/index.css) so hovered /
  selected / edge-highlighted cards rise above neighboring cards spatially.
- ADR-0005 amendment documenting the SECURITY DEFINER lesson — the inlined
  cross-schema check fails silently in storage policies.

**Changed**
- EditModal's avatar + inspiration uploads no longer write base64 strings
  to the database. They transcode + upload via `imageStorage.uploadCardImage`
  and store either a path string (avatars) or a `{path, alt, uploaded_at}`
  object (inspiration entries) per ADR-0005.
- App.jsx shrank from ~700 lines to ~530 lines. The load lifecycle, edge
  geometry recompute, hover/select handlers, and spacebar-pan listeners
  all moved into `src/hooks/`. App.jsx now reads as orchestration.
- `anySelected`, `anyHovered`, and `hoveredEdgeNodeIds` no longer live on
  per-node `data`. They're in `useCanvasUiStore` and CampaignNode reads
  them via narrow Zustand selectors. This removes the O(N) re-render on
  every hover event that would have made 100+ cards sluggish.
- ADR-0005 status: Accepted → **Implemented (2026-04-27)**.
- Avatar header in EditModal: clicking the image now opens the lightbox;
  a small pencil button on hover triggers the file picker (was: clicking
  the image *was* the file picker, no way to view it full-size from inside
  the modal).
- Avatar on the canvas card: clicking now opens the lightbox.
- `main.jsx` Root gatekeeper accepts a `#migrate` hash route so the
  migration tool can be reached without breaking the existing
  loading → login → picker → app gate.

**Fixed**
- Image uploads previously failed with `new row violates row-level security
  policy` because the bucket's RLS expression inlined a cross-schema lookup
  against `public.campaigns`. Replaced with a `SECURITY DEFINER` helper.
- Hovered or selected cards used to be visually overlapped by neighboring
  cards (their bullets bled into the lifted card). The wrapper now gets a
  bumped z-index via `:has(.is-lifted)`.
- Modal avatar previously had no way to view the image full-size; the only
  click target opened the file picker. The pencil-button pattern preserves
  both actions.

**Docs**
- CLAUDE.md File Map updated for `src/hooks/`, `src/store/useCanvasUiStore.js`,
  the new `src/lib/` files, the new components, and the migration file.
- CLAUDE.md "What Is Built" updated; React-shape comment reflects the
  new `media` shape and notes that hover/select flags moved to the store.
- ADR-0005 status flipped to Implemented; an amendment captures the
  SECURITY DEFINER discovery so future Storage-bucket work doesn't
  rediscover it the hard way.

### Sprint 1 — Supabase persistence + auth

**Added**
- Email + password authentication via Supabase Auth (`src/lib/AuthContext.jsx`)
- Login / sign-up screen (`src/components/Login.jsx`)
- Campaign picker landing screen with list / create / rename / delete (`src/components/CampaignPicker.jsx`)
- Active-campaign context persisted to localStorage (`src/lib/CampaignContext.jsx`)
- Full Supabase schema with RLS policies on every table (`supabase/schema.sql`)
- Node + node_sections CRUD with flat-shape ↔ section-rows marshaling (`src/lib/nodes.js`)
- Connections CRUD (`src/lib/connections.js`)
- Text nodes CRUD (`src/lib/textNodes.js`)
- `campaigns.js` API with `createCampaign` that also seeds the five built-in `node_types`
- Profile avatar component with dropdown menu (sign out + email context) (`src/components/UserAvatar.jsx`)
- `UserMenu` overlay on the canvas with Campaigns button + UserAvatar
- `.env.example` template for Supabase credentials
- `docs/decisions/` with three ADRs covering the Sprint 1 architecture calls

**Changed**
- Rebranded from "DnD Campaign Mind Map" to "MasterMind: Story Builder"
- `App.jsx` refactored to load from Supabase on mount / campaign switch, and persist every state mutation back to Supabase (optimistic + fire-and-forget)
- `main.jsx` gatekeeper routes through: loading → login → campaign picker → app
- `CampaignNode` dynamic icon visibility rewritten as a deterministic `useMemo` using canvas `measureText`, eliminating feedback-loop flicker with `avatarSize`
- `TextNode` now persists content, font size, alignment, resize, and toolbar-delete directly to Supabase
- README.md and CLAUDE.md rewritten to reflect current state
- `package.json` name updated to `mastermind-story-builder`

**Removed**
- Lock / unlock cards feature (scoped out of V1; state is in-memory only)
- Duplicate-with-connections variant (plain duplicate is sufficient)
- `+ Strahd sample` button from CampaignPicker (one-time seeding completed)
- `src/lib/seedStrahd.js` (dead code after Strahd campaign was seeded)
- `src/nodes/nodeTypes.js` (legacy static NODE_TYPES; no imports reference it)
- `lucide-react` dependency (Phosphor is the only icon library; Lucide was never used)
- `firebase` dependency (never wired; replaced by Supabase)

**Docs**
- `project-brief.md` retitled to MasterMind: Story Builder; vision content unchanged
- `design-document.md` synced to current reality (Phosphor icons, Supabase backend, built features no longer marked "not yet built," Lock state noted as cut, roadmap consolidated)
- CLAUDE.md "Known Inaccuracies" table removed and replaced with a policy for how future divergences will be tracked (prefer updating design doc, or write an ADR for preserved-intent decisions)

**Fixed**
- Text node content disappearing on refresh (saves on blur now persist `contentHtml` to DB)
- Text node toolbar trash-icon delete not removing the DB row
- Card header icon flickering between visible/hidden during zoom due to `avatarSize` feedback loop
