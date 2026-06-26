# ADR-0009: Behavioral analytics + session replay, scoped to invited testers via PostHog
Date: 2026-05-11
Status: Accepted (ships at the start of the current sprint, before tester invites)

> **Terminology note (post-2026-05-18):** This ADR predates ADR-0012's `campaign` -> `workspace` rename. References to "campaign(s)" / `campaign_id` here describe the architectural object now called "workspace" / `workspace_id`. The decision content remains accurate; only the names changed.
>
> **Launch-posture note (2026-06-24):** The "revert `is_test_user` before public launch + build a tester allowlist" guidance and the invite-conversation-only consent model below are **superseded for the Mox free-beta stage by [ADR-0017](./0017-mox-free-beta-launch.md)**. For that stage, recording stays ON for free beta users under **disclosed in-app consent** (in-flow notice + Terms/Privacy clickwrap), and `is_test_user` keeps its migration-005 default of `true`. The analytics tooling, named-event set, identification, and password masking in this ADR still stand. The revert-and-allowlist plan applies only to a future *fully public, non-capped* launch.

## Context

Erik plans to invite ~5–10 DMs as testers within the next two weeks.
The express goal of that invite cycle is **research**, not growth. The
research questions Erik most wants the data to inform — from the
2026-05-11 planning conversation — are about *cognitive experience*,
not feature usage:

- Do people naturally understand the graph mental model, or do they
  keep trying to force folder/document thinking onto it?
- At what point does a campaign begin to "feel alive" to them?
- Where do they become cognitively overloaded?
- Is MasterMind making worldbuilding and session prep easier? If so,
  how, when, and why? Harder? If so, how?
- What behaviors emerge that we didn't anticipate?
- Does the tool support or disrupt creative flow during worldbuilding?
- How do organizational methods evolve as the graph grows?

The biggest product risk *isn't* "did testers click feature X enough"
— it's "do real DMs build the right cognitive relationship with the
graph paradigm at all?" Vanity-metrics dashboards would answer the
wrong question.

Erik specifically called out friction signals he wants surfaced:
excessive panning, repeated zoom in/out (thrash), frantic
repositioning, abandoned connection attempts, abandoned data update
attempts, rage clicks, high undo frequency, constantly opening/closing
cards, and observable struggles with spatial organization.

Two adjacent observations shape scope:

- **Erik is too fluent a user to be in the default analytics pool.**
  His power-user behavior would swamp the average and distort the
  baseline. But he should be able to flag *himself* in for explicit
  stress-testing or exploratory design sessions.
- **The product captures creatively meaningful, sometimes personal
  content** — character arcs, hidden lore, homebrew settings, story
  spoilers. Session replay literally captures the screen. Trust with
  testers is a real concern; broad anonymous tracking is the wrong
  framing for this stage.

Live observational research on Zoom/Meet runs alongside this work —
Erik plans to watch real DMs think with the tool, ask follow-up
questions, and correlate observation with conversation. Analytics is
the *support* layer for that qualitative work, not a replacement.

## Decision

Integrate **PostHog Cloud (free tier)**. Enable session replay and a
small set of named events. Limit recording to **invited testers
only**, identified by a new flag on `public.profiles`. Frame consent
through the invite conversation, not via an in-app modal.

### Tool choice — PostHog Cloud, free tier

Free tier includes 1M events + 5K session recordings per month,
heatmaps, rage-click detection, and funnel analytics — sufficient for
a friend-sized pool by a wide margin. Self-hosted PostHog and
Mixpanel/Amplitude were considered; self-hosted adds infrastructure
overhead, and Mixpanel/Amplitude bundle session replay only on paid
tiers. PostHog Cloud is the lowest-friction option for a small-pool
research stage.

If/when the user base grows beyond what the free tier supports, the
move to a paid plan is straightforward; the data model doesn't have
to change.

### Scope — invited testers only

Add a new column to `public.profiles`:

```sql
alter table public.profiles
  add column is_test_user boolean not null default false;
```

The PostHog SDK initializes only when `profile.is_test_user === true`.
When the flag is false, PostHog is never loaded, never identifies the
user, never records a session. There is no opt-in toggle in user
settings, no in-app consent modal, no anonymous analytics layer for
non-testers.

**Default value during the invite-only stage.** Migration 004 introduced
the column with `default false`, then migration 005 flipped the default
to `true`. The reasoning: while sign-ups are invite-only — the URL is
shared person-to-person with consent up front — anyone who signs up IS
an invited tester, and recording from session one matches reality.
Existing rows (including Erik's, created before migration 004) keep
their original `false` value; Erik flips himself in for specific
exploratory sessions and back out when done, so his power-user behavior
stays segmented from the real tester data.

**Revert before public launch.** The moment the app opens to non-invite
sign-ups, migration 005's default must be reverted to `false` and a
real allowlist mechanism added (a small `tester_emails` table the
`handle_new_user` trigger checks against). Captured in migration 005's
header for forward-looking visibility.

### Identification

When PostHog initializes for a test user, the user is identified by
their Supabase `auth.uid` so that:

- A live observation session on Zoom can be correlated with the
  corresponding PostHog session replay afterward.
- Follow-up qualitative conversation ("you paused on card creation
  at 12:43 — what were you trying to do?") becomes possible against
  concrete recordings.

Without identification, the research budget would be spent watching
anonymous sessions and guessing whose they were. Identification is
essential to the methodology, and is consented to during the invite.

### Session replay

Session replay is the primary signal source. The friction patterns
Erik most wants to observe (cognitive overload, "wait, how do I
organize this?" hesitations, struggles with spatial organization,
abandoned attempts) are inherently behavioral and qualitative;
they're easy to spot in a 90-second clip and nearly impossible to
detect with event counts alone.

**What's recorded.** Everything the tester does on the canvas is
captured, including the actual content they type into cards (titles,
summaries, bullet lists, text annotations) and the text they put into
freestanding text annotations. This is intentional: the research
questions are about *how DMs build campaigns*, which means the words
they use to describe characters, the way their lore evolves, and the
iteration patterns on their writing are themselves signal. Hiding
that content would amount to watching DMs work with a black bar over
their writing — defeats the point.

**The one exception: passwords.** No password — current or future
new password — is ever recorded. Three layers of protection apply:

- The sign-in screen is rendered *before* the profile loads, which is
  *before* PostHog initializes. The login form is therefore never in
  any recording, full stop.
- For any password field that may exist inside the app in the future
  (e.g., a "change password" form), PostHog's default behavior auto-
  masks any input of type `password`. As long as those fields use the
  standard HTML password input type — which they must, in order for
  browsers to show black dots and for password managers to work — the
  values are blurred in replays automatically. No per-element work
  required.
- On sign-out, PostHog is reset (the running session is closed and
  the identified user is forgotten). If a different user signs in on
  the same browser, their sign-in screen is also not recorded, for
  the same reason as above.

Avatar images are recorded; they're often public reference imagery,
not original creative content.

### Named events

A deliberately small set (~10–15) tied to the specific friction
patterns Erik called out. Not a kitchen sink of every interaction —
each event answers a specific research question.

| Event | Question it informs |
|---|---|
| `card_created` | Card-creation cadence; does it match the "feels alive" inflection? |
| `card_edit_opened` / `card_edit_closed` | Open/close churn (one of Erik's friction signals) |
| `card_deleted` | Pruning behavior vs. accretion |
| `connection_started` | User intent to connect |
| `connection_completed` | Successful connection |
| `connection_abandoned` | Drag released *not* on a valid target — Erik's friction signal |
| `connection_deleted` | Reorganization vs. mistake recovery |
| `zoom_changed` (debounced) | Zoom thrash patterns |
| `pan_burst` | >N pan events in <T seconds = excessive panning signal |
| `undo_invoked` / `redo_invoked` | High undo frequency = friction signal |
| `text_node_created` | Annotation vs. card-only behavior |
| `right_click_menu_opened` | Discovery vs. ignored affordance |
| `card_repositioned_quickly` | Cards moved within N seconds of being placed = "I dropped it wrong" |
| `card_type_changed` | Type-classification confusion |

Rage clicks are captured automatically by PostHog's autocapture and
don't need a custom event.

Pan burst and `card_repositioned_quickly` use small client-side
windowing logic (debounced/thresholded) before firing — the goal is
to surface *patterns*, not raw movement noise.

### Consent

Consent happens during the invite conversation, human-to-human. The
invite explicitly says:

- You're being invited to an early research program.
- Your sessions will be recorded so I can review them after our
  conversations.
- The recordings capture everything you do in the app, including the
  actual content you type into cards and text annotations. The single
  exception is your password, which is never recorded.
- You can opt out at any time and your data will be deleted from
  PostHog.

No in-app modal, no terms-of-service-style flow. The framing is
"you're helping me build this; I want to watch how it goes" —
trust-first, not legal-first. That framing matches the stage and
the audience (friends, not strangers).

Long-term, as the product matures past the research stage, this
ADR is expected to be superseded by a broader analytics policy with
disclosed in-app consent.

### What this is *not*

This ADR explicitly does **not** include:

- Anonymous tracking of non-tester users (none collected).
- An opt-in toggle in user settings (none exposed).
- Funnel optimization or conversion-rate analytics.
- Cohort analysis for marketing.
- Any third-party data sharing.
- A/B testing infrastructure.

If the product later needs any of these, they require their own
decision and their own consent model.

## Consequences

**Benefits.**

- **Research signal aligned with research questions.** Recording the
  ~10 testers who matter, not the noise of any-and-all sign-ups.
  Replays of cognitive friction are directly observable.
- **Trust preserved.** Testers know they're being recorded and why,
  including that the content they type is recorded along with the
  interaction. No silent surveillance, no surprise about scope.
- **Operationally cheap.** Free tier handles the load. No backend
  infrastructure; PostHog SDK is a single client-side dependency.
  Adding/removing testers is a one-row Supabase update.
- **Erik can self-flag in for specific exploratory sessions** without
  poisoning the baseline tester data — segmenting `is_test_user=true`
  by user id keeps his data identifiable and filterable.
- **Foundation for evidence-based onboarding.** The patterns surfaced
  in the first observation cycle directly inform the onboarding work
  (see BACKLOG: *Onboarding + first-session scaffolding*).

**Trade-offs accepted.**

- **No data on non-tester users.** If a non-tester somehow gets to
  use the product, no signal is captured. Accepted because the
  current scope is "research with invited testers," not "growth
  with public users."
- **Identification is required, not opt-in.** A test user can't
  participate anonymously. Accepted because pseudonymous data would
  defeat the purpose of correlating live observation with replays.
- **PostHog vendor dependency.** If PostHog changes pricing,
  policies, or shuts down, we'd need to migrate or replace. Risk
  is bounded — the event list is small and the SDK is replaceable.
- **One-week-of-recording quota.** 5K recordings/month is plenty for
  10 testers at typical session frequency, but if recording length
  per session is unusually long (a tester doing a 3-hour worldbuilding
  marathon), quota math should be revisited.

**When to revisit.**

- After the first observation cycle (4–6 weeks), review whether the
  named-event set is the right one. Drop events that haven't been
  useful; add events that observation showed we wished we had.
- If/when the product opens to non-tester users, replace this ADR
  with a broader analytics policy that includes disclosed consent
  and clear data retention rules.
- If a tester reports discomfort with recording at any point, pause
  their `is_test_user` flag and discuss before resuming.

## References

- BACKLOG entry: *Behavioral analytics + session replay (PostHog)* —
  implementation work, ships first in the current sprint.
- BACKLOG entry: *Zoom-to-node-view v1* — depends on analytics
  shipping first (insurance against zoom-v1 estimate slipping).
- BACKLOG entry: *Onboarding + first-session scaffolding* — the
  evidence-based design work this ADR enables.
- 2026-05-11 planning conversation between Erik and Claude (this
  ADR captures the decisions reached there).
- Related: research methodology framed in
  [`docs/product/vision.md`](../product/vision.md) — the "feels alive"
  transition is the central qualitative outcome the analytics work
  supports.
- Related: [Known Divergences](../../CLAUDE.md) — `is_test_user` is a
  new field on `public.profiles`; the migration adds one column to
  the same table introduced by migration 003.
