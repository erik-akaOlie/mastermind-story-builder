# ADR-0017: Mox free-beta launch — model, recording posture, and operations
Date: 2026-06-24
Status: Accepted (planning; implementation is tracked in BACKLOG.md and is **not yet built** — see "Implementation status" below)

> **Scope note.** The legal/tax/entity content below is **planning support, not legal or tax advice.** Points that need the City of Bellevue, WA Department of Revenue, WA Secretary of State, a CPA, or an attorney are flagged as such. No definitive legal/tax conclusions are recorded here.

## Context

MasterMind's V1 canvas is functional enough to put in front of real users. Erik is moving from "finish every V1 feature" to "learn from real usage." The first audience is a **free beta seeded through the Mox Boarding House Discord** (a local tabletop-RPG community). The goal is **controlled learning** — pain points, onboarding friction, product gaps — plus a real signal of word-of-mouth demand; it is explicitly **not** a growth push.

This is the first time people who were **not** personally invited can self-serve a signup. [ADR-0009](./0009-behavioral-analytics-session-replay.md) did not anticipate this stage. It assumed one of two postures: record **invited testers only** (consent via human-to-human invite conversation), or — at public launch — **revert `is_test_user` to false and build a tester allowlist.** The Mox beta is a third thing: a **capped free beta where recording stays on for all free users, under disclosed in-app consent** — which is exactly the "broader analytics policy with disclosed in-app consent" that ADR-0009 said would eventually supersede it.

This ADR records the launch-readiness decisions reached in the 2026-06-24 strategy session.

## Decision

### 1. Launch model
- **Capped open beta**, seeded via a Mox Discord launch post; anyone with the link can claim a seat while seats last.
- **~50 seats, treated as "50-ish"** (a soft cap), not an exact hard limit.
- **Soft cap with auto-flip + manual override:** a `beta_open` flag flips off automatically when the user count reaches the limit, and Erik can flip it manually (close early, or hold open). **No one is rejected mid-signup** because they clicked at the same moment as someone else; a few extra seats during the transition are acceptable.
- **Overflow waitlist** once seats are full (email + how-heard).
- **"How did you hear about MasterMind?"** on **both** the signup and the waitlist (dropdown + "Other"; **required** on waitlist, **optional** on signup to protect activation).

### 2. Recording posture — supersedes ADR-0009's public-launch guidance
- **Session recording remains ON for free beta users.** `is_test_user` stays default `true` (migration 005 is **not** reverted for this stage).
- **Consent shifts to disclosed in-app consent** (from ADR-0009's invite-conversation model): the existing single **Terms/Privacy clickwrap** + the Privacy Policy's session-recording disclosure, **plus a new in-flow plain-English recording notice on the signup screen** (decided here; **not yet built** — see BACKLOG).
- **One Terms/Privacy checkbox; no second recording-specific checkbox** unless legal review says the users' jurisdictions require unbundled consent. A separate checkbox would imply a *consent* legal basis inconsistent with the Privacy Policy's current *performance-of-contract* basis — **flagged for legal review**, not adopted by default.
- This **retires ADR-0009's "revert `is_test_user` before public launch + build a tester allowlist" assumption for the Mox free-beta stage.** That plan applies only to a future *fully public, non-capped* launch.

### 3. Cost & access controls (verified in-account / in-code)
- **PostHog billing limits set to $5 per product.** The free tier (5,000 web recordings/month) covers a ≤100-user beta; the cap is runaway insurance.
- **Erik is the sole PostHog org member** — the only person who can view recordings. (PostHog cannot restrict session-replay viewing per member, so sole org membership *is* the access control.)
- **Recordings auto-delete after 30 days** (PostHog retention; Erik-confirmed).
- **Account deletion removes the user's PostHog records** — verified: the `delete-account` Edge Function issues a PostHog person-delete with `delete_events=true`, alongside storage cleanup and the `auth.users` cascade.

### 4. Bot protection
- **No Turnstile/CAPTCHA initially.** Waitlist guards = unique email, email-format validation, insert-only access, and Supabase auth rate limits.
- **Escalate to an Edge Function + Cloudflare Turnstile on the waitlist only if** waitlist spam appears **or** the link spreads beyond the intended community. (Supabase's built-in CAPTCHA covers auth flows only; the waitlist is a plain table insert and would need its own server-side verification — that cost is why Turnstile-on-waitlist is an escalation, not a default.)

### 5. Support & feedback — email-first
- **Primary support/feedback channel: `contact.mastermind.lab@gmail.com`.**
- **Discord is for the launch post + light public replies only.** Bugs, account issues, privacy/deletion requests, and detailed feedback are **redirected to email.**
- **Public Discord redirect script:** *"Thanks for trying it. For bugs or account issues, please email contact.mastermind.lab@gmail.com so I can track it properly."*
- **Support expectation copy:** *"MasterMind is a solo-built beta. I read every message and respond as quickly as I can, but support is not 24/7."*
- Behavioral feedback comes from PostHog replays + named events. An **in-app Contact/Feedback link** (pre-addressed email) is decided as low-effort launch polish (**not yet built**).

### 6. Monetization stance
- **Freemium subscription is the leading hypothesis, NOT the decided business model.** (Market neighbors — Kanka, World Anvil, LegendKeeper — are freemium with low monthly tiers; the printable-variant paywall per [ADR-0005](./0005-image-storage.md) and "recording is the price of free" per the Privacy Policy are already-designed levers.)
- **The only thing locked for the beta is the promise:** *free early-access beta, future pricing may change, beta access is not a free-forever guarantee.* This must appear in the launch post + signup copy (decided; copy **not yet placed** — see BACKLOG).
- The actual tier/price is **deferred** until beta data shows retention and which features people would pay to unlock.

### 7. Entity posture (planning support only — not legal/tax advice)
- **The free beta does NOT require a resolved business entity.** It can run with Erik operating personally, consistent with the current legal docs.
- **Entity cleanup is parallel-URGENT but not a launch blocker.** The City of Bellevue past-due notices accrue penalties independent of launch, so they should progress on their own timeline. Verifying status spans three separate agencies — **WA Secretary of State** (LLC registration), **WA Department of Revenue** (state B&O tax account), and the **City of Bellevue Tax Division** (city license + B&O) — and closing one does not close the others.
- **Entity cleanup becomes a prerequisite before charging money** or before changing the legal docs to operate MasterMind through an LLC (rather than personally).
- **Where a professional/office is required:** the City of Bellevue Tax Division, WA DOR, and WA SOS for status and closure; a **CPA** for back/final B&O returns and any penalty abatement; an **attorney** if there are liabilities or for the close-vs-revive decision. This ADR records the posture only.

### Implementation status (decisions are not built)
**Decided here but NOT yet implemented** (tracked in BACKLOG.md; goes through the normal coding pipeline — scope → build → Erik browser-tests → commit):
- soft-cap + overflow waitlist + "how did you hear?" flow
- in-flow session-recording notice on the signup screen
- beta-promise copy placement (launch post + signup)
- email-first support placement + in-app Contact/Feedback link
- verification that Supabase email confirmation is enabled

**Already in place (verified):** the Terms/Privacy clickwrap + Privacy Policy session-recording disclosure; the $5 PostHog caps; sole PostHog org membership; 30-day recording retention; and account deletion that also wipes PostHog records.

## Consequences

**Enables.** Controlled learning from a real, warm community with bounded cost and support load, plus a genuine word-of-mouth signal (seats claimed + waitlist size).

**Supersedes (in part) ADR-0009.** The recording posture and public-launch gating in ADR-0009 are replaced for this stage; the analytics *tooling* it established — PostHog choice, the named-event set, user identification, and password masking — still stands unchanged.

**Trade-offs accepted.**
- The soft cap may overshoot ~50 by a handful during the transition — acceptable.
- Recording all free users unmasked is a deliberate, disclosed value-exchange, not an oversight.
- Email-first support trades ambient community feedback for the founder's ability to communicate well; PostHog replays backfill the behavioral signal.

**When to revisit.**
- If the link spreads beyond the intended community → escalate bot protection and reconsider gating.
- When monetization data arrives → the price/tier decision, gated on the entity prerequisite.
- If a **fully public, non-capped** launch is planned → a new ADR with a fuller analytics/consent and gating policy (the place ADR-0009's allowlist idea would actually apply).

## References
- **Supersedes (in part):** [ADR-0009](./0009-behavioral-analytics-session-replay.md) — recording posture + public-launch gating.
- Related levers: [ADR-0005](./0005-image-storage.md) (printable-variant paywall), [ADR-0013](./0013-product-positioning.md) (V1 positioning).
- Legal docs: [`docs/legal/privacy-policy.md`](../legal/privacy-policy.md) (§ Session Recording disclosure), [`docs/legal/terms-of-service.md`](../legal/terms-of-service.md) (content portability / export-on-request).
- BACKLOG: *Mox free-beta launch readiness* items (implementation work).
- 2026-06-24 launch-readiness strategy session (this ADR captures the decisions reached there).
