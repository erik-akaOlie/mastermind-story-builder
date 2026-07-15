# BACKLOG.md — MasterMind: Story Builder

A living backlog. The numbered Sprint 2 / 3 / 4 / 5 roadmap that previously
lived in CLAUDE.md / README.md is retired in favor of this doc — sequential
sprint plans don't survive contact with reality once the backlog grows past
a handful of items with real dependencies.

Items are organized by **Value Add** band — the kind of value the work
delivers (Quick Win, Foundational Progress, Strategic Bet, Exploration). See
[`docs/product/glossary.md`](./docs/product/glossary.md) for vocabulary.
Version-level scope (V1, V2+, V3+, out) lives in [`docs/product/roadmap.md`](./docs/product/roadmap.md).

---

## How this works

- **Living doc.** Items get added, dropped, and re-ranked sprint over sprint.
  The current band placement captures *current* belief, not a contract.
- **Reviewed at the start of each sprint.** What's in the next sprint is
  decided then, with the latest information — not weeks in advance.
- **A "sprint" = 1–2 weeks of working sessions.** Not a strict timebox — a
  unit of planning.
- **Each sprint mixes size.** One Foundational Progress / Strategic Bet
  item + 2–3 Quick Win / Exploration items. Pure-big sprints stall
  mid-feature; pure-small sprints lose momentum on foundational work.
- **Strategic Bet items get a spike first.** A spike is 1–2 days max —
  prototype the riskiest piece, write findings, *then* decide whether to
  commit the rest of the sprint to it.
- **Each item has a problem statement, success criteria, and dependencies.**
  No code until those three exist (per project process preference).
- **Done items live in CHANGELOG.md, not here.** This doc is forward-looking
  only. *(Deliberate exception: the Mox launch-readiness section keeps a few
  shipped items inline, clearly marked ✅, as at-a-glance launch history.)*

## Sizing convention

| Size | Roughly |
|---|---|
| S  | < 1 day |
| M  | 1–3 days |
| L  | 4–10 days (a sprint's "big thing") |
| XL | needs a spike + multi-sprint commit |

---

## Post-launch feature roadmap (May 2026 — PAUSED for Mox launch)

> **Superseded as the *current* focus (2026-06-29).** The immediate focus is the
> **Mox free-beta launch** — see the next section for the live status snapshot.
> This May product-discovery sprint plan (custom card types → typed connections
> → search) is **paused until the beta launches**, then resumes, re-triaged
> against what real GM usage teaches. Kept here as the queued post-launch
> feature work — **not** the current sprint. (Note: *simple* search is pulled
> forward into the launch list below as a candidate must-fix; the fuller search
> here is the post-launch version.)

The previous sprint shipped **Analytics + session replay**,
**Zoom-to-node-view (v1 → v2)**, the **Altitude Rail** instrument,
**Profile avatars**, the **`campaign` → `workspace` rename**, and the
**product-positioning ADRs (0013 / 0014) + documentation cascade**.
See [CHANGELOG.md](./CHANGELOG.md) for the full list.

The next sprint shape comes from the 2026-05-21 product-discovery
exercise — see
[ADR-0013](./docs/decisions/0013-product-positioning.md)
(V1 positioning) and
[ADR-0014](./docs/decisions/0014-workspace-schema-architecture.md)
(workspace schema architecture). Build priorities, in order:

| # | Deliverable | Band | Size |
|---|---|---|---|
| 1 | Code audit for hardcoded card-type logic (ADR-0014 discipline #1) | Foundational Progress | S (few hours) |
| 2 | Custom card types as a fully-supported core path | Foundational Progress | depends on audit |
| 3 | Typed connections | Foundational Progress | L |
| 4 | Search | Foundational Progress | M |

**Why this shape.** ADR-0013 confirmed custom card types as core to
the product (no longer a speculative future feature). ADR-0014 added
one architectural discipline that depends on a code audit — small
enough to run first as the gate to #2. Typed Connections and Search
are the two foundational gaps that turn the canvas from a graph viewer
into a working campaign tool — Erik's own Strahd campaign is already
~50 cards, and finding and labeling relationships is becoming daily
friction.

**Tester invites.** ~5–10 hobbyist DMs planned. Originally targeted
around 2026-05-25; timing is uncertain post-discovery and likely
shifts to after #2 (custom card types) or #3 (typed connections)
lands.

**Usability quick wins landed alongside this planning**
(see [`docs/research/usability-findings.md`](./docs/research/usability-findings.md)):
trackpad two-finger pan + arrow-key navigation (FigJam-style) and the
Inspector thumbnail edit affordance (always-visible pencil icon when
the card has no thumbnail). The remaining design question — *how to
signal that spacebar+drag pans the canvas* — is logged as Open.

**Previously-queued items deferred behind this sprint:** Card-type
defaults in code (ADR-0008), Manage Card Templates, Tailor Card
Types, Markdown export, Nest, Background images V1, Copy / paste
cards, Profile V2 (username only — the profile-image half shipped).
They reorder relative to each other based on what #1 + #2 reveal.

---

## Mox free-beta launch readiness (pre-launch) — CURRENT FOCUS

### Current Mox launch snapshot (2026-07-09)

**Hard gates closed** ✅
- Signup / waitlist / attribution (how-heard) / in-flow recording notice /
  beta-promise copy on the signup screen (migration 014, 2026-06-26)
- Custom SMTP + Site URL + confirmation round-trip — **verified end-to-end
  once, configured for expected beta volume (not load-tested)**; see
  [ADR-0018](./docs/decisions/0018-transactional-email-infrastructure.md)
- ✅ **Simple search shipped** (2026-07-06, `2ba2eb0` — title predictions,
  results drawer, find mode)
- ✅ **Mobile hardening / iPhone QA track (MB-1–MB-6 + Findings A–G) CLOSED
  for beta** (2026-07-08) — each finding resolved, accepted, or consciously
  deferred (mobile clipboard paste cut for beta; C1/C2 are post-beta
  follow-ups). Dispositions in `QA/iphone-safari-qa-results-2026-07-07-final.md`
  (untracked, Erik's main folder only). Finding E (signup success panel) is
  **approved + committed `c29cae8` (2026-07-09)** — email-first "Check your
  email" panel replaces the form, no primary CTA, "Back to sign in" text
  link (Figma 223-102); push/production verification pending.

**Verification closed** ✅
- ✅ PostHog-side display of the enriched `identify` props — **VERIFIED
  2026-07-09** in the PostHog dashboard: the `+iphone` iPhone-QA test account
  (note: `+iphone`, not `+iosqa` as earlier session notes said) is findable
  by email in Persons, shows `email` + `display_name` + `how_heard` person
  properties with the signup values, and has session recordings attached to
  the identified person. The `+iphone` Supabase test account and the iPhone
  QA workspace are now safe to delete (housekeeping, Erik's call — deleting
  the Supabase account does not remove PostHog history).

**Candidate must-fix before the Mox post** (pending re-triage against the
"required to launch + learn" bar — the next product-lead decision)
- First-run creation affordance (FTUE) — now includes a design review of
  surfacing primary canvas tools; see the updated FTUE entry below
- Mobile login + best-on-desktop expectation (no shipped evidence —
  `Login.jsx` untouched since the signup cluster)
- Terms of Service / Privacy Policy operator-name update (see entry below)

**Launch bugs — Erik-reported 2026-07-09, not yet code-verified** (see the
"Launch bugs" entry below for detail)
- Profile image no longer displays in the user avatar
- Node thumbnail click opens the lightbox from the canvas (card AND bead
  form) — likely desired behavior is lightbox from the Inspector only
- Inspector "hide thumbnail" needs close/reopen + a second try — Erik to
  confirm this one is still real before work starts

**Decision pending (not a launch gate)**
- Per-user workspace cap (leaning 3) to support a future paid tier — see
  entry below; decide after the must-fix list is done

**Launch-post copy** (write at post time)
- Beta-promise + Discord redirect script + support-expectation copy
- MB-9: email-template copy edit

**Likely fast-follow** (post-launch polish, not blockers)
- In-app Contact/Feedback link · workspace-delete confirmation · markdown export
  · custom app domain · company-level DMARC · re-home Resend account to a
  company identity · iOS long-press native selection-highlight flash (S, logged
  in the QA dispositions file)

---

> Implementation work for the capped free-beta launch decided in
> [ADR-0017](./docs/decisions/0017-mox-free-beta-launch.md) (2026-06-24).
> Grouped as a cross-band theme rather than scattered across Value-Add
> bands so the launch checklist stays in one place. **Status (2026-06-26):
> the signup / launch-ops cluster has SHIPPED** (the ✅ items below); the
> remaining items are still awaiting implementation through the normal
> pipeline. Already-in-place pieces (Terms/Privacy clickwrap +
> Privacy Policy disclosure, $5 PostHog caps, sole PostHog membership,
> 30-day retention, account+recording deletion) are **not** listed here
> because they are done.

**Priority order (updated 2026-06-29).** ✅ **DONE:** production confirmations;
the **signup & launch-ops cluster** (soft-cap + waitlist + how-heard +
recording notice + beta promise + user identification — shipped as one
coordinated build on migration 014; see the ✅ items below); and the
**custom-SMTP + Site-URL email-deliverability gate** (shipped + verified
end-to-end 2026-06-29 — see the ✅ item below and [ADR-0018](./docs/decisions/0018-transactional-email-infrastructure.md)).
**Remaining candidate must-fix before the Mox post** (pending re-triage, see
snapshot above): first-run creation affordance → mobile entry → ToS/Privacy
operator update (simple search shipped 2026-07-06), judged against the
stricter "required to launch + learn" bar. The **PostHog-side display of the
enriched `identify` props** (email + display_name + how_heard) was **verified
in the dashboard 2026-07-09** — see the snapshot above; that verification
thread is closed. Workspace-delete custom confirmation
and markdown export are Soon-after. **Honest sizing:** remaining Bucket-1 is
~1 sprint.

### Soft cap + overflow waitlist + "how did you hear?"
- ✅ **SHIPPED 2026-06-26** (migration 014 + `betaConfig.js`/`waitlist.js` +
  Login waitlist mode). Verified in prod at the DB level: account creation +
  display_name capture, waitlist insert + duplicate/format guards, soft-cap
  auto-flip to `beta_open = false` at the seat limit. Original spec retained
  below for history.
- **Problem.** ADR-0017 commits to a ~50-seat ("50-ish") capped beta with
  an overflow waitlist, but no seat-gating, waitlist, or attribution
  capture exists. Signup is currently open and ungated.
- **Success.** A `beta_config` row (`seat_limit`, `beta_open`) the client
  reads to show signup vs. waitlist; the signup trigger **auto-flips**
  `beta_open` off when the user count reaches the limit, with manual
  override; no mid-signup rejection (soft cap — a few extra during the
  transition is acceptable). A `waitlist` table (email + how-heard +
  timestamps) with **unique email, format validation, insert-only access,
  and rate-limit protection**. "How did you hear about MasterMind?"
  (dropdown + Other) on **both** flows — required on waitlist, optional on
  signup. `how_heard` on signup rides the existing signup-metadata →
  `handle_new_user` trigger path (same mechanism as `terms_accepted_at`).
- **Notes.** **No Turnstile initially** — escalate to an Edge Function +
  Cloudflare Turnstile on the waitlist only if spam appears or the link
  spreads beyond the intended community (ADR-0017 §4). The waitlist's
  unauthenticated insert is the spam-sensitive surface (its count is the
  demand signal).
- **Dependencies.** None hard. The auto-flip extends the existing
  `handle_new_user` trigger (migration 008).
- **Size:** S–M (insert-only-RLS version; the Turnstile escalation is a
  separate later chunk).

### In-flow session-recording notice on signup
- ✅ **SHIPPED 2026-06-26** — the plain-English recording notice renders on the
  signup screen above the single Terms/Privacy checkbox. Original spec below.
- **Problem.** Per ADR-0017, recording stays on for free beta users under
  *disclosed in-app consent*, but the signup checkbox only says "I agree
  to the Terms of Service and Privacy Policy" — the recording disclosure
  lives one click away inside the Privacy Policy, not in-flow.
- **Success.** A short plain-English notice on the signup screen (signup
  mode only), above the existing Terms/Privacy checkbox, stating that
  in-app sessions are recorded (including typed campaign text), used only
  to improve the product, not sold, and deleted after 30 days, with
  deletion-on-request. **One checkbox only** — no second recording-specific
  checkbox unless legal review requires unbundled consent.
- **Dependencies.** None.
- **Size:** S.

### Beta-promise copy (free early-access, no free-forever guarantee)
- ✅ **SHIPPED 2026-06-26 (signup screen only).** The beta-promise copy renders
  on the signup screen. The **launch-post placement is still pending** (part of
  the launch-post copy work). Original spec below.
- **Problem.** ADR-0017 locks the beta *promise* — free early-access,
  pricing may change, beta access is not a free-forever guarantee — but it
  is not stated anywhere users see it.
- **Success.** The promise appears in the Mox launch post and on the
  signup screen so no user assumes free-forever (protects future
  monetization without awkwardness).
- **Dependencies.** None. Pairs naturally with the in-flow recording notice.
- **Size:** S (copy placement).

### Email-first support placement + in-app Contact/Feedback link
- **Problem.** ADR-0017 sets an email-first support model
  (`contact.mastermind.lab@gmail.com`), but there is no in-app entry point
  to it, and the support-expectation + Discord-redirect copy aren't placed.
- **Success.** An in-app **Contact/Feedback link** that opens a
  pre-addressed email (low-effort launch polish — defer if it turns out to
  be more than ~S). The support-expectation copy and the public Discord
  redirect script (both verbatim in ADR-0017 §5) are placed where they're
  used (in-app/docs + the launch post).
- **Dependencies.** None.
- **Size:** S (in-app link); copy placement is trivial.

### ✅ Custom SMTP for auth email — LAUNCH BLOCKER (SHIPPED + VERIFIED 2026-06-29)
- **Outcome.** Resend free tier wired into Supabase custom SMTP, sending from
  `auth.mastermind.justlivingthedream.com` (DKIM + SPF verified at GoDaddy).
  Supabase post-SMTP rate limit raised 30 → 100/hr; Site URL confirmed already
  pointing at the production app (`https://mastermind-story-builder.vercel.app`);
  `localhost:5173` kept as a dev redirect. Verified end-to-end: real `+alias`
  signup → confirmation email **to inbox** → link → live app; Resend logs
  confirm delivery; own sign-in intact. Built as a **reusable per-app pattern**
  (MasterMind is the first tenant) — playbook in
  [ADR-0018](./docs/decisions/0018-transactional-email-infrastructure.md).
  **Follow-ups (non-blocking):** re-home the Resend account from personal Gmail
  to a company identity; add a monitored company-level DMARC later. $0 added cost.

#### Original problem statement (for reference)
- **Problem.** Supabase's built-in email sender is test-only and capped at
  ~2 messages/hour **project-wide** (a single shared bucket across ALL signups,
  not per user) — confirmed in Supabase's own docs. A Mox launch burst would
  drain that shared cap within the first few signups, leaving later users with
  no confirmation email and no way into the app — a **loss-of-trust** failure
  (the cardinal beta risk). **Supabase Pro does NOT raise this limit** — custom
  SMTP is the only fix. Email confirmation is the chosen abuse control
  (ADR-0017 §4) so it must stay ON, which means working email at burst volume
  is mandatory. (Confirmed 2026-06-26: built-in delivery works for solo testing
  but is unusable at launch volume.)
- **Success.** A real email provider wired into Supabase (Authentication →
  SMTP settings) so confirmation emails deliver reliably at launch volume.
  **Recommended path: Resend free tier ($0; 3,000/mo, 100/day) sending from a
  subdomain of the already-owned `justlivingthedream.com`** (e.g.
  `no-reply@mastermind.justlivingthedream.com`) — **NO new domain purchase, NO
  new recurring cost.**
- **Tradeoffs.** Resend + owned domain = best deliverability, ~20–30 min
  one-time DNS setup (copy-paste across 3 dashboards). Gmail SMTP
  (`contact.mastermind.lab@gmail.com`) = no DNS setup but fragile deliverability
  + Google-throttling risk mid-launch (needs an app password + 2FA); **backup
  only, not preferred.** Do NOT launch on the built-in sender; do NOT disable
  email confirmation to dodge this (it removes the abuse control).
- **Cost.** $0 (free tier + a domain Erik already owns).
- **Dependencies.** Access to `justlivingthedream.com`'s DNS settings — **DNS is
  managed at GoDaddy** (confirmed 2026-06-28), so the DNS-record step is a GoDaddy
  task.
- **Size:** S (one-time setup; mostly copy-paste).

### Simple search (titles + types) — beta scope
- ✅ **SHIPPED 2026-07-06** (`2ba2eb0` — title predictions, results drawer,
  find mode). Searching **inside** card body text remains deferred to a
  fast-follow as specced. Original spec retained below for history.
- **Problem.** A search control is **visible** top-right (`SearchBar.jsx`) and
  expands to a `Search…` input on hover, but it is **presentational only —
  typing does nothing**. The only "coming soon" cue is a hidden screen-reader
  label; visually it looks like a working search. A visible, non-functional
  control reads to a new user as broken / their-data-wasn't-saved / unfinished —
  a trust hit.
- **Success.** Typing matches node **titles and types**; a results list appears;
  selecting a result **centers + selects** that node on the canvas. Searching
  **inside** card body text (block-editor content) is explicitly **deferred** to
  a fast-follow.
- **Decision (2026-06-25).** Make it work (simple version) rather than hide it.
- **Dependencies.** None — operates over already-loaded nodes.
- **Size:** M.

### First-run creation affordance (FTUE) — beta scope
- **Problem.** A brand-new workspace opens to an empty canvas with **no visible
  way to add a node or text block** — creation is right-click-only, which is
  undiscoverable and has no touch equivalent. `createWorkspace` seeds no sample
  content. Highest first-session abandonment risk (abandonment is the cardinal
  failure for a tool that goes stale if entry feels like a chore).
- **Success.** On a new/empty workspace, a centered "Start building" prompt
  offers **Add node** (+ **Add text block** — text nodes are already real and
  reliable). After the first action or dismissal, it reduces to a **small
  bottom-center `+` create button** (minimal — **not** a full persistent
  toolbar). Right-click remains a power-user shortcut. A first-time user can
  **create AND name their first node within ~10s without knowing about
  right-click**. After **Add node**, the Inspector / naming flow opens
  immediately so the next step is obvious (verify the first created node opens
  into a clear editing path).
- **Design stance (2026-06-25).** A **visible creation affordance is required**;
  a **permanent full toolbar is NOT settled** — the graph is the product and
  permanent canvas chrome must earn its keep. Option C (center prompt → minimal
  docked `+`) is the leading concept, built minimal-first; a fuller toolbar
  awaits a dedicated design pass. Bottom-center placement must clear the docked
  Inspector (bottom-right) and the feedback strip (bottom-left).
- **Design stance UPDATE (2026-07-09).** The minimal-`+` leading concept above
  is **stale**: Erik has drafted designs for a **toolbar at the base of the
  canvas** that surfaces the primary canvas tools (currently discoverable only
  via right-click / long-press). FTUE scope now **includes a design review of
  how primary canvas tools are surfaced** — the toolbar is a **direction under
  active design review, not a settled decision**. The success bar is unchanged:
  a new user creates AND names a first node in ~10s without knowing about
  right-click/long-press. Next step: review Erik's toolbar designs together
  before any implementation. MB-8 envelope-framing caveat still applies (a
  first-created node at far-out zoom can render as a tiny bead, undermining
  the "I just created something" moment).
- **APPROVED first cut (2026-07-10, design review of Figma nodes 225-1970 /
  225-1971; alignment finalized at session close after the line tool
  shipped + passed production smoke tests).**
  - **Desktop:** bottom-center toolbar, collapsed to a single active-tool
    chip, expanding on hover to five tools: **Pointer** (select) · **Hand**
    (pan) · divider · **Node** · **Text Block** · **Line**. Active =
    sky-600 chip; creation tools are one-shot (place once, revert to
    Pointer). Pointer/Hand FORMALIZE today's behavior (Pointer:
    drag-on-empty = marquee; Hand: drag = pan) — no interaction change.
  - **Mobile portrait:** toolbar VISIBLE and **fully expanded** (no
    collapsed chip — it is the primary creation/tool surface on phones),
    but **creation tools only: Node · Text Block · Line.** Pointer/Hand
    are EXCLUDED on mobile — one-finger = select/marquee, two-finger =
    pan/zoom are conventional enough to need no visible mode (MB-1 model
    unchanged). Landscape out of scope for the first cut. To de-crowd the
    bottom edge, **hide the passive "Edited Nm ago" sync pill on mobile**
    — visibility-off/deferred, NOT a permanent product decision; transient
    feedback (undo toasts, save-fail warnings) STAYS.
  - **Spacebar (final rule, Erik 2026-07-10):** a temporary while-held
    switch that always ends on the tool you started with.
    - Pointer / Node / Text Block / Line active → holding spacebar
      temporarily becomes **Hand** (click+drag pans); release restores
      the previous tool. Placement tools are suspended while held,
      restored on release.
    - **Hand active → holding spacebar temporarily becomes Pointer**
      (select/marquee); release returns to Hand.
    If an in-progress placement gesture conflicts (e.g. spacebar
    mid-line-draw), STOP and present the fork — Erik's likely preference:
    not-yet-started placement → spacebar pans; gesture mid-flight →
    ignore spacebar or cancel/preserve intentionally, never guess.
  - Toolbar stays creation/navigation-only; styling lives in contextual
    toolbars (per-line, per-text-block). Line tool shipped as prerequisite
    (ADR-0019). Next-session order: toolbar build → desktop/mobile toolbar
    QA → FTUE handwritten introduction (Figma 225-1971) — NO FTUE work
    until toolbar behavior is real and tested.
  - **Build status (2026-07-10, rev 2 after Erik's first QA pass).**
    Chunk 1 implemented (useToolStore + BottomToolbar.jsx +
    useSpacebarToolSwitch replacing useSpacebarPan; creation buttons
    render but are inert) — harness-verified (geometry, hover expand,
    spacebar flip, unit tests) and awaiting Erik's signed-in re-QA
    before commit. QA-pass-1 findings addressed: (1) geometry rebuilt
    to the Figma structure (invisible hotspot, rest tab with chip
    display, grow-into-tray morph with the chip sliding into its slot);
    QA-2 halved the raw Figma values (too small); QA-3 FINALIZED sizing
    between the two — rest tab 48×44 with a 32px chip (8px side/top,
    4px bottom borders), expanded tray 288×72 (height 56+16 per Erik,
    width re-composed on the 8→4→2 grid rule since a pure scale is not
    8-divisible: 40px buttons, 20px icons, 8px in-group gaps, 16px
    padding + divider gaps) — and made tool selection an instant on/off
    (the chip slides ONLY during the open/close morph, never between
    slots on selection);
    (2) flaky native tooltips replaced with custom ones; (3) Hand+
    spacebar→Pointer not working root-caused to React Flow's OWN
    `panActivationKeyCode` defaulting to Space (ORed into panOnDrag
    internally) — disabled via `panActivationKeyCode={null}`, recorded
    as RF gotcha #4 in CLAUDE.md. Spacebar mid-line-draw fork RESOLVED
    per Erik: before anchor A, spacebar suspends placement and pans;
    after anchor A, spacebar is ignored until the line completes or
    cancels. Chunk 2 (one-shot placement) and Chunk 3 (mobile variant +
    sync-pill hide; scope = mobile PORTRAIT, detect conservatively —
    not every touch-capable laptop) not started. QA-3 additions: tray
    top-corner radius 12; Inspector-aware centering (docked Inspector →
    toolbar slides to the display-area center between rail band and
    Inspector band, reusing viewportFraming constants; closed/floating →
    window center) — this also resolved the earlier tray-vs-Inspector
    overlap note; the hotspot never blocks clicks.
- **Dependencies.** None hard; touches the canvas (App.jsx) + the Inspector open
  path.
- **Size:** M (minimal version); the center→dock spotlight choreography is a
  polish layer on top.

### Mobile entry: responsive login + "best on desktop" expectation — beta scope
- **Problem.** The Mox Discord link will be clicked on phones, but the login
  card barely fits a ~380px screen (razor-thin margins; breaks under font
  scaling) and the app has **no responsive layout anywhere** and **nothing tells
  users building is best on desktop**. Current mobile state overall:
  **read-only useful** (pan/pinch/read work; create/duplicate/delete are
  right-click-only and invisible to touch; Inspector modals overflow phones).
- **Success.** Login/signup is comfortably usable on a phone (sign up + read the
  beta promise) **and** the app plainly sets the expectation that building is
  best on desktop. Full mobile canvas authoring stays deferred.
- **Decision (2026-06-25).** Promoted to must-fix (was deferred). Mobile
  light-capture / comments-on-nodes is a separate post-beta idea, not in scope.
- **Status UPDATE (2026-07-09).** The mobile-state description in the problem
  above is **stale**: the mobile hardening track (MB-1–MB-6 + iPhone QA
  Findings A–G) is **closed for beta** — touch now has long-press for the
  Canvas Tool Menu + node menu, two-finger pan/zoom, a full-screen Inspector,
  the phone workspace-picker layout, and photo-picker upload. What **remains
  open** from this item is exactly its title: (a) login/signup responsiveness
  on a ~380px screen, and (b) the in-app "building is best on desktop"
  expectation-setting. Full mobile canvas authoring is still **not** being
  expanded for this launch.
- **Dependencies.** None.
- **Size:** S.

### Launch bugs (Erik-reported 2026-07-09 — not yet code-verified)

> None of these three have been reproduced against the code or production
> yet. First step for each is verification (reproduce + locate), then sizing.
> Do not treat the sizes below as commitments.

1. **Profile image no longer displays in the user avatar.** The top-left
   UserAvatar chip (and possibly the Profile page) no longer shows the
   uploaded profile photo. Regression — this worked when profile avatars
   shipped. Verify in production first; suspect areas: signed-URL
   resolution (`useImageUrl` with `profile-media` bucket) or the
   ProfileContext load. Likely S once located.
2. **Node thumbnail opens the lightbox from the canvas.** Clicking a node's
   thumbnail on the canvas opens the lightbox — easy to hit accidentally in
   card form, worse in bead form. **Likely desired behavior (Erik, to be
   confirmed at fix time): the lightbox opens for node thumbnails only from
   the Inspector**; canvas clicks on the thumbnail should select/open the
   node like any other click. Content-image lightbox behavior elsewhere is
   unaffected. Likely S once verified.
3. **Inspector "hide thumbnail" needs close/reopen + a second try.**
   Reported from prior session context; **Erik to confirm it is still real
   before any work starts** — recorded here so it isn't lost, not yet
   accepted as a confirmed bug.

### Terms of Service / Privacy Policy — operator-name update
- **Problem.** The ToS and Privacy Policy don't yet name **Just Living the
  Dream LLC** as the operating entity. This was blocked on the LLC's
  reinstatement status; the LLC is **confirmed reinstated via WA SoS
  statement received 2026-06-30** — this copy change is unblocked. (Exact
  registered capitalization of the entity name should be read off the WA SoS
  statement before it goes into the legal docs.)
- **Success.** Both documents name the LLC as operator. **Narrow scope:**
  operator/entity language only — preserve the existing recording-consent,
  data-handling, and deletion posture verbatim unless legal review says
  otherwise.
- **Dependencies.** None for this copy change. DOR/Bellevue re-registration
  and trademark are separate lanes, not blockers here.
- **Size:** S.

### Per-user workspace cap — DECISION PENDING (not a launch gate)
- **Idea (Erik, 2026-07-09).** Cap the number of workspaces a free user can
  create — **2 or 3, leaning 3** — so a future paid tier can expand it for
  people who adopt the tool beyond one campaign. Keeping the free cap low
  from day one avoids ever taking something away from existing users.
- **Stance.** Record now, **decide last** — after the must-fix list is done.
  This is the one launch-list item driven by future monetization rather than
  beta learning; it must not add launch friction. If implemented for beta it
  needs: enforcement at `createWorkspace`, clear picker UX at the cap (why
  the button is disabled + what to do about it), and a support story.
- **Dependencies.** None hard. Enforcement is client + a DB-level guard
  (trigger or RLS check) so it can't be bypassed.
- **Size:** S–M (dominated by the cap-reached UX, not the enforcement).

### Beta user identification (display name + PostHog identify)
- ✅ **SHIPPED 2026-06-26 (code) + VERIFIED end to end 2026-07-09.** Required
  display name collected at signup + stored in `profiles` via the trigger;
  `analytics.identify()` sends email + display_name + how_heard. Verified in
  the PostHog dashboard against the `+iphone` iPhone-QA signup: person
  findable by email, all three person properties present with signup values,
  recordings attached to the identified person. Original spec below.
- **Problem.** Signup collects only email + password + terms timestamp — **no
  name**; `profiles.display_name` is always NULL (the column + `setDisplayName`
  exist but nothing in the UI calls them). PostHog `identify` is called with
  **only the raw Supabase UUID** — no email, no name, no properties — so the
  session-replay list is unreadable UUIDs and known testers (Chris, Todd) can't
  be spotted. Genuine beta-ops gap.
- **Success.** Two levels: **(1) immediate** — pass **email** to PostHog
  `identify` as a person property so the replay list is scannable by known email
  (no migration, no signup change); **(2) fuller** — collect a **name** at signup,
  store it in `profiles` via the `handle_new_user` trigger (same metadata path as
  `terms_accepted_at` + `how_heard`), and pass **email + name + how_heard** to
  `identify` so Supabase Table Editor **and** PostHog both show real people.
- **Decision (2026-06-25).** Collect name/user-id at signup; build both levels.
- **Privacy note.** Sending email/name to PostHog while recording is on makes
  sessions personally identifiable — the in-flow recording notice must say
  session activity is tied to your account (don't imply anonymity).
- **Dependencies.** Pairs with the signup-form + `handle_new_user` changes in
  "Soft cap + waitlist + how-heard" (shared migration + form).
- **Size:** S (level 1) + S–M (level 2).

### Production confirmations (Erik — settings/console, no code)
- **Email confirmation ON** (see item above).
- **`VITE_POSTHOG_KEY` set at Vercel BUILD time** — if empty, the `posthog-js`
  chunk is dead-code-eliminated and recording silently never runs (then the
  in-flow notice would disclose recording that isn't happening). See CLAUDE.md
  "Environment Variables."
- **Live signup is open/ungated**; **$5 PostHog caps, 30-day retention, sole org
  membership** still true (ADR-0017 §3 claims verified-in-account — spot-check).
- **Supabase backups** — ✅ **RESOLVED 2026-06-26: upgraded to Supabase Pro.**
  Daily backups (7-day retention) are now active as the **disaster-recovery
  backstop** (full-DB corruption / dropped table / bad migration) — and they also
  protect Erik's own live campaign, which previously had no backup. **Caveats
  (two):** (a) backups cover the **database only** — Storage objects (card +
  content images in `workspace-media`, profile avatars) are **not** included, so a
  restore brings back card text / structure / connections but **not** images
  deleted since; (b) a native restore is **whole-database to a point in time**, so
  recovering a single deleted workspace *without disrupting other users* is a
  manual restore-to-a-clone + extract. Both are why backups do **not** replace
  app-level workspace soft-delete (Soon-after item below) for clean per-workspace
  recovery. (Storage-object backup is a separate future consideration — not a beta
  blocker; campaign *text* is the crown jewel and it is now covered.)
- **Size:** S (dashboard/console checks).

---

## Mox free-beta — Soon after beta opens

### Custom destructive confirmation for workspace delete
- **Problem.** Whole-workspace delete is functional and reasonably protected
  (homepage → tile "…" menu → Delete → a browser `confirm()` naming the
  workspace) but the popup is a **generic browser dialog**, and there is **no
  soft-delete / no in-app undo** for a whole-workspace delete — post-delete
  recovery now relies on the Supabase Pro daily backup, which is a manual
  restore-to-a-clone + extract (whole-DB granularity), not a clean per-workspace
  undelete (the soft-delete item below is that clean fix). (Card deletes have no
  confirm but ARE in-session undoable; account delete is strongly guarded with
  type-your-email.) Not a beta blocker (hard to trigger by pure accident), but a
  trust-hardening item for a memory-reconstruction product.
- **Success.** A custom, product-native modal showing the workspace name +
  impactful destructive language (optionally type-the-name-to-confirm if
  campaigns hold serious history). Erik wants a design pass; bundle with
  homepage polish if it fits naturally.
- **Decision (2026-06-25).** Soon-after, not a beta blocker.
- **Size:** S–M.

### Workspace soft-delete + restore (early Bucket 2)
- **Problem.** A permanently deleted workspace cannot be cleanly recovered
  in-app. Supabase Pro daily backups (added 2026-06-26) are the **disaster**
  backstop, but recovering **one** deleted workspace from a backup means a manual
  restore-to-a-clone + extract at whole-DB granularity — fine for a rare
  catastrophe, clumsy as the answer to "a beta user deleted their campaign
  yesterday, get it back without disrupting anyone."
- **Success.** Deleting a workspace marks it deleted (e.g. `deleted_at`) and hides
  it rather than destroying its rows; a "restore from trash" path brings **exactly
  that one workspace** back, touching no other user. Pairs naturally with the
  custom destructive-confirmation modal above. (Consider extending the same
  pattern to card/text deletes later; out of scope here.)
- **Classification (2026-06-26).** **Early Bucket 2 — not a beta blocker.** With
  Pro backups now active the data is recoverable (manually) even before this
  ships, the existing delete path is reasonably guarded, and for a ~50-person
  short beta the occasional manual recovery is an acceptable support burden. No
  strong reason found to block the first Mox users on it.
- **Dependencies.** A schema migration (`deleted_at` on `workspaces`) + read-path
  filtering everywhere workspaces are listed/loaded + a restore surface.
- **Size:** M.

### Markdown export (data portability)
- See the Foundational/Quick-Win entry below. ToS already covers the gap
  (commercially-reasonable-efforts + human-assisted export on request), so it is
  **not** a beta blocker; ship soon for the no-lock-in trust promise (tenet 6).
- **Size:** S–M.

### Turnstile on the waitlist (conditional)
- Escalate to an Edge Function + Cloudflare Turnstile on the waitlist **only if**
  spam appears or the link spreads beyond the intended community (ADR-0017 §4).

---

## Quick Win

### CHANGELOG catch-up — June–July documentation debt
- **Problem.** CHANGELOG's newest entry before 2026-07-09 was 2026-05-30.
  Assessment (2026-07-09, from `git log master --since=2026-05-30`): **8
  user-facing feature clusters have no entry.** Writing them at the
  established CHANGELOG quality is ~1.5–2 focused hours — too big for a
  session-opening chore, sized as its own mini-session.
- **The missing clusters** (commit ranges verifiable in git log):
  1. Block editor (ADR-0016) — migration Phase 1, Phase 2 chunks A–D,
     E-series legacy cutover, F0–F5g Inspector alignment (Jun 3–8)
  2. Canvas multi-select power tools — align/distribute toolbar,
     multi-duplicate, multi-delete, quick-connect drag, one-connection-
     per-pair constraint (Jun 8–11)
  3. Image pipeline upgrade — tiered display/printable variants, crop-box
     cropper, paste resolver + drag-and-drop, lightbox compound download
     (Jun 18)
  4. Workspace picker overhaul — gallery grid, morphing create control,
     custom covers, auto-snapshot fallback, sort (Jun 19)
  5. Canvas navigation & UX — edge-hover highlight + dual-expand session,
     bookmarkable workspace URLs, global zoom gesture, shift-lock-axis
     drag, per-node thumbnail hide, recent-activity ordering (Jun 16–23)
  6. Beta signup / launch-ops cluster — capped signup, waitlist,
     how-heard, recording notice, identify enrichment (Jun 26)
  7. Simple search — title predictions, results drawer, find mode (Jul 7)
  8. Mobile hardening — MB-1–6 + iPhone QA Findings A–G fixes, incl. the
     mobile-paste beta cut (Jul 2–8)
- **Success.** One CHANGELOG entry per cluster (prose + Added/Changed
  lists, matching the existing entry style); entries dated by ship date;
  no invented detail — write from commit messages + CLAUDE.md sections.
- **Dependencies.** None. **Size:** S (one sitting, ~2h).
- **Note (2026-07-10).** A second assessment grouped the same commits into
  11 finer clusters (splitting block editor vs. Inspector alignment, and
  the Jun 16–23 canvas work into three). Same coverage either way — the
  backfill session should reconcile granularity before writing.

### Undo support for duplicate (single + multi)
- **Problem.** Duplicating a card or text node — whether one (context menu →
  Duplicate) or many (Ctrl/Cmd+D, or context-menu Duplicate on a multi-select)
  — creates the copies but records **no undo entry**, so Ctrl+Z can't remove
  them. Every other mutating action (create, edit, move, delete, connect) is
  undoable; duplicate is the lone gap. With multi-duplicate now shipped, an
  accidental "duplicate 20 cards" can't be reversed in one step.
- **Success.** A single Ctrl+Z removes the copies from the last duplicate
  action (one entry for the whole batch, mirroring the grouped MOVE_CARD /
  BATCH_DELETE shape); redo re-creates them. Works for single and multi,
  cards and text nodes. Conflict-aware like the other handlers.
- **Notes.** Cleanest as a `BATCH_CREATE` (or reuse/extend CREATE_CARD +
  CREATE_TEXT_NODE under a batch wrapper) so inverse = delete-all, forward =
  re-create-all. Pairs naturally with the BATCH_DELETE work (same batch-entry
  pattern). Deferred deliberately when multi-duplicate shipped to keep that a
  true quick win.
- **Dependencies.** None hard; shares the batch-entry pattern with multi-delete.
- **Size:** S–M (one undo handler + recordAction wiring at the two duplicate
  call sites + tests).

### Drop deprecated card-media bucket + helper function
- **Problem.** The 2026-05-18 campaign → workspace rename (ADR-0012)
  introduced a new Storage bucket (`workspace-media`) and a renamed RLS
  helper (`public.user_owns_workspace_media_path`). The old bucket
  (`card-media`) and the old helper (`public.user_owns_card_media_path`)
  were deliberately retained as a temporary rollback artifact during
  the 1–2 week observation window after rollout. They are NOT in use
  by application code — `card-media`'s policies were dropped in
  migration 007 so no client can access it, and the old helper has no
  remaining callers. They cost a small amount of storage + one function
  definition slot. Leaving them indefinitely creates confusion ("which
  bucket is the live one?") and a small attack-surface increase.
- **Success.** Both artifacts are gone:
  - `card-media` bucket deleted via Supabase Storage dashboard
    (UI action — no SQL equivalent; types bucket name to confirm).
  - Old helper dropped via SQL Editor:
    `drop function if exists public.user_owns_card_media_path(text);`
  - CLAUDE.md image-storage section updated to remove the deprecation
    callout (the deprecated artifact no longer exists, so the note
    becomes stale).
  - ADR-0012 "Post-rollout status" section updated to reflect Stage 5
    completion.
- **Notes.** This is the deferred Stage 5 of the workspace-rename
  rollout. The bucket and helper sit inert today — read [ADR-0012's
  "Post-rollout status" section](./docs/decisions/0012-rename-campaign-to-workspace.md#post-rollout-status-2026-05-19)
  before running this for context on why they were retained.
- **Dependencies.** 1–2 weeks of stable usage of `workspace-media`
  with no rollback-triggering bugs surfaced. As of 2026-05-19,
  countdown starts.
- **Sequencing.** Earliest practical run date: 2026-05-26
  (1 week minimum). Reasonable target: 2026-06-02 (2 weeks).
- **Size:** S (15–30 minutes — two manual actions, one commit to
  update docs).

### Workspace cover images
- **Problem.** Workspaces were text-only on the surfaces where users
  pick between them — the CampaignPicker home screen and the UserMenu
  breadcrumb dropdown. As a DM accumulates workspaces, scanning by name
  alone is slower than scanning visually. The pattern is well-trodden:
  every comparable tool (Notion, Roll20, Kanka) uses cover/thumbnail
  images for the same reason.
- **Custom cover — SHIPPED (2026-06-19).** Each workspace carries an
  optional custom cover. CampaignPicker tiles render `cover_image_url`
  (the existing column — no migration was needed; the brief's
  `thumbnail_path` note was stale) via `useImageUrl`, with a Set /
  Change / Remove cover affordance in each tile's "…" menu. Uploads go
  through the shared UploadImageModal in the `workspace-cover` cropper
  mode (16:9, 1536×864) wired to `workspaceCoverPipeline()` in
  `imageStorage.js` (thumb/full WebP, no printable; path
  `{workspaceId}/cover/…`). Replace/remove cleans up the old variants
  (modal `pipeline.delete` on replace; menu Remove deletes directly).
- **Auto-snapshot default — TODO (next step).** When a workspace has no
  custom cover (or the user removes one), the tile should fall back to
  an auto-generated snapshot of the canvas (the knowledge graph),
  crammed to fit; readability not required, just a reflection of
  contents. Precedence: custom cover → auto-snapshot → letter
  placeholder. Approach (confirmed 2026-06-19): the canvas only exists
  while a workspace is open, so capture the snapshot in-app (e.g. on
  leaving the workspace) and save it; needs (a) a canvas-to-image step
  (React Flow viewport → image via a library such as html-to-image),
  (b) a NEW column to store the snapshot path separately from the
  custom cover, so removing a custom cover falls back automatically,
  (c) capture trigger + fallback render. **Risk to spike first:** card
  avatars load from signed URLs — some DOM-to-image tools taint the
  canvas / drop cross-origin images; verify a ~30-min capture test
  before committing.
- **Notes.** Bucket is `workspace-media` (ADR-0012); use `BUCKET_WORKSPACE`.
  The UserMenu breadcrumb dropdown thumbnail is a separate fast-follow
  (reuse the proven cover render path).
- **Size:** custom cover was M; auto-snapshot adds ~M + the spike.

### MigrateImages post-completion UX
- **Problem.** [`src/components/MigrateImages.jsx`](./src/components/MigrateImages.jsx)
  has a confusing post-completion state. After a successful migration
  run, the page shows:
  - A disabled blue button labeled "Done" (relabeled from "Start
    migration", but visually looks clickable).
  - A "Back to canvas" button next to it (the actual navigation
    action).
  - The pre-migration summary still showing the original count
    (e.g. "Card avatars: 6 / Inspiration images: 2") with no re-scan
    after the run completes — looks like the migration failed even
    though it succeeded.
  - No positive success message ("Migrated 8 / 8" or similar).
- **Success.** Post-completion state communicates clearly:
  - The disabled "Done" button either disappears entirely OR is
    replaced with a non-button success indicator ("Migration complete
    — 8 / 8 items migrated.").
  - The summary either refreshes to show the new state ("0 left to
    migrate") OR is hidden after completion.
  - Clear primary action ("Back to canvas") with no competing
    confusing button.
- **Notes.** Surfaced during the 2026-05-19 workspace-rename rollout
  Stage 4 verification — Erik ran the migration successfully but had
  to ask whether it had actually worked because the UI gave no
  positive signal. Pre-existing flaw, not introduced by the rename.
- **Dependencies.** None — `MigrateImages` is a self-contained
  one-shot tool. Per CLAUDE.md, the whole component can be deleted
  once every workspace has zero base64 entries, which may make this
  fix moot. Consider whether to fix or delete based on whether any
  remaining users (testers post-invite) still have legacy base64
  data.
- **Size:** S (≤ 1 day — small visual cleanup in one file).

### Dynamic card width
- **Problem.** Long words and long titles in card headers either overflow
  or get cut off. Cards are fixed-width.
- **Success.** Card width grows to fit content within sane bounds
  (min / max width). Long words wrap rather than overflowing. No header
  text is cut off or unreadable.
- **Notes.** Needs a design pass on the min / max bounds and how it
  interacts with React Flow layout. Doesn't change persistence shape.
- **Size:** M

### Remove orphaned legacy section UI components
- **Problem.** The block-editor cutover (ADR-0016, Chunks E4–E5) removed the
  legacy fielded card editor, leaving some of its section components imported
  by nothing. Confirmed orphaned as of E5b (2026-06-04):
  [`BulletSection.jsx`](./src/components/BulletSection.jsx) has zero live
  importers. Its siblings [`MediaSection.jsx`](./src/components/MediaSection.jsx)
  and [`ConnectionsSection.jsx`](./src/components/ConnectionsSection.jsx) (the
  old in-Inspector connections list — distinct from the new
  `editor/ConnectionsBlock.jsx` fixed panel) are likely also orphaned but were
  not audited during E5b to keep that chunk scoped to undo infrastructure.
- **Success.** Each genuinely-orphaned legacy section component (and any
  now-unused exports/helpers it pulled in) is deleted. Anything still
  referenced by live code stays. Full suite green + clean build after removal.
- **Notes.** Surfaced during the E5b proposal (2026-06-04). Deliberately
  excluded from E5b — E5 is scoped to the undo families + section-write path,
  not orphaned UI. Verify each component's import graph before deleting (don't
  assume from the name; `ConnectionsSection` in particular has a same-stem
  sibling that IS live).
- **Dependencies.** None. Independent of the remaining E5c/E5d chunks.
- **Size:** S.

### Standardize destructive-action styling (app-wide)
- **Problem.** Destructive actions (delete / remove) are styled ad hoc across
  the app. F5a established a clear pattern for the block editor's Delete: neutral
  at rest, text + highlight turn light red on hover (Tailwind red-50 bg /
  red-600 text — see `.mm-danger-item` in
  [`src/components/editor/inspectorEditor.css`](./src/components/editor/inspectorEditor.css)).
  Other destructive controls don't follow it: the card right-click menu
  ([`ContextMenu.jsx`](./src/components/ContextMenu.jsx)), the text-note toolbar
  trash button ([`TextNode.jsx`](./src/nodes/TextNode.jsx)), workspace delete in
  [`CampaignPicker.jsx`](./src/components/CampaignPicker.jsx), and the
  Connection Manager's chip remove.
- **Success.** A single documented destructive-action pattern (the F5a red-hover
  treatment) is applied consistently to every delete/destructive control. The
  pattern is written down (design-system doc and/or a shared utility class) so
  new destructive controls inherit it by default.
- **Notes.** Split out of F5a (2026-06-07) deliberately to keep that chunk scoped
  to the block editor — this rollout touches Inspector chrome + canvas UI, which
  is outside the editor. Audit each destructive control's markup before applying
  (some are Tailwind buttons, some are BlockNote/Mantine menu items — the visual
  pattern is shared, the implementation per surface differs).
- **Dependencies.** None.
- **Size:** S.

---

### Explicit "Move to Other Section" command (Card View ⇄ GM's Eyes Only)
- **Problem.** Cross-section block dragging between the two zone editors was
  **disabled** in F5g because BlockNote's native cross-editor move (insert in the
  destination + a deferred, selection-based delete in the source) is selection/
  timing-fragile across two stacked editors and silently dropped blocks (data loss).
  Within-zone reordering still works; there is currently **no** supported way to move
  a block (e.g. a Media Gallery) from Card View to GM's Eyes Only or back.
- **Success.** A deliberate, reliable "Move to Card View" / "Move to GM's Eyes Only"
  command (e.g. in the block's 6-dot menu) moves the selected block between sections
  with **zero loss**, including custom blocks (Media Gallery images preserved).
- **Notes.** Implement **atomically in our own code** — do NOT re-enable BlockNote's
  cross-editor DnD. The reliable shape: read the source block (type + props +
  content), `insertBlocks` a clone into the **target** zone's editor (BlockNote
  assigns a fresh ID), then `removeBlocks([sourceBlock])` from the **source** editor
  by the exact block reference/ID — two controlled transactions, no PM move-drop
  racing. The two editors are already discoverable via `EditorContext`'s
  register/unregister, so one command can drive both. See the F5g diagnosis
  (cross-editor move root cause) and `crossZoneDragGuard.js`.
- **Dependencies.** F5g (cross-section drag disabled) — shipped. None blocking.
- **Size:** M.

---

## Foundational Progress

> All items in this section target **V1** unless otherwise noted. Order
> within the band reflects current sequencing intent, but is reviewed
> sprint-by-sprint.

### Evaluate TipTap as the text block editing engine
- **Problem.** Text blocks use a hand-rolled contenteditable (HTML strings,
  execCommand bold/italic, custom focus/caret handling, three React Flow
  workarounds documented in CLAUDE.md). MB-6 (2026-07-06) hardened resize +
  mobile selection around it, but the editing lifecycle remains bespoke. If
  text blocks grow richer formatting (lists, links, checklists) or the mobile
  editing experience still misses the beta bar, patching further is the wrong
  marginal dollar.
- **Why TipTap.** Proven in-canvas precedent: tldraw's rich text engine IS
  TipTap (chosen by their team over raw ProseMirror). MIT core, no paid
  service. Our Inspector already ships BlockNote, which is built on
  TipTap/ProseMirror — the family is in our dependency tree, and a long-term
  convergence of the two text surfaces is plausible.
- **Scope note (from the MB-6 research pass).** All editor libraries render a
  browser-native contenteditable — native mobile selection grabbers/magnifier
  behavior is the browser's either way. A swap buys structured data +
  formatting depth + lifecycle robustness, NOT selection feel by itself.
  Migration: HTML strings → ProseMirror JSON (TipTap imports/exports HTML);
  undo entries (editTextNode diffs HTML) and the RF workarounds need
  re-validation. Size M–L.
- **Trigger.** Text blocks need richer formatting, OR mobile text editing
  still fails the beta bar after the MB-6 pass.
- **Success criteria.** Decision memo (adopt / defer / reject) with a spike
  behind it; if adopt: text blocks read/write TipTap JSON with zero content
  loss on migration of existing HTML.
- **Dependencies.** None hard; pairs naturally with any future "text block
  rich formatting" feature work.

### Edge-hover dual-node expansion (Bead View) — ✅ SHIPPED 2026-06-22
- **Status.** **Shipped** in `d717b34` (2026-06-22), browser-verified by Erik.
  Part A (highlight-only) shipped earlier in `d360640` (2026-06-16). Dwelling on
  a connection line (200ms) in Bead View now expands **both** endpoint beads into
  full readable cards, the hovered line re-routes to both, other lines dim, and it
  collapses back on mouse-leave. The single-expanded-node machinery was
  generalized to a keyed `expandedNodes` map; the interaction was stabilized with
  a frozen-geometry edge-hover **session** that owns deactivation (so the
  re-routing line / a card sliding under the cursor can't end it); and geometry
  fidelity was fixed (screen-constant dot declustering + orientation-preserving
  card repulsion). Full architecture in the CLAUDE.md "What Is Built" entry. Tied
  to [ADR-0010](./docs/decisions/0010-zoom-progressive-disclosure.md).
- **Deferred follow-ups (future-compatible, NOT built).** Reopen only with
  evidence:
  - *Pass 2 — custom activation/arbitration.* A nearest-edge picker with a
    zoom-adaptive screen-space hit corridor + "ambiguous = no activation," built
    only if dense-graph activation proves too hard in practice. The session's
    `beginEdgeSession` seam + the single "ignore other edges while active" guard
    in `useEdgeHoverSession.js` are the designed plug-in points — no session
    rewrite needed.
  - *Click-to-pin.* Lock two cards open for persistent relationship inspection
    (vs. transient hover-peek). The session model was structured to accept a
    future `pinnedEdgeId` without redoing the hover system.

### Behavioral analytics + session replay (PostHog)
- **Problem.** Erik plans to invite ~5–10 DMs to start using the product
  in the next two weeks. The biggest product risk right now is not "is
  feature X used" — it's "do real DMs build the right cognitive
  relationship with the graph mental model?" Without instrumentation,
  the early-tester period is wasted: friction signals (cognitive
  overload, abandoned connection attempts, rage clicks, zoom thrash,
  spatial-organization struggles, high undo frequency) go unobserved.
  Live observational sessions on Zoom/Meet add color but can't run
  while testers explore solo, where most "stub your toe" moments happen.
- **Success.** PostHog Cloud is integrated. Session replay is enabled
  only for users marked `is_test_user = true` on `public.profiles`
  (Erik can flag himself in for stress-test sessions). A small set of
  named events (~10–15) covers the friction signals Erik wants to
  observe — explicitly *not* a vanity-metrics dashboard. Consent is
  human-to-human during the invite conversation, not via an in-app
  modal. Everything the tester does is recorded, including the actual
  content they type into cards — the *how DMs write* signal is part of
  the research, not noise to hide. The only exception is passwords,
  which are never recorded (login screen renders pre-init, and any
  future password field is auto-blurred via the standard input type).
  Erik can pull a tester's replay and the matching named-event timeline
  side-by-side after a session.
- **Notes.** Documented in
  [ADR-0009](./docs/decisions/0009-behavioral-analytics-session-replay.md).
  Free tier (5K recordings + 1M events per month) is sufficient for a
  friend-sized pool by a wide margin. Long-term, this is the *research*
  backbone for the onboarding work that comes after the first
  observation cycle.
- **Dependencies.** None — strictly additive. New `is_test_user` column
  on `public.profiles` ships in the same migration.
- **Sequencing.** Ships **first** in the current sprint. Must be live
  before (or alongside) the first tester invites.
- **Size:** S–M (3–4 days)

### Zoom-to-node-view v1 — morph + interaction
- **Problem.** The current zoom-out limit caps below the threshold
  needed to see a meaningful slice of any real campaign at once. Erik
  cannot comfortably demo MasterMind, assess structural campaign
  progress, or reason about *where* to place a new node — all of which
  require seeing the campaign as a whole. As campaigns scale toward
  hundreds of cards, the absence of an altitude view turns from
  annoyance into a structural blocker on the product's core promise
  ("the campaign starts feeling like a living world").
- **Success.** Below a defined zoom threshold, each card morphs into a
  **bead** — a circular form with a type-colored border, the card's
  thumbnail centered, type icon as the no-thumbnail fallback.
  Connection lines stay rendered between beads. Text annotations stay
  zoom-stable (regional labels). Hovering or selecting a bead expands
  it back into a fully-readable card at *normal* card size — decoupled
  from canvas zoom — so the user can read content without zooming all
  the way in. Multi-select uses the existing card multi-select
  treatment (opacity/scale/shadow), not expansion. The morph is
  triggered by crossing the threshold (zoom direction) or by
  hover/select (per-node); animations are interruptible and reversible
  from current visual state. Connection lines fade out during the
  morph and fade back in at their new anchor positions the instant the
  new shape locks. Full canvas interaction (drag, right-click,
  click-to-edit) preserved in Bead View.
- **Notes.** Documented in
  [ADR-0010](./docs/decisions/0010-zoom-progressive-disclosure.md), with
  the 2026-05-12 addendum capturing the refined decisions on
  vocabulary (node / card / bead), threshold unit (mm of on-screen
  grid-dot spacing), hysteresis (1.15× return ratio), dynamic
  zoom-out limit (70% viewport fill), and accessibility
  (`prefers-reduced-motion`). V1 keeps three deliberate fidelity
  reductions: connection lines fade rather than anchor-interpolate
  during morph; hover-expand replaces a tooltip entirely (one
  component cut); selection visuals on beads inherit card states
  rather than getting bespoke styling. Perf optimization for 500
  cards is **deferred to v2** — V1 unblocks Erik's daily friction and
  the demo experience; the scaling wall isn't relevant until tester
  campaigns grow.
- **Dependencies.** Analytics ships first (insurance against zoom-v1
  slipping). No code dependency.
- **Sequencing.** Ships **second** in the current sprint. Must be live
  before (or simultaneously with) the first tester invites.
- **Size:** M–L (7–10 days)
- **Implementation chunks.** Each chunk lands as one commit; sizes are
  inside the M–L overall envelope.
  1. **Altitude plumbing** (S, ~1 day). Add Card / Bead mode state to
     a store (likely `useCanvasUiStore`); wire a React Flow zoom
     listener that flips the mode when the grid-dot mm threshold is
     crossed. No visual change yet — just plumbing plus a console log
     proving it fires.
  2. **Bead morph visual** (M, ~2–3 days). `CampaignNode` renders the
     bead form when shape mode is `bead`: width / height /
     border-radius CSS transitions ~200ms, interruptible. Content
     cross-fade between card and bead (thumbnail or type-icon
     fallback) synced to the same timer. Connection lines fade out at
     morph-start, fade back in when the new shape locks.
     Hover-expand not wired yet — every bead stays a bead.
  3. **Connection points on bead perimeter** (M, ~1–2 days). Circular
     analog of `getSpreadBorderPoints` / `getBorderIntersection` in
     `src/utils/edgeRouting.js`. Distribute by angle to connected
     card; enforce `MIN_CIRCLE_POINT_GAP_PX = 4` minimum arc-distance.
     `useEdgeGeometry` branches on shape mode.
  4. **Hover-expand to readable card** (M, ~2 days). In Bead View,
     hover or single-select on a bead morphs it back to a full
     readable card. Card renders at normal size, decoupled from canvas
     zoom (CSS counter-scale), anchored at the bead's canvas position,
     clamped to the viewport, z-index above neighbors. Hover de-triggers
     on mouse-leave; selection de-triggers on click empty canvas or
     click another node without shift.
  5. **Multi-select highlight** (S, ~0.5 day). Two or more selected
     beads stay as beads with the existing lifted/selected styling.
     Prevents marquee-of-many-beads from exploding into card overlap
     chaos.
  6. **Dynamic zoom-out limit + accessibility + threshold tuning**
     (S–M, ~1 day). Replace static `minZoom = 0.5` with the
     `BIRDS_EYE_VIEWPORT_FILL = 0.7` computation (recompute on
     add / delete / drag-stop). Honor `prefers-reduced-motion` —
     instant swap, no animation, when set. Tune
     `MORPH_BELOW_GRID_GAP_MM` against Erik's monitor. Regression-test
     drag / right-click / click-to-edit on beads.

  Total: 7–9 days, inside the M–L envelope.

### Zoom-to-node-view v2 — performance for 500+ cards
- **Problem.** Zoom v1 ships without performance optimization. As
  testers add cards over the first few weeks, the canvas will start to
  feel sluggish before any individual tester campaign hits ~200 cards
  — drag responsiveness degrades, hover latency increases, morph
  animations stutter when many circles are visible at once.
- **Success.** Comfortably support 500 cards with explicit fidelity
  targets: cold page load under 3s, drag stays at 60fps, hover-state
  transitions feel instant, morph animations remain visually smooth at
  any zoom. Headroom toward 1000 cards. Implementation: viewport
  culling (only render circles inside the visible canvas area),
  connection-line culling (hide lines below a pixel-length threshold
  or fully outside the viewport), and render-time memoization of
  per-node hover/select selectors.
- **Notes.** Same ADR as v1
  ([ADR-0010](./docs/decisions/0010-zoom-progressive-disclosure.md)).
  V2 ships *during* the first observation cycle — not invite-blocking,
  because new tester campaigns start small.
- **Dependencies.** Zoom v1 ships first.
- **Sequencing.** Ships **third** in the current sprint, after invites
  go out.
- **Size:** M (3–5 days)

### Onboarding + first-session scaffolding
- **Problem.** MasterMind asks users to think with a graph mental model
  — nodes, edges, spatial organization, free-floating annotations.
  Every alternative tool they've used (Obsidian, Notion, Google Docs,
  Roll20, OneNote, plain folders) trains them to think hierarchically.
  Without onboarding, first-time DMs will likely import their old
  folder/document mental model into MasterMind, which produces
  cognitive friction that masks itself as "this tool is weird" rather
  than "I haven't learned this paradigm." This is plausibly a larger
  adoption risk than any rendering or interaction polish.
- **Success.** A first-session experience that teaches graph thinking
  through *doing*, not reading. The specific shape is intentionally
  undefined here because it must be **evidence-based**: built after the
  first 4–6 weeks of tester observation reveal the 3–5 most common
  confusion patterns. Candidate elements (none committed yet):
  guided walkthrough on first login, empty-state prompts that scaffold
  the "create a card → connect it to another card → notice the
  structure emerging" loop, contextual hints that appear when behavioral
  signals (excessive panning, repeated zoom thrash, rage clicks)
  suggest the user is fighting the mental model, optional sample
  campaigns to explore.
- **Notes.** **This work should NOT precede analytics + zoom.**
  Designing onboarding in a vacuum produces guesswork. Designing it
  after sitting with real session replays produces evidence-based
  decisions. Surfaced as the biggest substantive gap in the
  2026-05-11 ChatGPT critique of the planning conversation.
- **Dependencies.** Analytics shipped + first observation cycle
  complete (4–6 weeks of real tester usage).
- **Sequencing.** **Post-observation, high-priority next sprint after
  the observation cycle.** This is the bet that adoption lives or dies
  here.
- **Size:** L (4–10 days, depending on what observation reveals)

### Card-type defaults in code (Option B)
- **Problem.** Built-in card types (Character, Location, Item, Faction,
  Story) are stored as rows in the `node_types` table, cloned per user
  from a code constant (`BUILT_IN_TYPES`) at signup. The two copies
  drift: when the code constant changes — visual-language refinement,
  icon swap, label rename — existing users' rows do not update. Each
  default change becomes a manual data migration. Surfaced concretely
  on 2026-05-09 during the Faction icon swap (committed `78df33d`),
  which required an out-of-band SQL update for the user's existing row.
  At multi-user scale this is a recurring tax on architectural
  integrity and on the visual language's freedom to evolve.
- **Success.** Built-in card-type defaults live in code only
  (`src/lib/cardTypes.js`). A new `card_type_overrides` table stores
  *only* the specific fields a user has customized. Render path merges
  built-in + override at lookup time. Custom (user-created) card types
  continue to live as rows in `node_types`, distinguished by an
  `is_builtin` flag. Default changes propagate to all non-customized
  fields instantly. Existing data migrated with zero override rows
  generated for any field that already matches the current default.
- **Notes.** Documented in
  [ADR-0008](./docs/decisions/0008-card-type-defaults-in-code.md).
  Implementation chooses **B1** (preserve `nodes.type_id` foreign key by
  keeping minimal stub rows in `node_types` for built-ins) over **B2**
  (`type_key` TEXT migration on `nodes`); B2 deferred indefinitely. The
  `layout` field is included in the schema as forward-looking storage
  for Tailor Card Types.
- **Dependencies.** None — pure architectural foundation.
- **Sequencing.** Must ship **before** Manage Card Templates. MCT's
  customization flows depend on the override table existing and the
  merge-on-read render path.
- **Size:** M

### Manage Card Templates
- **Problem.** Custom card types are persisted per-user as rows in the
  `node_types` table (via `CreateTypeModal` → `createCustomType()`),
  but there is no UI to **list, rename, recolor, re-icon, duplicate,
  or delete** existing types — only the modal for creating new ones.
  Users can pile up unwanted custom types with no way to manage them
  after creation.
- **Success.** A "Manage card templates" surface that lists all card
  types for the active campaign and supports: create, rename, recolor,
  re-icon, duplicate, delete. Persists to the Supabase `node_types`
  table (closes the Known Divergence). Built-in types are protected
  (cannot delete; some properties may be locked).
- **Notes.** This is the *system-level* CRUD on card types. Per-type
  *section structure* (alignment, motivations, geography, etc.) is the
  separate Tailor Card Types item below — split this sprint so each can
  ship independently. Built-in types remain protected: cannot be deleted;
  edits to label / color / icon write to `card_type_overrides` per
  ADR-0008 (so global default changes still propagate to fields a user
  hasn't customized).
- **Dependencies.** Card-type defaults in code (Option B) ships first —
  the override table and merge-on-read path are MCT's substrate.
- **Size:** M

### Tailor Card Types
- **Problem.** Every card type today has the same fixed sections (Story
  Notes / Hidden Lore / DM Notes / Inspiration). DMs want type-specific
  structure: Character cards should have alignment, motivations, voice;
  Location cards should have geography, population. Without per-type
  section structure, AI Card Creation has no structured target either.
- **Success.** A given card type can declare its own list of sections
  (kind + label + default placement). Editing a card of that type
  surfaces those sections in the modal in the declared order. The
  Character template ships with an **Alignment** field as a default
  section (this folds in what was previously a standalone Exploration
  item — alignment is no longer one-off polish, it's the canonical
  example use-case for tailoring).
- **Notes.** Schema-flexible enough to keep the door open to richer
  per-section field types in V2 (enum, number, image grid, etc.) —
  V1 ships with the existing kinds (`narrative`, `hidden_lore`,
  `dm_notes`, `media`, `custom`).
- **Dependencies.** Manage Card Templates ships first (you can't tailor
  what you can't manage).
- **Size:** L

### Typed Connections
- **Problem.** Connections currently exist but are unlabeled — the canvas
  encodes adjacency, not meaning. Users want to see *"father of"*,
  *"ally of"*, *"located in"* on edges so the graph captures
  relationships, not just lines.
- **Success.** Each connection carries a relationship type from a managed
  list (per-campaign or per-user — design call during build). A picker
  prompts for the relationship type when a connection is created
  (canvas-drag or via modal). Edges render the type label inline.
  Existing untyped connections continue to render and can be typed
  retroactively.
- **Notes.** This is the V1-shippable half of what was previously
  bundled with @-mention parsing as one Strategic Bet. Splitting them:
  typed connections need only a `connections.relationship_type_id`
  column + a `relationship_types` table + a small picker UI. No
  contenteditable parsing required. The @-mention half stays in
  Strategic Bet (see below).
- **Dependencies.** None — independent of Templates work.
- **Size:** L

### Undo of connection-delete doesn't restore inline `[[link]]` styling
- **Problem.** Per ADR-0016 §7, deleting a connection in the editor's fixed
  Connections panel reverts any inline `[[link]]` to that node back to plain
  text (via `revertLinksForNode`). When the user undoes that deletion
  (Ctrl+Z), the connection row and the canvas edge are restored correctly,
  **but the previously-reverted plain text is not re-promoted back to an
  inline link** — it stays plain (no purple link styling). The connection
  data and graph edge round-trip is correct; only the BlockNote inline-link
  *mark* fails to come back.
- **Success.** Undoing a connection deletion that had reverted one or more
  inline `[[links]]` to plain text restores those text spans as inline links
  again, matching their pre-delete state. Redo continues to behave
  symmetrically.
- **Notes.** Surfaced 2026-06-04 during Chunk E4a browser verification. **Not
  an E4a regression** — both code paths (the panel's link-reversion side
  effect from Chunk C, and the `removeConnection` undo handler in `lib/undo`)
  predate E4a and were untouched by it. Root cause: the connection-delete
  undo entry restores connection *rows*, but has no record of (and no inverse
  for) the editor-document mutation that §7 performed as a side effect, so it
  can't reapply the inline-link mark. Fix likely requires the connection
  undo entry to also capture/restore the affected inline-link spans across
  both zone documents — crosses connection-model + BlockNote document state.
  Low data-loss risk (text and connection both survive); the gap is purely
  the visual link mark.
- **Dependencies.** None. Independent of the E4b/E4c/E5 cutover steps.
- **Size:** M

### Nest component
- **Problem.** No way to group cards / connections / text annotations
  into thematic units ("Act 1: Death House", "The Vistani plotline").
  At >50 cards, the canvas becomes hard to organize visually.
- **Success.** A FigJam-section-style container that:
  - Holds any number of cards / connections / text nodes / sub-nests
  - Recurses (nests inside nests)
  - Moves its contents when the nest is moved
  - Has a label / header and is colorable
  - Persists position + membership to Supabase
- **Notes.** Design-loaded — needs a pass on header chrome, resize
  handles, drag-into vs. overlap-into semantics, and how nests
  interact with multi-select / marquee. Persistence shape probably
  needs a `nests` table + a `nest_members` join table (or a `nest_id`
  on each child entity, which limits recursion strategy).
- **Dependencies.** None.
- **Size:** L

### Search
- **Problem.** As campaigns grow, finding a specific card by name or
  content becomes increasingly necessary. No way to do it currently.
- **Success.** Search panel surfaces matches by card label, summary,
  bullet content, type, and (eventually) connections. Click result →
  focus card on canvas.
- **Notes.** Could ship a simpler client-side search first against
  already-loaded state. Postgres full-text search is straightforward
  later if scale demands it. **Partially shipped:** the UI placeholder
  (top-right circle→pill in [`SearchBar.jsx`](./src/components/SearchBar.jsx),
  which also reserves the 80px top band the docked Inspector respects) is
  in place — only the query logic and results panel remain.
- **Size:** M (reduced — UI scaffolding done)

### Background images V1
- **Problem.** The canvas is a flat color today. Campaigns set in a
  specific place (Barovia, Waterdeep, the Underdark) lose visual
  identity without a backing image. The aspirational isometric map is
  V4+; a static image gets most of the value much sooner.
- **Success.** Per-campaign background image upload. Image fills the
  viewport without stretch or tile, and is **fixed to the window, not
  the canvas zoom** (so it doesn't shift when panning / zooming).
  Persists per-campaign; uses the existing image storage pipeline.
- **Notes.** V1 is intentionally minimal: one image, no slideshow, no
  AI generation, no canvas-anchored positioning. V2 layers slideshow
  and AI-generated contextual images on top. Do NOT engineer V1 to be
  "isometric-ready" — the V4+ interactive map is a different rendering
  layer.
- **Dependencies.** None (image storage + signed URLs already shipped).
- **Size:** M

### Markdown export
- **Problem.** No way for a user to get their campaign data out of the
  product. Data ownership matters on its own merits, and matters more
  before AI features ship (lock-in concerns will surface).
- **Success.** One-click "download my campaign as markdown" produces a
  zip (or single file) containing all cards, sections, connections,
  text annotations — readable in any markdown viewer.
- **Notes.** Bounded but needs format decisions: one .md per card or
  one combined file? How are connections encoded — inline links via
  card labels? Where does media land — referenced by signed URL, or
  inlined as base64 attachments?
- **Dependencies.** None.
- **Size:** S–M

### Copy / paste cards across campaigns
- **Problem.** Useful patterns / cards from one campaign can't be reused
  in another.
- **Success.** Copy a card (or set of cards) from campaign A and paste
  into campaign B. Connections within the copied set are preserved.
  Connections to cards *not* in the copy set are dropped.
- **Notes.** Bounded but needs decisions: pasted card brings its type —
  if the type doesn't exist in the target campaign, do we create it?
  Image references: re-upload or copy by reference?
- **Size:** M

### Profile V2 — username + profile image
- **Problem.** The Profile page that shipped only covers email
  (read-only) and password change. As soon as the product reaches users
  beyond the V1 user, those users will want to (a) be addressed as
  something other than the first letter of their email and (b) put a
  face to their account. The breadcrumb and avatar both fall back to
  email-derived initials today.
- **Success.** Two new sections on the Profile page:
  - **Username** field with uniqueness constraint, max length, allowed
    characters. Persisted via a new `profiles` table with a Supabase
    Auth trigger that auto-creates the row on signup. Breadcrumb +
    UserAvatar render the username when set.
  - **Profile image** upload (one image per user, replaces if present).
    Reuses the existing image-storage pipeline with a new path scheme
    (e.g., `users/{userId}/avatar.full.webp`). Renders in `UserAvatar`
    when set, falls back to initial otherwise.
- **Notes.** The Profile page shell is already in place
  (`Profile.jsx` + `#profile` route) so the runway is short. Each piece
  is M individually; together L. Worth splitting if a partial ship
  would be valuable — username alone delivers most of the
  user-identity benefit.
- **Dependencies.** None.
- **Size:** L (or two Ms if split)

---

## Strategic Bet

> Each of these items needs a 1–2 day spike before being committed to a
> sprint. The spike's job: prototype the hardest piece, write findings,
> then decide whether to invest a sprint.

### @-mention parsing + autocomplete
- **Problem (sketch).** Even after typed connections ship, creating a
  connection still means leaving the narrative text and using a separate
  picker. Users want to write *"father to @Ireena"* in card text and
  have the connection auto-created with the typed relationship "father
  to" attached. This is the contenteditable-heavy half of what was
  previously bundled with typed connections; typed connections moved
  into Foundational Progress (V1) and are no longer blocked by the
  spike below.
- **What success might look like.** @-trigger autocomplete inside any
  card's narrative / hidden lore / dm notes; selecting an entry creates
  a typed connection (using the V1 typed-connections infrastructure)
  *and* renders an inline link in the prose. Removing the inline link
  asks before deleting the underlying connection.
- **What the spike has to answer.**
  - How does the @-trigger menu interact with React Flow + the
    existing rich text in cards? (No popover libraries currently
    integrated; contenteditable is custom.)
  - Phrase capture: how do we extract *"father to"* from prose to
    populate the relationship type? Pre-text vs. post-mention vs.
    explicit syntax.
  - Bidirectional inverses ("father to" / "child of") — auto-generated
    or explicitly defined?
  - Reverse-edit semantics: if the user deletes the @-mention text in
    the card, does the connection disappear?
- **Dependencies.** Typed Connections (V1) ships first.
- **Target version:** V2 (likely; reassess after spike)
- **Size:** XL

### AI-Assisted Card Creation
- **Problem (sketch).** Users want to describe a concept in natural
  language and get a structured card back; or paste a block of
  campaign-book text and have it become one or more cards.
- **What success might look like.** "Create a character named Ireena,
  daughter of the Burgomaster of Barovia" → a character card with
  summary + bullet notes, ready to edit. Paste a 3-paragraph location
  description → a location card with sections populated.
- **Dependencies.**
  - **Hard:** Card-type templates must exist first (gives the AI a
    structured target).
  - **Strongly recommended:** Undo / redo must exist first (AI output
    is bad sometimes; users need an out).
- **What the spike has to answer.**
  - Which model + tier (Haiku / Sonnet / Opus) for the quality / cost
    tradeoff?
  - Structured output via tool use (better) or freeform → parse (worse)?
  - Where does the API key live — backend proxy vs. user-supplied?
  - Cost ceiling per campaign / per user.
- **Size:** XL

### Visual hierarchy / 5 tiers in the knowledge graph
- **Problem (sketch).** Cards all look the same size on the canvas. The
  ask is at-a-glance importance — story-critical cards bigger, minor NPCs
  smaller.
- **Why I'm flagging this for discovery.** "More content + more
  connections = more weight" sounds clean but breaks down: a story-critical
  solo NPC has few connections; a tavern with 30 patrons isn't more
  important than the BBEG. The metric needs design thought before code.
- **What the spike has to answer.**
  - What does "important" mean to a DM? Probably user-tagged ("pin this
    card as a major NPC") rather than auto-derived from content size.
  - How are the 5 tiers visually expressed — size only, or also
    typography / border weight / shadow?
  - Performance at 100+ cards with varied sizes (zoom-compensated title
    logic in CampaignNode already gets touchy).
- **Size:** XL

---

## Exploration

### Product-language audit — story-building framing vs. generalized information-organization framing

> **Resolved (2026-05-21) by [ADR-0013](docs/decisions/0013-product-positioning.md).** A product-discovery exercise settled V1 positioning — GM target user, the one broad problem, custom card types core, and the cross-domain platform demoted to a documented hypothesis. This exploration item is closed.

- **Problem (sketch).** ADR-0012 renamed the top-level architectural object
  `campaign` → `workspace` because the original term narrowed the
  architecture to its first audience. A parallel concern was surfaced at
  the same time but explicitly deferred: the *product copy* still frames
  MasterMind as a "Story Builder" for "Dungeon Masters and Game Masters"
  building D&D campaigns. As the broader vision extends toward general
  information-organization use cases (organizational mapping, user
  journeys, knowledge systems, etc.), this framing may narrow the product
  identity in the same way `campaign` narrowed the architecture.
- **Why it's an exploration, not a sprint item.** The same discipline
  ADR-0012 used for architecture applies here: don't preemptively
  abstract product language without a concrete second audience to keep
  the new language honest. We need either (a) a real second use case
  trying the product or (b) deliberate broadening as a positioning
  decision. Either way it's a product strategy conversation, not a
  one-pass copywriting task.
- **What the spike has to answer.**
  - Which surfaces are story-builder-flavored (taglines, headings,
    seed data, example prompts) vs. genre-neutral?
  - Are there places where product copy and architecture *should*
    intentionally say different things to signal current vs. eventual
    audience?
  - What's the lightest-weight way to support multiple product framings
    without forking the codebase (theme/profile, route-scoped copy,
    per-instance config, etc.)?
- **Observations gathered during the campaign → workspace rename**
  (captured as a starting list, not a prescription):
  - `src/components/Login.jsx` and `src/components/Profile.jsx` tagline
    "Sign in to your story builder." / "Your story builder."
  - `src/components/Inspector.jsx` section labels "Story Notes,"
    "Hidden Lore," "DM Notes" — story-genre framing baked into the
    card schema.
  - `src/components/CampaignPicker.jsx` placeholder examples (`e.g.
    Curse of Strahd, The Lost Mines…`) — kept intentionally for now per
    ADR-0012; flagged for re-evaluation here.
  - `CLAUDE.md` product blurb: "interactive continuity database for
    Dungeon Masters and Game Masters."
  - Sample/seed data in `public/avatars/` and across product docs:
    Strahd, Ireena, Madam Eva, Vistani, etc.
  - Brand: "MasterMind: Story Builder" — product name itself.
- **Notes.** Surfaced 2026-05-18 alongside the campaign → workspace
  rename. Deliberately deferred so this conversation isn't conflated
  with foundational architectural work. The new entry is a
  *future-decision starting point*, not a commitment to broaden the
  positioning.
- **Dependencies.** None code-side. Soft dependency on Erik's product
  strategy clarity (target audience(s) for V2+).
- **Target version:** N/A — runs parallel to product versioning.
- **Size:** M (1–3 days of design + writing + light implementation once
  it's the focus).

### Physics layout layer — repulsion, auto-arrange, force-directed clustering
- **Problem (sketch).** Today, cards stay exactly where the user
  places them. As campaigns grow and zoom-out reveals dense clusters,
  cards can visually crowd each other; new cards dropped near a busy
  region overlap existing ones. The hover-expand interaction in zoom v1
  also produces transient overlap with neighboring circles. A physics
  layer — nodes that gently repel each other so they can't share
  space — would resolve overlap automatically and produce organic,
  breathing layouts.
- **Why it's an exploration, not a sprint item.** Introducing physics
  changes the foundational paradigm of the canvas. Erik's Strahd
  campaign has carefully positioned cards in specific spatial
  relationships — Strahd's tower here, Madam Eva's vardo there. A naive
  physics layer would disturb that intentionality. The decision space
  is product-shaping: is physics the *layout system* (Obsidian's graph
  view) or a *layer separate from manual placement* (force only kicks
  in during auto-arrange commands, or on newly-dropped cards before
  they settle)?
- **What the spike has to answer.**
  - Three positions to evaluate: (1) no physics, z-index handles
    overlap; (2) physics on a separate layer from manual — repulsion
    only on creation or via explicit "auto-arrange"; (3) physics as the
    primary layout system, like Obsidian's graph view.
  - Performance at 500–1000 nodes during simulation.
  - Interaction with the zoom v1 hover-expand: should an expanded card
    push neighbors out transiently? Or is z-index always sufficient?
  - References: D3-force, Cytoscape.js, React Flow's force layout
    plugin, Obsidian's graph view, Heptabase, Kosmik, Tinderbox.
- **Notes.** Surfaced 2026-05-11 during zoom-v1 design discussion. Erik
  raised it as a potential answer to hover-expand overlap; deferred from
  zoom v1 because the decision is large enough to deserve its own
  conversation. Zoom v1 ships with z-index for overlap.
- **Dependencies.** None (independent paradigm exploration).
- **Target version:** V2+ (likely; reassess after spike)
- **Size:** XL (spike, then product call, then likely a sprint)

### Weekly-updates strategy — define streams, channels, voice, PROMPTs
- **Problem (sketch).** Erik wants weekly progress posts that serve two
  audiences: hobbyist DMs/GMs (building broader audience over time so
  MasterMind has a warm community at wider sign-up) and product
  designers + AI builders (positioning Erik as a designer building real
  products with AI). Two separate streams chosen as the structural
  shape — same posts won't serve both audiences cleanly. The current
  [`PROMPT.md`](../weekly-updates/PROMPT.md) is single-stream and
  produces too-technical engineer-diary voice, not the "idiot's guide
  to working with AI" voice Erik wants. Several open questions:
  channels per stream, cadence, voice specifics, PROMPT structure,
  Patreon's role.
- **What success might look like.** Each stream has a defined channel,
  cadence, voice, and PROMPT (or handwritten convention). The first
  post on each stream lands cleanly in Erik's voice for its audience.
  A small queue of starter post topics so the first few weeks aren't
  from-scratch decisions. Erik knows which channel a given week's
  insight belongs on without re-deciding the strategy each time.
- **Notes.** Audience-building work — runs parallel to product
  development, not gated on V1 features. Deliberately deferred until
  after the immediate V1 sprint (Zoom v2 → invites) clears. Vision
  + open questions captured in
  [`weekly-updates/README.md`](../weekly-updates/README.md); the
  Week 1 archived draft at
  [`weekly-updates/drafts/_archive/`](../weekly-updates/drafts/_archive/)
  is the canonical "wrong-voice" reference for the future PROMPT
  rewrite.
- **Dependencies.** None code-side. Soft dependency on Erik's
  creative bandwidth — voice work is best done between coding
  sprints, not crammed alongside them.
- **Target version:** N/A — runs parallel to product versioning.
- **Size:** M (1–3 days of design + writing once it's the focus)

### Undo/redo residual flicker
- **Problem.** When chaining several Ctrl+Z presses through
  create → move → delete (or similar), a card can occasionally exhibit
  a sub-frame visual stutter — appearing-then-reappearing during a
  single undo step, or briefly settling on an intermediate position
  before the final one. Functionally correct: no data loss, no state
  corruption, no duplicate items, the undo history is intact. Cosmetic.
- **Why it's not blocking.** Round-trip property holds (verified by
  `undoIntegration.test.js`). The flicker is render-cascade roughness,
  not logical incorrectness. ADR-0006's success criteria are met.
- **Likely cause.** Even after the no-op-echo guards in
  `useCampaignData` (commit `bd5eb3d`), some flicker remains. Suspects:
  (1) `useEdgeGeometry` re-running on every `setNodes` and itself
  calling `setNodes` to refresh `connectionDots` — chained re-renders
  even when geometry didn't change; (2) React Flow v11's internal
  reconciliation when card object references change but ids/positions
  match; (3) cross-table Realtime event ordering — `nodes INSERT`
  vs `node_sections INSERT` arriving in unpredictable order during a
  delete-card inverse, with the local optimistic state already correct.
- **Where to investigate first.** React DevTools profiler during a
  Ctrl+Z sequence: count re-renders of `CampaignNode` per undo. If a
  single undo triggers more than 2 renders of the affected card, the
  cascade is the smoking gun. Then either memoize `CampaignNode` more
  aggressively or move `connectionDots` out of `node.data` (it's
  derived; doesn't need to live in the React Flow node object).
- **Size:** S (investigation) → M (fix)

### BlockNote text-edit undo history lost on Inspector close / node switch
- **Problem.** BlockNote text-edit undo history is lost when the Inspector
  closes or switches nodes because the editor instance is destroyed and
  recreated. Each card zone (`card_view` / `gm_only`) mounts a fresh BlockNote
  editor via `useCreateBlockNote` in
  [`ZoneEditor.jsx`](./src/components/editor/ZoneEditor.jsx); the editor's
  per-keystroke undo history lives only in that in-memory instance
  (ProseMirror's history — ProseMirror is the editing engine inside BlockNote).
  When the Inspector closes, or the user switches to another card and returns,
  the Inspector remounts (`key={topicNodeId}` in
  [`App.jsx`](./src/App.jsx)) and `CardZones` reloads on `nodeId` change, so the
  editor is recreated and its history starts empty. While the editor stays
  mounted and focused, undo/redo work correctly.
- **The open question.** Consider whether per-node editor history persistence
  is needed, or whether this is acceptable because saved content reloads as a
  fresh editing session. Most document editors (Notion, Google Docs) also drop
  in-session undo once you close and reopen a doc, so "fresh session on reopen"
  may be the right, expected behavior — but a card the user closes and reopens
  rapidly during prep is a different rhythm than opening a long-form doc, so
  it's worth a deliberate decision rather than an accident of the editor's
  lifecycle.
- **Why it's an exploration, not a bug.** Verified 2026-06-04: this is expected
  editor-instance behavior, NOT a defect and NOT caused by the workspace
  undo system. The three focus-routing tests all passed (history survives blur +
  direct refocus); history only resets on the close/switch remount. There is no
  correctness or data-loss issue — saved content always reloads intact. The
  decision is product/UX: is in-session-only editor undo acceptable, and if not,
  what would persistence even mean (replay a stored edit stream? snapshot
  diffing?) given the source of truth is the saved block JSON, not the editor's
  transient history.
- **Notes.** Surfaced 2026-06-04 while verifying that the E5 undo-cleanup work
  does not threaten BlockNote undo — it does not; E5 touches none of the editor,
  shortcut, or Realtime code involved here. Logged as a separate concern so E5
  stays scoped.
- **Dependencies.** None. Independent of E5 and of the workspace undo system.
- **Size:** S (decision) → M–L (if persistence is pursued — crosses BlockNote
  document state + a new persistence shape).

---

## Process habits

- **Estimates are honest, not inflated.** If an item says S, it really is
  < 1 day; if it says XL, it really does need a spike and a multi-sprint
  commit.
- **Dependencies are tracked explicitly.** Tailor Card Types depends on
  Manage Card Templates (you can't tailor what you can't manage). AI
  Card Creation depends on Tailor Card Types (it needs a structured
  target) and on undo / redo (AI output is bad sometimes; users need
  an out — undo / redo is shipped). @-mention parsing depends on
  Typed Connections (it builds inline-link UI on top of the relationship
  schema). Markdown export should ship before AI Card Creation (data
  ownership before AI lock-in concerns surface). Don't reorder against
  the dependency graph.
- **Discovery items get a spike, not a sprint commitment.** The spike
  output becomes the basis for "should we commit a sprint to this?"
- **Each sprint review:** drop done items into CHANGELOG, re-rank what's
  left, surface anything new from the build experience. Update this doc.

---

## Recently shipped

See [`CHANGELOG.md`](./CHANGELOG.md) for what's already in production.
