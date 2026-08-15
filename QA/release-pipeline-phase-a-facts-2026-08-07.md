# Phase A — Verified Facts Sheet

> **STATUS / READING ORDER (added 2026-08-13): Phase A COMPLETED 2026-08-13.** The
> 2026-08-07 walkthrough and 2026-08-08 P3 sections below are **dated historical
> snapshots** of pre-execution state. When facts conflict, the **later dated evidence
> controls — especially the "Phase A as-executed" section appended at the end**, which is
> the canonical current reference (canonical identifiers, end state, discrepancies,
> corrections). This file remains **uncommitted pending Erik's normal review**.

**Read-only dashboard walkthrough, 2026-08-07.** Erik signed in; Claude drove Vercel via browser
extension; GitHub/Supabase/PostHog read via Erik's screenshots. **Nothing was changed, created,
saved, or triggered on any service.**

Evidence labels used below:
- **[DASH]** — direct dashboard observation (screenshot evidence in session transcript)
- **[REPO]** — CC-observed repo/local-file evidence
- **[API]** — read-only API query result (`gh` CLI)
- **[DOCS]** — official documented behavior (Vercel docs fetched 2026-08-07)
- **[VERIFIED]** — controlled empirical verification (two independent sources matched)
- **[INFER]** — inference; labeled with basis
- **[UNVERIFIED]** — still unverified; must not drive execution

---

## Vercel

| Item | Finding | Evidence |
|---|---|---|
| Plan | **Hobby** (team "erik-akaolie's projects") | [DASH] |
| Project | `mastermind-story-builder`, sole project | [DASH] |
| Production branch | **`master`** — seen in Settings → Environments → Production → Branch Tracking AND overview banner | [DASH] |
| Commit serving Production | **`52bacc3`** (docs(product): canonical Decision Tenet wording), deployed Aug 4, Ready — **equals local master tip** | [VERIFIED] dashboard + `git log` |
| Domains | One user domain: `mastermind-story-builder.vercel.app` → Production. "+2" on Environments page presumed system-generated aliases | [DASH]; +2 identity [INFER] |
| Env vars | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`: **All Environments** (single value each). `VITE_POSTHOG_KEY` (Sensitive): Production + Preview. `VITE_POSTHOG_HOST`: All Environments — **stale, retired in code 2026-07-28, inert; cleanup candidate** | [DASH]; staleness [REPO] |
| **Preview config holds real DB values today** | **YES (configuration-level).** Revealed `VITE_SUPABASE_URL` = `https://bplifhgblkokfvryodhv.supabase.co` = local `.env` value = production project. (Value is public-by-design — shipped in the production client bundle; anon key never revealed or recorded.) Actual runtime connectivity from a preview build was NOT empirically tested | [VERIFIED] config; connectivity [UNVERIFIED] |
| Preview deployments | Exist on Hobby (4 found: Jun 29, May 11×3); "No Active Branches" currently | [DASH] |
| Deployment protection | **Vercel Authentication ON, mode "Standard Protection"** (current, non-legacy). Protects all preview URLs + all generated deployment URLs (incl. historical production ones); production domain stays public | [DASH] mode; coverage [DOCS] |
| Protection extras on Hobby | Protection Bypass for Automation: available (no secret set). Shareable Links: available. Password Protection / Exceptions: Pro+$150/mo. Trusted IPs: Enterprise | [DASH] |
| Custom Environments | **Pro-only** ($50 per 5). Alpha must ride Preview + branch domain + branch env vars | [DASH] |
| Branch-specific preview env vars | Documented: a Preview var can target a specific branch; branch value overrides generic preview value. **No plan restriction stated.** Empirical confirmation deferred to setup | [DOCS]; Hobby availability [UNVERIFIED] |
| Branch domains ("Multiple preview phases") | Vercel's documented staging recipe = exactly the ratified Alpha model: staging branch + assigned domain + branch env vars, merge to production branch to ship | [DOCS] |
| Promote (preview → production) | **Available on Hobby** ("Promote to Production" active in preview deployment menu). Docs: this path performs a **complete rebuild with Production env vars** — "You cannot use your preview environment variables in a production deployment" | [DASH] presence; behavior [DOCS] |
| Staged production promote (no rebuild) | Exists via disabling "Auto-assign Custom Production Domains"; promoted build reuses its build. Hobby availability of that toggle | [DOCS]; Hobby [UNVERIFIED] |
| Instant Rollback | Button present on Hobby. **Hobby limit: can roll back only to the immediately previous production deployment.** No rebuild; env vars frozen as built. **After rollback, auto-deploy from pushes is OFF until Undo Rollback** | [DASH] presence; limits/behavior [DOCS] |
| Deployment retention | **30 days for ALL categories including Production** (then deleted; restorable for a further 30 days). Rollback/re-promote horizon is time-boxed | [DASH] |
| Tag pushes | Are **not expected** to trigger deployments, inferred from Vercel documentation describing branch-based Git triggers (tags unmentioned). **This remains unverified until Phase B.** The promote+tag model intends tags as inert markers | [INFER]/[UNVERIFIED] — inferred from documentation OMISSION, not directly documented or empirically tested (relabeled 2026-08-13; Phase B's tag work can provide controlled evidence) |
| Deploy hooks | None configured. (Deploy hooks can trigger branch deployments by URL if ever needed) | [DASH] |
| Git settings | Repo `erik-akaOlie/mastermind-story-builder` connected Apr 23; PR comments on; deployment_status + repository_dispatch on; LFS off | [DASH] |
| Usage (30d) | Edge requests 4.6K/1M; Fast data transfer 288 MB/100 GB. No constraint | [DASH] |
| Build times | ~24–31 s per deployment | [DASH] |

## GitHub

| Item | Finding | Evidence |
|---|---|---|
| Repo visibility | **PUBLIC**; default branch `master` | [API] |
| Branch protection today | **None configured** ("Classic branch protections have not been configured") | [DASH] (Erik's screenshot) |
| Available mechanisms | Branch rulesets + classic branch protection rules both offered | [DASH] |
| Enforcement on free plan | Works because repo is public (private repos would need GitHub Pro) | [DOCS] |

## Supabase

| Item | Finding | Evidence |
|---|---|---|
| Orgs / projects | One org (**JLtD**), one project (**MasterMind-StoryBuilder**, AWS us-east-2) | [DASH] |
| Plan | **Pro — deliberate** (Erik confirmed in session; upgraded a few weeks before 2026-08-07). Billing cycle 26 Jul – 26 Aug | [DASH] + Erik's decision |
| Compute | NANO instance, billed at Micro rate ($0.01344/h ≈ $9.86/mo, covered by Pro's $10 credit). **Free upgrade NANO→MICRO offered by dashboard — not taken (restarts DB; deliberate moment only).** Memory at 56%, CPU 9% | [DASH]; rate match [INFER] |
| **Production DB size** | **31.5 MB** (WAL 176 MB, system 444 MB; 0.64 GB used of 4 GB provisioned disk; auto-expands to 8 GB; spend cap ON). Size makes copy/restore operations promisingly small — speed/reliability proven only when actually performed | [DASH] |
| Storage (files) | **~0.10 GB** of 100 GB included | [DASH] |
| Backups | **Daily physical backups, 7 retained (Jul 31–Aug 7 all present), Restore buttons per day.** | [DASH] |
| **Backup gap** | **Storage objects are NOT in Supabase's backups** (page's own warning). No automated backup of images (card avatars, media gallery, covers) exists within Supabase; **no other backup is known or verified to exist**. Backblaze workstream must cover the Storage bucket explicitly | [DASH]; absence of other backups [UNVERIFIED] |
| Restore to new project | **BETA tab exists** — native path to a full disposable copy of production (relevant to disposable-DB workstream). Untested | [DASH]; efficacy [UNVERIFIED] |
| PITR | Tab exists; add-on not enabled | [DASH] |
| Disposable project cost | A second project draws compute beyond the $10 credit (~$10/mo if running; pausable) | [DOCS] |
| Usage vs quotas | Everything <1% (egress 0.083/250 GB, MAU 4/100k, realtime msgs 3,714/5M) | [DASH] |

## PostHog

| Item | Finding | Evidence |
|---|---|---|
| Current period usage | **6,554 events; 6,415 identified events; 99 recordings** | [DASH] (Erik's screenshot) |
| Free-tier headroom | 1M events + 5,000 recordings/mo included → <1% used. No pipeline constraint | [DOCS] |

## Key inferences now RESOLVED (were flagged "must not drive execution")

- Production branch = master → **CONFIRMED** [DASH]
- Live commit = master tip → **CONFIRMED** [VERIFIED]
- Preview env-scope contents → **CONFIRMED: previews receive production DB credentials today** [VERIFIED]
- Vercel-Hobby capabilities → promote ✓, rollback (1-step) ✓, Standard Protection ✓ (already ON),
  custom environments ✗ (Pro), password protection ✗ (Pro+add-on), branch env vars [DOCS]/[UNVERIFIED]

## Still-unverified items that gate specific runbook steps

Phase A status: every listed item was **investigated and classified** — not every behavior was
empirically verified. The unverified remainder:

1. Branch-specific env var UI actually offered on this project's plan (check during approved setup — it's the first thing the setup package would create).
2. "Auto-assign Custom Production Domains" toggle presence (only needed if the staged-promote variant is chosen over merge-to-gate-branch).
3. Supabase "Restore to new project" (beta) works as advertised (verify by doing, later, with approval).
4. The "+2" production domains' identity (assumed system aliases).
5. Actual runtime DB connectivity from a preview deployment (config verified; behavior untested).
6. Whether any backup of Storage objects exists outside Supabase (none known).

## Product-owner direction recorded 2026-08-07 (Erik)

**Vercel Hobby → Pro upgrade intended before the setup package executes.** NOT yet authorized —
it will be presented as its own separately enumerated paid external-service change (~$20/mo;
current price/billing terms to be verified immediately before the approval request). Rationale:
platform compliance (Hobby is personal/non-commercial; the beta funnels toward a paid tier) — not
comprehensive legal protection. Runbook treats **Pro as the intended operating plan**; planned
slot: **step 0 of the bounded setup package**, so plan-dependent behaviors (rollback depth,
retention, protection options) are verified once under the final plan. Pro notably extends
Instant Rollback from one-step (Hobby) to any eligible deployment [DOCS].

## P3 findings — post-Pro verification (2026-08-08, all read-only [DASH] unless noted)

- **Pro active** (team badge; billing cycle Aug 8 – Sep 8, 2026; $20.00 upcoming invoice;
  $0.00/$20.00 included credit used; a payment method on file — identifiers not recorded).
- **Spend Management:** On-Demand Budget toggle ON at **$15 — notifications only**
  ("Notifications: On", **"Pause Projects: Off"**; the "Pause Production Deployments" toggle
  exists and is OFF — if ever enabled, pausing makes all team projects publicly unavailable and
  requires manual resume). Webhook empty. Team-wide scope. Erik set $15 himself 2026-08-08.
  Notifications at 50/75/100% of budget [DOCS].
- **UNVERIFIED #1 → CLOSED (UI level):** Add-Environment-Variable dialog has a Branch section
  with "Select a Custom Preview Branch" — branch-pinned preview vars exist on this project.
  (Behavioral proof still lands at package step A20/A21.)
- **UNVERIFIED #2 → CLOSED:** "Auto-assign Custom Production Domains" toggle exists on the
  Production environment — currently **Enabled**. Model S's required switch is present.
- **UNVERIFIED #4 → CLOSED:** the "+2" production domains are the system aliases
  `…-git-master-erik-akaolies-projects.vercel.app` (branch alias — becomes the Preview
  environment's stable address after the flip) and `…-jswnhxrle-….vercel.app`
  (deployment-specific).
- **Instant Rollback (Pro):** dialog shows Previous as default target PLUS "Choose another
  deployment" — any-eligible rollback confirmed at UI level.
- **Custom Environments on Pro: 1 included, $0** ("1 included, 0 additional — Cost $0";
  additional $50 per 5).
- **Retention (Pro defaults, changed from Hobby's uniform 30 days):** Canceled 30 d · Errored
  90 d · Pre-Production 180 d · **Production 1 year**. Phase A's 30-day rollback-horizon
  concern is resolved.
- Remaining UNVERIFIED: #5 runtime preview connectivity (closes at A20/A21), #6 non-Supabase
  Storage backups (Backblaze workstream), and the A4-ordering dashboard behavior (documented
  in Vercel's error list; reordered sequence handles it either way).

## Corrections made during the session

- Claude initially flagged that a promoted preview would carry preview env vars; **Vercel docs
  contradict this for the preview-promote path** (full rebuild with production vars). Corrected in
  place; the concern applies only to the no-rebuild staged-promote path.

---

## Phase A as-executed — appended 2026-08-13 (CC; items verified on screen or in command output as they happened)

Executed under **FOUR approvals**, with **THREE stops**, each stop resolved by a reviewed
amendment before a fresh approval (full record:
`QA/release-pipeline-cutover-runbook-v5.3-2026-08-13.md` §0.5–§0.7):
1. **v5.2 (original PRE-4)** ran PRE-1→A9, then **stopped at A10**: Vercel's delete
   confirmation dialog is generic and contradicted the written expectation that it name
   the target's ID/address.
2. **First v5.3 approval** resumed at CP-1, then **stopped at CP-1**: the session's browser
   automation could not reach github.com, a required method deviation (resolved by the
   reviewed `gh api` / git-CLI substitution for CP-1/A14 — amendment -b).
3. **v5.3-b approval** ran CP-1→A14, then **stopped at A15**: creating `production-gate`
   at the already-built C0 produced no visible Vercel deployment (cause deliberately not
   asserted; resolved by amendment -c closing A15 on the narrow record).
4. **v5.3-c approval** ran CP-7→A28 to completion.

The master push freeze held continuously from the first PRE-4 message through exactly ONE
push (A23's `5acc5b9`). **With A27 explicitly passed (①–④, ⑥, ⑦ verified; ⑤ recorded
not-applicable) and all A28 deliverables in place (this append; ADR-0020 draft; CLAUDE.md
Release Pipeline section; BACKLOG entry), Phase A is COMPLETE.**

**Browser-tooling facts, stated separately:** (a) the github.com automation restriction is
what forced the reviewed CP-1/A14 method amendment; (b) the later supabase.com restriction
did NOT cause any amendment — A22 was completed through Erik's direct read-only dashboard
observation, and A24(a) through Erik's authenticated load of the alias. Operator-provided
evidence for observation steps is within the runbook as written, not a deviation. Domain
access for CC's automation remains an out-of-band follow-up.

**Recorded identifiers (canonical for future phases):**
- C0 = `52bacc3` (`52bacc35fa6ad923b82f19f7579ffbf95d856f28`); C0 tree `2b347f97b12ff…15ca`.
- P-ID (Production deployment, verified identical before/after the A17 flip):
  `Eu1r5aDjpQzPnPweqWiBnfhLRpfb` = `…-jswnhxrle-…`, commit C0, created Aug 4.
- A23 Preview deployment (first master build post-flip): `48TSmiLpYU6Txa6qcJrGgJdZa7KS`
  = `…-fow5bmrkt-…`, commit `5acc5b9` (empty commit, tree = C0's), serving the stable
  alias `mastermind-story-builder-git-master-erik-akaolies-projects.vercel.app`.
- Throwaway (A7/A8 fail-closed, retained in history): `AksNtpg7CUJnBjRezsgCCiqGoR1c`
  = `…-dvy5nmeze-…`, commit `65f7ef6`; its Git branch deleted at A14.
- GitHub rulesets (via `gh api`, exact JSON): `protect-release-branches` id 20819599;
  `protect-release-tags` id 20819712 — both `active`, `bypass_actors` `[]`.
- `production-gate`: at exactly C0; after its creation push, **no deployment was observed
  through CP-7 and no deployment address was recorded** (evidence-bounded observation;
  cause not asserted).

**End-state 2026-08-13:** Production Branch Tracking = `production-gate`; auto-assign
Custom Production Domains OFF ("deployments will need to be manually promoted"); env vars
= 3 data-bearing × (Production; Preview/`master`) + `VITE_POSTHOG_HOST` All Environments
(inert); T1–T4 deleted (approximately 30-day restore window beginning 2026-08-13). A27
matrix: public domain serves the app; Production-deployment-specific, master-alias, and
throwaway addresses = Vercel login wall; T1–T4 addresses AND both historical branch
aliases = `404: DEPLOYMENT_NOT_FOUND`, with zero Production-host requests during the
retired-address checks for T1–T4 and both historical branch aliases (A27④ and A27⑦).

**A22 audit (Erik's direct dashboard observation):** Site URL =
`https://mastermind-story-builder.vercel.app`; redirect allow-list = exactly
`https://mastermind-story-builder.vercel.app/**` + `http://localhost:5173/**`. In
MasterMind's current configuration and flows, auth emails (signup confirmation, recovery)
derive their links from the Site URL unless a flow explicitly supplies an allowed redirect
parameter matching the allow-list — no current flow does. The app's plain email+password
sign-in performs no redirect, so testing on the master alias needed no Supabase change.
Phase D revisits these values under its own proposal.

**Devices (Erik-performed, A25/A26):** desktop + Android + iPhone all verified read access
and the full reversible write cycle in workspace "Star Wars" (`PIPELINE-QA-VERIFICATION`
created → persisted → propagated to all three → deleted → absent on all three → all
sessions signed out). **Product-owner-accepted A25 procedural discrepancy [ERIK,
2026-08-13]:** approved order was desktop → Android → iPhone; ACTUAL order was desktop →
iPhone → Android, because Android was blocked by a GitHub sign-in failure (500 on any
github.com sign-in; GitHub status green; diagnosed as corrupted github.com cookies in
Android Chrome; resolved via an Incognito tab — no service or protection weakened). The
iPhone session was also closed earlier than instructed, then re-established for A26
step 3. Erik explicitly accepted the completed evidence as sufficient; the acceptance is
limited to this recorded discrepancy and does not normalize future deviations.
**A25/A26 must NOT be repeated.**

**Runtime-connectivity correction (closes historical UNVERIFIED #5 accurately):** A20/A21
proved branch-pinned CONFIGURATION and the final variable SCOPES only — not runtime
behavior. Actual Preview runtime connectivity to real data was empirically proved at
**A24–A26**: authenticated reads on all three devices plus the reversible write cycle,
through the master alias against the Production database.

**Phase B hard-proof qualification (matching the final runbook):** a genuinely NEW commit
pushed to `production-gate` has NOT yet been empirically proven to create a staged
Production deployment. Phase B's first rehearsal push is the hard proof point and MUST
stop if it fails.

**Next (each under its own approval):** Phase B rehearsal (first `prod-*` tag,
tag-ruleset verification, the production-gate deployment proof point above) → Local
isolation → Phase D domain transition → Backblaze backups → migration 016
rehearsal/proposal.
Out-of-band follow-ups for Erik, any time: clear github.com site data in Android Chrome;
migrate valuables out of the defunct espoc.com-managed Chrome profile; restore CC
browser-automation access to github.com / supabase.com.
