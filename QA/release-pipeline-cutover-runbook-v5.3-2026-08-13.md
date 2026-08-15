# Release-Pipeline Cutover Runbook — v5.3 (amended -b, -c) — FINAL AS-EXECUTED RECORD
**Status: PHASE A COMPLETED 2026-08-13.** All steps executed and verified under four
approvals (v5.2 PRE-4; v5.3; v5.3-b; v5.3-c) with three stops, each resolved by a reviewed
amendment. As-executed records: §0.5 (v5.2 run, PRE-1→A9), §0.6 (first v5.3 run, stopped
at CP-1), §0.7 (v5.3-b run, CP-1→A14, stopped at A15), **§0.8 (v5.3-c run, CP-7→A28 —
final)**. The procedural sections (§3.x) and their approval texts are preserved with
historical labels as the HISTORICAL approved procedure for auditability (step bodies
unchanged; headings carry executed/historical markers) — they are not current instructions;
no further execution is authorized by this document. Sections 4–7 (standing release
procedure R0–R5, rollback handling, Phase B, sequencing) remain forward-looking and
operative. This file remains uncommitted pending Erik's normal review. Supersedes v5.2
(and v1–v5.1). Self-contained.

**Amendment 2026-08-13-c (A15 deployment expectation corrected by observation).** Execution
under the 2026-08-13-b approval completed CP-1…A14 (all passed — §0.7) and stopped at A15:
the Git half succeeded (`production-gate` exists at exactly C0), but **no visible Vercel
deployment was created for the branch during the documented checks** — contradicting the
expected result, so execution stopped and that approval is VOID. This amendment records the
narrowly observed fact, marks A15's Git portion complete and its deployment portion as
having produced no deployment, replaces A27 ⑤ with an explicit not-applicable record, adds
a hard Phase-B proof point, and issues a new approval text whose execution boundary begins
with CP-7 (§3.6.5, read-only), followed by A16–A28 (§3.7). The branch is preserved as-is:
no empty commit, no forced deployment, no workaround.

**Amendment 2026-08-13-b (command-line substitution for the two GitHub steps).** The first
v5.3 approval was treated as VOID under the standing void rule when CP-1 could not be
executed as written: this Claude session's browser control cannot reach github.com (§0.6 —
a session-tooling limitation; GitHub itself remained fully available). This amendment
replaces the browser method with exact read-only `gh api` commands in CP-1 and an exact
command-line procedure in A14, records the out-of-runbook diagnostic that was run, and
issues a new self-contained approval text (§3.7). Every other step is unchanged.

**Why v5.3 exists.** Phase A execution under v5.2 began 2026-08-13 on Erik's PRE-4 approval
and completed PRE-1 through A9, with **one recorded evidence discrepancy at A8(b)** (§0.5 —
the fail-closed safety objective was achieved, but v5.2's "loud visible failure" wording was
not literally satisfied; continuation requires Erik's explicit acceptance). At A10, the
standing void rule fired: v5.2 required Vercel's delete confirmation dialog to name the
target deployment's ID/address, and the dialog observed on 2026-08-13 is generic — it
identifies no deployment at all [DASH]. Execution stopped before any deletion; the v5.2
approval is void. v5.3 makes these changes:

1. **A10–A13 corrected:** deployment identity is verified on the deployment's DETAIL PAGE
   (unique deployment ID in the URL and breadcrumb + deployment-specific address + commit +
   branch + date, all matching §2) BEFORE Delete is invoked. The generic dialog is recorded
   as expected behavior; a dialog that unexpectedly names a DIFFERENT deployment is a stop.
2. **§3.5 added — state-aware continuation preflight (CP-1…CP-6):** read-only verification of
   the completed A1–A8 state and a rerun of A9 before A10 executes. CP-5 records the exact
   current Production deployment ID; A17's before/after comparison uses that recorded ID.
3. **§3.7 added — exact new approval text and execution boundary**, including Erik's
   explicit acceptance of the A8(b) evidence discrepancy. The freeze-continuity fact (no
   master push has occurred; the freeze has been continuously active since the original
   PRE-4 message) is recorded in §0.5.
4. **A8(b) evidence record corrected (§0.5):** the observed failure mode is recorded
   exactly as observed, without overstating it.

Evidence: `QA/release-pipeline-phase-a-facts-2026-08-07.md` (incl. P3) + the deletion-target
inventory (read-only, 2026-08-08; §2) + the 2026-08-13 as-executed observations (§0.5).
Labels: [DASH] dashboard-observed · [DOCS] documented behavior · [REPO] repo evidence ·
[VERIFIED] empirically verified · [ERIK] Erik's decision.

**Standing void rule (unchanged): any observation contradicting an expected result STOPS
execution immediately, VOIDS the active approval, and is reported before anything else.
Recovery actions are NOT pre-authorized: on any stop, CC stops and reports; recovery executes
only on Erik's explicit go.**

---

## 0. Ratified decisions implemented (all [ERIK]) — unchanged from v5.2

D1 Model S (staged Production deployment validated before promotion; promoting a Vercel
Preview deployment rebuilds [DOCS] — never a substitute; a Model-S dependency failure → stop;
Model G would need a fresh decision + re-drafted runbook). · D2 branch-based Preview; the
Pro-included custom environment remains unused until a future, separately approved need
exists. · D3 `production-gate` advances fast-forward-only per approved release; deployment-
control branch; release record = Vercel Production history + successful `prod-*` tags + QA
record (tags are protected and operationally immutable — a repository administrator could
alter the ruleset itself, acceptable for a solo-owner system, with Vercel history + the QA
record as corroboration). · D4 simplified (generated master address for Preview; canonical
Production domain in Phase D). · D5 Local isolation before Phase D. · Spend Management $15
notifications-only, pause OFF. · Terminology: Preview environment ≠ "Vercel Preview
deployment" (technical category) ≠ staged Production deployment (never "Preview").

**Standing qualifications:** (1) 1-year Production retention [DASH] improves rollback
availability but does not eliminate rollback risk — every release names an eligible, retained,
compatibility-assessed rollback target (R0). (2) The generated master address qualification was
**SATISFIED at A24 (§0.8)**: the alias followed the first post-flip Preview deployment
(A23's) and remained protected behind Vercel Authentication.

## 0.5. As-executed record — 2026-08-13 (v5.2 run, PRE-1 → A9, stopped at A10)

**Freeze continuity: the master push freeze became effective with Erik's original PRE-4
approval message (2026-08-13) and has remained CONTINUOUSLY ACTIVE since. No push to
`master` has occurred at any point. The freeze does not need reactivation — the new
approval acknowledges its continuity and its end condition (A24) is unchanged.**

Completed steps, each verified on screen or in command output as it happened. Every expected
result matched **except A8(b)**, whose discrepancy is recorded below and requires Erik's
explicit acceptance in the new approval (§3.7):

| Step | Result |
|---|---|
| PRE-1 | Fresh clone created at `C:\Users\erik\projects\mastermind-release-ops` (directory verified absent first) |
| PRE-2 | Remote URL correct; `git status --porcelain` empty |
| PRE-3 | `origin/master` = **52bacc3** = C0 [VERIFIED]; live Production deployment sourced from master @ **52bacc3**, address `mastermind-story-builder-jswnhxrle-erik-akaolies-projects.vercel.app`, created Aug 4 [DASH] |
| PRE-4 | Approval message valid (verbatim approval + freeze + workspace name "Star Wars") |
| A1 | GitHub branch ruleset **protect-release-branches**: Active; targets `master` + `production-gate`; blocks force pushes + deletions; bypass EMPTY [DASH] |
| A2 | GitHub tag ruleset **protect-release-tags**: Active; patterns `prod-*` + `verification-release-tag-*`; blocks updates + deletions (Block force pushes also on — GitHub default, strictly additional); bypass EMPTY [DASH] |
| A3 | `VITE_SUPABASE_URL` → Production only [DASH] |
| A4 | `VITE_SUPABASE_ANON_KEY` → Production only [DASH] |
| A5 | `VITE_POSTHOG_KEY` → Production only; `VITE_POSTHOG_HOST` untouched (All Environments) [DASH] |
| A6 | Node.js version **24.x** [DASH]; `package-lock.json` present [REPO] |
| A7 | Branch `throwaway/env-check` pushed: one empty commit `65f7ef6`, tree = C0's tree, parent = C0 [VERIFIED]. Built as **Preview** [DASH] |
| A8 | Throwaway deployment ID **`AksNtpg7CUJnBjRezsgCCiqGoR1c`**, address **`mastermind-story-builder-dvy5nmeze-erik-akaolies-projects.vercel.app`**, branch alias `mastermind-story-builder-git-thro-8fdace-erik-akaolies-projects.vercel.app`. (a) signed-out → Vercel login wall, no app content [VERIFIED via session-less browser]; **(b) DISCREPANCY — see note below this table**; (c) zero requests to the prod host across load + navigation [VERIFIED]; (d) prod hostname absent from every loaded JS asset (`index-C-1uy3_V.js` 1,373,782 bytes; `feedback.js`); the only `supabase.co*` matches are two generic `supabase.com` documentation links [VERIFIED] |
| A9 | Preview-filtered list = EXACTLY T1–T4 + throwaway; each of T1–T4 matched §2 on ID, deployment-specific address, commit, branch, and date (verified by opening each deployment detail page by its §2 ID) [DASH] |

**A8(b) evidence discrepancy — recorded exactly as observed.** v5.2's expected result was a
"loud visible failure" after Vercel authentication. What was actually observed: the app's
HTML shell loaded (title "MasterMind OS") and the page rendered **blank** — no error message
visible on the page surface, no app UI, and no sign-in form. The startup exception ("Error:
Missing Supabase environment variables. Copy .env.example to .env and fill in
VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.") was observed in the browser's developer
diagnostics (console), not verified as visibly rendered on the page. **The fail-closed
safety objective WAS achieved**: no usable application, no sign-in form (a sign-in attempt
was structurally impossible), and zero requests to the Production Supabase host. **But the
literal "loud visible failure" wording was NOT satisfied by the on-page evidence.** This
discrepancy does not require redoing A7/A8 — the deployment it describes is the throwaway
verification deployment, whose purpose (proving empty-config Preview builds cannot reach
Production data) was met — but continuation past it is legitimate only with Erik's explicit
acceptance, which §3.7 makes a required component of the new approval message.

**Stop point:** A10, before any deletion. The delete confirmation dialog opened from T1's
detail page is generic boilerplate — it warns about instant-revert and integration links and
identifies NO deployment [DASH 2026-08-13]. v5.2's requirement "the dialog must name this
ID/address" is unsatisfiable in Vercel's current UI. The dialog was closed by Erik via
Cancel/Esc; **no deployment was deleted; T1–T4 and the throwaway all still exist** (to be
re-proven read-only in CP-4/CP-6 before A10 runs).

Steps NOT executed: A10–A28. No deletions, no branch deletion, no `production-gate` branch,
auto-assign untouched, no flip, no Preview(master) env vars, no Supabase audit, no master
push, no device sweep, no write cycle.

## 0.6. Amendment record — 2026-08-13-b (second stop, browser-control substitution)

Execution resumed 2026-08-13 under Erik's first v5.3 approval (all five components present)
and progressed read-only before stopping again:

- **Executed under that approval, all read-only, all passed:** CP-3 in full (five commands:
  clean clone; fetch ok; branch tip `65f7ef6`, full hash
  `65f7ef63af76f2916227be612de831b662719036`; parent = C0
  `52bacc35fa6ad923b82f19f7579ffbf95d856f28`; tree `2b347f97b12ff472e5fb435e0ae72966bf3e15ca`
  = C0's tree) and the Git half of CP-5 (`git rev-parse origin/master` = C0). No external
  change of any kind.
- **CP-1 could not be executed as written:** this Claude session's browser control returned
  "Navigation to this domain is not allowed" for github.com (instantly, with no approval
  prompt shown to Erik), while vercel.com navigation worked normally. **GitHub itself was
  never unavailable** — Erik's own browsing reached GitHub pages throughout; the limitation
  is confined to the session's browser-automation permission for that one domain. A Chrome
  profile complication (the previous automation profile was managed by a defunct employer
  account) was resolved by Erik switching to his personal Chrome profile; the github.com
  automation block persisted in the new profile, so it is a session-level rule, not a
  profile problem.
- **Out-of-runbook diagnostic, recorded honestly:** CC ran `gh auth status` (read-only,
  outside the approved verbatim steps) to assess a fallback path. It reported the GitHub
  command-line tool authenticated as **erik-akaOlie** (scopes incl. `repo`) and made no
  external change. No other out-of-runbook command was run.
- **Stop + void:** needing a method other than the one written is a required deviation, so
  the first v5.3 approval was treated as VOID. The master push freeze remained continuously
  active throughout — still zero pushes to `master` since the original PRE-4 message.

This amendment substitutes the command-line method into CP-1 and A14 (the only two steps
that touch GitHub's web interface). Rationale: the `gh` tool addresses rulesets and branches
by exact name/ID rather than by on-screen position, which removes misclick risk entirely and
returns the raw configuration as evidence. Resolving the browser-automation limitation is
deferred until after Phase A [ERIK, via advisory review].

## 0.7. As-executed record — 2026-08-13-c (third run: CP-1…A14 complete, stopped at A15)

Executed under Erik's 2026-08-13-b approval (all five components present). Consolidated
evidence, each item verified in command output or on screen as it happened:

- **CP-1 [VERIFIED via `gh api`, read-only]:** exactly two rulesets. Branch ruleset id
  **20819599** returned: `name`=`protect-release-branches`, `target`=`branch`,
  `enforcement`=`active`, **`bypass_actors`=`[]` (present and exactly empty)**,
  `include`=`["refs/heads/master","refs/heads/production-gate"]`, `exclude`=`[]`,
  `rule_types`=`["deletion","non_fast_forward"]`. Tag ruleset id **20819712** returned:
  `name`=`protect-release-tags`, `target`=`tag`, `enforcement`=`active`,
  **`bypass_actors`=`[]`**, `include`=`["refs/tags/prod-*","refs/tags/verification-release-tag-*"]`,
  `exclude`=`[]`, `rule_types`=`["deletion","non_fast_forward","update"]`. All values match
  the expectations exactly; no extra rule types.
- **CP-2 [DASH]:** env-var table exactly as required — `VITE_POSTHOG_KEY`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL` each scoped **Production** only;
  `VITE_POSTHOG_HOST` All Environments; no other variables.
- **CP-3 [VERIFIED]:** clean clone; fetch ok; branch tip `65f7ef63af76f2916227be612de831b662719036`;
  parent = C0; tree `2b347f97b12ff472e5fb435e0ae72966bf3e15ca` = C0's tree.
- **CP-4 [DASH]:** Preview-filtered list = exactly 5 (throwaway + T1–T4) — proof nothing was
  deleted during the interruptions.
- **CP-5 [VERIFIED + DASH]:** `origin/master` = C0. Production deployment detail page:
  **P-ID = `Eu1r5aDjpQzPnPweqWiBnfhLRpfb`**, commit `52bacc3`, address
  `mastermind-story-builder-jswnhxrle-erik-akaolies-projects.vercel.app`, created Aug 4,
  Environment=Production Current. P-ID successfully recorded — A17's comparison value.
- **CP-6 [DASH]:** throwaway deployment `AksNtpg7CUJnBjRezsgCCiqGoR1c` present, Preview.
- **A9R [DASH]:** T1–T4 each re-verified on its detail page — ID, address, commit, branch,
  date all matching §2.
- **A10–A13 [DASH]:** four deletions, each per the corrected identity procedure (five
  identifiers verified on the detail page before Delete; generic dialog as expected), each
  verified by list refresh. **After A13: only the throwaway remains in the Preview list** —
  T1, T2, T3, T4 all gone, throwaway intact at every intermediate check.
- **A14 [VERIFIED + DASH]:** pre-deletion `ls-remote` printed exactly
  `65f7ef63af76f2916227be612de831b662719036  refs/heads/throwaway/env-check`; deletion
  accepted; post-deletion `ls-remote` printed nothing; **the throwaway Vercel deployment
  remained listed after the branch deletion** (protected fail-closed remnant, per [DOCS]).
- **A15 — Git portion COMPLETE [VERIFIED]:** `git push origin 52bacc3:refs/heads/production-gate`
  accepted; `ls-remote` confirms `refs/heads/production-gate` at exactly C0.
  **Deployment portion: PRODUCED NO DEPLOYMENT.** Verified fact, stated narrowly: creating
  `production-gate` at the already-built C0 produced **no visible Vercel deployment during
  the documented checks** (~60s of waiting; list refreshed; status filter widened to all
  7 statuses including Canceled; no entry of any status for the branch). The possible
  explanation (Vercel skipping builds for a new branch pointing at an already-deployed
  commit) is an **UNVERIFIED INFERENCE** — other integration or timing causes have not been
  ruled out. Execution stopped; the 2026-08-13-b approval is void.

**Scope of the A15 exception — deliberately narrow:** this recorded no-deployment outcome
applies ONLY to the initial creation of `production-gate` at the already-built C0. It must
NOT normalize missing deployments later. **Hard proof point added to Phase B (§6): the first
push of a genuinely new approved commit to `production-gate` MUST create the expected staged
Production deployment, or execution stops.**

## 0.8. FINAL as-executed record — 2026-08-13 (fourth run under the v5.3-c approval: CP-7 → A16 → A28, completed)

Erik's v5.3-c approval contained all five required components (§3.7). Every step executed
and verified; no stops. Evidence labels as elsewhere; "Erik-observed" = Erik's direct
observation reported in-session for steps whose text does not prescribe the operator.

- **CP-7 (read-only continuation check) — ALL PASS:** (a) `git ls-remote` printed exactly
  `52bacc35fa6ad923b82f19f7579ffbf95d856f28  refs/heads/production-gate` [VERIFIED];
  (b) with all 7 statuses visible incl. Canceled, NO deployment of any status existed for
  `production-gate` — no delayed build had appeared [DASH]; (c) Production deployment
  detail page: ID exactly **P-ID `Eu1r5aDjpQzPnPweqWiBnfhLRpfb`**, commit C0 [DASH].
- **A16:** "Auto-assign Custom Production Domains" toggled OFF and saved; page confirmed
  "Disabled" + Vercel's note "Production deployments will need to be manually promoted"
  [DASH].
- **A17 (THE FLIP):** immediate pre-flip read: Production deployment = P-ID/`…jswnhxrle…`/
  C0/Aug 4. Branch Tracking changed `master` → `production-gate`, saved ("Every commit
  pushed to the production-gate branch will create a Production Deployment"); auto-assign
  remained Disabled. Immediate post-flip reads (Overview + P-ID detail page): Production
  deployment ID **identical to P-ID before and after**; banner "push to the
  production-gate branch"; P-ID page still "Production — Current". Expected side effect
  observed: the Active Branches widget now classifies `master` as a Preview branch [DASH].
- **A18–A20:** three variables added, each Environments=Preview with Custom Preview Branch
  `master` (the selector offered `master` post-flip, as [DOCS] predicted): `VITE_SUPABASE_URL`
  and `VITE_SUPABASE_ANON_KEY` non-sensitive (matching their Production rows),
  `VITE_POSTHOG_KEY` Sensitive (matching its Production row; value sourced from Erik's
  local `.env`). No redeploy triggered from the env-var toasts [DASH].
- **A21 — PASS:** final table exactly 7 rows: the three data-bearing vars ×2 (Production;
  Preview/`master`) + `VITE_POSTHOG_HOST` All Environments (inert). No Production-data-
  bearing variable in general Preview or Development [DASH].
- **A22 (read-only; Erik-observed):** Site URL `https://mastermind-story-builder.vercel.app`;
  redirect allow-list exactly `https://mastermind-story-builder.vercel.app/**` +
  `http://localhost:5173/**`. Documented flow analysis: in MasterMind's current flows,
  auth emails derive links from the Site URL unless a flow supplies an allowed redirect
  parameter (none currently does); plain email+password sign-in performs no redirect, so
  the master alias needed no Supabase change. No configuration was modified.
- **A23 (the single permitted freeze-window push):** in the clone, master ff-verified at
  C0; empty commit **`5acc5b9`** created (tree = C0's tree `2b347f97b…15ca`, parent = C0
  — both [VERIFIED] pre-push); pushed. Vercel built it as **Preview** [DASH]: deployment
  **`48TSmiLpYU6Txa6qcJrGgJdZa7KS`**, address `…-fow5bmrkt-…`, with the generated alias
  `mastermind-story-builder-git-master-erik-akaolies-projects.vercel.app` attached (the
  standing qualification about the alias following the first post-flip Preview deployment
  PROVED). Production deployment ID unchanged (= P-ID; re-read on its detail page) [DASH].
- **A24 — PASS; THE MASTER PUSH FREEZE ENDED HERE, only after (a) AND (b) both passed:**
  (a) authenticated load of the alias (Erik-observed) served the real A23 application —
  MasterMind sign-in, then Erik's actual workspace library from the Production DB —
  corroborated by the alias appearing in the A23 deployment's Domains list [DASH];
  (b) signed-out (session-less browser): the alias redirected to Vercel's login wall,
  no app content [VERIFIED]. Freeze summary: continuously active from the original PRE-4
  message; exactly ONE master push in the whole interval (A23's `5acc5b9`).
- **A25 (Erik-performed) — PASSED on all three devices, with ONE PRODUCT-OWNER-ACCEPTED
  PROCEDURAL DISCREPANCY [ERIK, 2026-08-13]:** the approved step specified the order
  desktop → Android → iPhone and "do not sign out yet." The ACTUAL order was **desktop →
  iPhone → Android**, because Android was initially blocked by a 500 error on ANY GitHub
  sign-in (GitHub status green; device-local — diagnosed as corrupted github.com cookies
  in Android Chrome; resolved via an Incognito tab, a clean cookie jar — **no service or
  protection weakened**, per A25's own PAUSE-and-present-alternatives branch). The iPhone
  session was also closed earlier than the instruction specified, then re-established for
  A26 step 3. **Erik's explicit acceptance:** the completed evidence is sufficient —
  all three device checks passed, no protection was weakened, A26's temporary node cycle
  completed and was fully reversed, and all sessions were ultimately closed. This
  acceptance is limited to this recorded Phase A discrepancy and does not normalize
  future deviations. **A25/A26 are NOT to be repeated** — a repeat of the Production-data
  write cycle would add risk without meaningful evidence. All three devices opened
  workspace "Star Wars" and one node read-only.
- **A26 (Erik-performed, exact sequence) — PASS:** (0) precheck: no `PIPELINE-QA-VERIFICATION`
  node existed; (1) created on desktop; (2) desktop reload → persisted; (3) visible on
  Android and iPhone; (4) deleted on desktop; (5) absent on all three after reload;
  (6) signed out of MasterMind and Vercel on all three devices, tabs closed. The single
  temporary Production-data mutation of Phase A, fully reversed.
- **A27 — PASS on all applicable items** [VERIFIED, session-less browser]: ① public
  domain serves the app (sign-in screen); ② `…jswnhxrle…` → Vercel login wall; ③ master
  alias → login wall; ④ T1–T4 addresses → `404: DEPLOYMENT_NOT_FOUND`, no content, no
  wall (so the authenticate-and-recheck clause had nothing to apply to); ⑤ not applicable
  per amendment -c (no A15 deployment/address was observed or recorded through CP-7); ⑥ throwaway `…dvy5nmeze…` → login wall
  (protected fail-closed remnant); ⑦ both historical branch aliases (`…git-docs-e79f96…`,
  `…git-clau-0af300…`) → `404: NOT_FOUND`, no content, no wall. Zero Production-host
  requests during the retired-address checks (④ and ⑦; ① intentionally loads the
  production app and is excluded from that claim).
- **A28 — deliverables produced (all uncommitted pending Erik's normal review):** this
  §0.8 record + the Phase A as-executed append in
  `QA/release-pipeline-phase-a-facts-2026-08-07.md` + ADR-0020 draft
  (`docs/decisions/0020-release-pipeline-cutover.md`) + CLAUDE.md "Release Pipeline"
  section + BACKLOG launch-queue entry.

**Phase B hard proof qualification (restated so this record cannot be over-read):** a
genuinely NEW commit pushed to `production-gate` has NOT yet been empirically proven to
create a staged Production deployment. That proof lands at Phase B's first rehearsal push
(§6) and is a stop condition if it fails.

## 1. HISTORICAL pre-execution fixed facts (as verified before/at approval time — preserved for audit; several are superseded by execution: `origin/master` is now `5acc5b9` after A23, and auto-assign is now Disabled after A16. **Current end state: §0.8**)

- **C0 = `52bacc3`.** CP-5 re-verifies BOTH `origin/master` and the live Production
  deployment sit exactly at C0. **Any mismatch → STOP; the package is re-drafted with a new
  C0 and re-approved. C0 is never redefined during execution.**
- Pro active; Standard Protection + Vercel Authentication ON; branch-pinned env-var UI;
  auto-assign toggle (Enabled); any-eligible Instant Rollback; retention Production 1 yr /
  Pre-Prod 180 d — all [DASH].
- Env-var changes affect only new deployments [DOCS]. Deleting a Git branch does NOT delete
  its Vercel deployments — deployment-specific URLs remain in history until deletion or
  retention [DOCS].
- [REPO]: no hard-coded Supabase hostname in `src/`; no server-side application code (`api/`
  absent). Precise claim: **the application has no server-side route to Supabase; its only
  Supabase path is the env-configured browser client** (`/relay` proxies PostHog analytics
  only).
- Release-ops clone: `C:\Users\erik\projects\mastermind-release-ops` (exists; created in
  PRE-1 on 2026-08-13).
- **NEW [DASH 2026-08-13]: Vercel's delete-deployment confirmation dialog is generic. It
  does not name the target deployment's ID or address. Target identity lives on the
  deployment DETAIL PAGE: unique deployment ID in the URL and breadcrumb + deployment-
  specific address + commit + branch + creation date.**

## 2. HISTORICAL deletion-target inventory — **T1–T4 WERE DELETED at A10–A13 on 2026-08-13** (inventory read 2026-08-08 [DASH]; identity re-verified per-page and deleted 2026-08-13 [DASH]; entries preserved solely as the identity/audit record — end state in §0.8 and A27)

All four are Environment=Preview (never served production domains → not rollback targets
[DOCS]); each was built with real DB configuration [VERIFIED config]; all are obsolete.
Deletion recovery: Vercel restores recently deleted deployments for ~30 days (Settings →
Security → Recently Deleted) [DOCS/DASH]; recovery is not pre-authorized.

| Target | Deployment ID | Deployment-specific address | Commit | Branch | Created |
|---|---|---|---|---|---|
| T1 | `FLRm6Ck5qr6n98u9X8axC7gyej6w` | `mastermind-story-builder-7qewtbqup-erik-akaolies-projects.vercel.app` | `486ff19` | `docs/auth-email-gate-adr0018` | Jun 29 |
| T2 | `f25Giq9Lk3HqNqTDRHy6xvo86Qwo` | `mastermind-story-builder-l7yholyjc-erik-akaolies-projects.vercel.app` | `1422eb0` | `claude/keen-mcnulty-cfd965` | May 11 |
| T3 | `4RNGtCC5GLrfvbkHwGMsT16QRWuk` | `mastermind-story-builder-mzdwj4mfx-erik-akaolies-projects.vercel.app` | `01b081f` | `claude/keen-mcnulty-cfd965` | May 11 |
| T4 | `B6Kfw8zMtSFzVx3w6uwwdBskPQRg` | `mastermind-story-builder-6pjq0e8m1-erik-akaolies-projects.vercel.app` | `972cc33` | `claude/keen-mcnulty-cfd965` | May 11 |

Associated historical git-branch aliases (their post-deletion behavior is TESTED at A27, not
assumed): `mastermind-story-builder-git-docs-e79f96-erik-akaolies-projects.vercel.app` (T1's
branch) and `mastermind-story-builder-git-clau-0af300-erik-akaolies-projects.vercel.app`
(T2–T4's branch).

## 3. Phase A — HISTORICAL APPROVED PROCEDURE (executed to completion; see §0.5–§0.8 for outcomes — these tables are the audit record of what was approved, NOT current instructions)

Conventions (unchanged): all Git operations run in the release-ops clone; the main working
folder is never used. **Master push freeze: continuously active since the original PRE-4
message; remains active through A24. The only permitted master push in the whole interval is
the single push explicitly performed by A23.** Erik is the only committer. "Prod host" = the
production Supabase hostname. One action per step; stop → report; recovery only on Erik's go.

Steps PRE-1…A8 are COMPLETE (§0.5); CP-1…A14 are COMPLETE and A15 is CLOSED (§0.7).
Execution under the v5.3-c approval began at CP-7 (§3.6.5), followed by A16…A28, and
**completed 2026-08-13 — outcomes in §0.8. The freeze ended when A24(a) and A24(b) both
passed.** Everything below in §3.x is preserved as approved, for audit.

### 3.5. Continuation preflight — CP-1…CP-6 + A9R (ALL READ-ONLY; no state changes; EXECUTED under the v5.3-b approval — results in §0.7)

| # | Action (exact) | Expected result | Stop condition |
|---|---|---|---|
| CP-1 | **(Amended method: read-only `gh api`; repository `erik-akaOlie/mastermind-story-builder`.)** ① `gh api repos/erik-akaOlie/mastermind-story-builder/rulesets --jq 'map({id, name, target, enforcement})[]'` → EXACTLY two entries: one `name`=`protect-release-branches` with `target`=`branch`, `enforcement`=`active`; one `name`=`protect-release-tags` with `target`=`tag`, `enforcement`=`active`. Record both numeric `id`s. ② `gh api repos/erik-akaOlie/mastermind-story-builder/rulesets/<branch-ruleset-id>` → inspect fields: `name`=`protect-release-branches`; `target`=`branch`; `enforcement`=`active`; **`bypass_actors` PRESENT in the response and exactly `[]`** (an absent or unreadable `bypass_actors` field is a STOP — absence does not prove the bypass list is empty); `conditions.ref_name.include` = exactly `refs/heads/master` and `refs/heads/production-gate` (no others); `conditions.ref_name.exclude` empty; `rules` contains type `deletion` AND type `non_fast_forward` and NO other rule types. ③ `gh api repos/erik-akaOlie/mastermind-story-builder/rulesets/<tag-ruleset-id>` → `name`=`protect-release-tags`; `target`=`tag`; `enforcement`=`active`; **`bypass_actors` PRESENT and exactly `[]`** (same STOP rule); `conditions.ref_name.include` = exactly `refs/tags/prod-*` and `refs/tags/verification-release-tag-*`; `exclude` empty; `rules` contains types `deletion`, `update`, AND `non_fast_forward` (the third is the GitHub-default force-push block recorded at A2 in §0.5) and NO other rule types. (Field/type names per GitHub's documented rulesets API [DOCS].) | Both rulesets exist, active, exactly as A1/A2 created them; both ids recorded | **Any** authentication failure, repository mismatch, missing field, extra/missing ruleset, or value differing from the stated expectation → STOP |
| CP-2 | Vercel → Environment Variables: read the table | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_KEY` each scoped **Production** only; `VITE_POSTHOG_HOST` All Environments; no other variables | Any scope differs |
| CP-3 | In the clone, run these five commands exactly: ① `git status --porcelain` → prints nothing (clean). ② `git fetch origin --tags` → succeeds. ③ `git rev-parse --verify refs/remotes/origin/throwaway/env-check` → prints a full commit hash whose short form is **`65f7ef6`** (branch exists, tip unchanged). ④ `git rev-parse refs/remotes/origin/throwaway/env-check~1` → prints **`52bacc35fa6ad923b82f19f7579ffbf95d856f28`** (parent is C0). ⑤ `git rev-parse "refs/remotes/origin/throwaway/env-check^{tree}"` → prints **`2b347f97b12ff472e5fb435e0ae72966bf3e15ca`**, the same value as `git rev-parse "52bacc3^{tree}"` (tree unchanged, identical to C0's tree) | Clone clean; branch exists with tip `65f7ef6`, parent C0, tree = C0's tree | Any command's output differs from the stated value |
| CP-4 | Vercel → Deployments, Environment=Preview filter | Exactly 5 entries: throwaway (`65f7ef6`) + T1–T4 — **proof that no deployment was deleted** | Count ≠ 5 or any entry unexpected |
| CP-5 | `git rev-parse origin/master` AND open the current Production deployment's DETAIL PAGE from the Overview (read-only click-through). **RECORD the exact Production deployment ID from the detail page's URL/breadcrumb** alongside the other three identifiers | `origin/master` = **C0 = 52bacc3**; Production deployment: commit **52bacc3**, full address `mastermind-story-builder-jswnhxrle-erik-akaolies-projects.vercel.app`, created **Aug 4** — unchanged; its exact deployment ID is now recorded in the QA notes as **P-ID** (the value A17 compares against) | Any of commit/address/date mismatching → STOP; package re-drafted with new C0. **Failure to locate, read, or record the exact Production deployment ID → STOP — A17 must not proceed without a successfully recorded P-ID** |
| CP-6 | Confirm the A8-recorded throwaway deployment (`AksNtpg7CUJnBjRezsgCCiqGoR1c` / `...dvy5nmeze...`) still appears in the deployment list | Present, Environment=Preview | Missing |
| A9R | Rerun A9 verbatim: Preview-filtered list = exactly T1–T4 + throwaway; each of T1–T4 matches §2 (ID, address, commit, branch, date), verified by opening each deployment DETAIL PAGE by its §2 ID | Exact match | Extra/missing/mismatch → **STOP** |

### 3.6. Corrected deletion steps A10–A13, then A14–A28

**Corrected identity procedure for A10–A13 (replaces v5.2's dialog check):** for each target,
(1) navigate directly to `https://vercel.com/erik-akaolies-projects/mastermind-story-builder/<§2 deployment ID>`;
(2) on the detail page verify ALL FIVE identifiers match §2 — breadcrumb/URL deployment ID,
deployment-specific address, commit, branch, creation date; (3) only then … → Delete;
(4) the confirmation dialog is EXPECTED to be generic (names no deployment — §1 fixed fact);
confirm; (5) verify by list refresh. **STOP if any detail-page identifier mismatches §2, or
if the dialog unexpectedly names a DIFFERENT deployment.**

| # | Action (exact) | Expected result | Verification | Stop condition | Recovery (not pre-authorized) | External state |
|---|---|---|---|---|---|---|
| A10 | Delete T1 (`FLRm6Ck5qr6n98u9X8axC7gyej6w`) per the corrected identity procedure above | T1 removed | List refresh: T1 gone; T2–T4 + throwaway intact | Detail-page identifier mismatch, or dialog names a different deployment | 30-day restore window | Removes 1 deployment |
| A11 | Delete T2 (`f25Giq9Lk3HqNqTDRHy6xvo86Qwo`) likewise | T2 removed | List refresh: T2 gone; T3–T4 + throwaway intact | Same | Same | Removes 1 deployment |
| A12 | Delete T3 (`4RNGtCC5GLrfvbkHwGMsT16QRWuk`) likewise | T3 removed | List refresh: T3 gone; T4 + throwaway intact | Same | Same | Removes 1 deployment |
| A13 | Delete T4 (`B6Kfw8zMtSFzVx3w6uwwdBskPQRg`) likewise | T4 removed | List refresh: T4 gone; throwaway intact | Same | Same | Removes 1 deployment |
| A14 | **(Amended method: command-line, in the release-ops clone ONLY.)** ① `git fetch origin` → succeeds. ② `git ls-remote --heads origin throwaway/env-check` → prints EXACTLY one line: `65f7ef63af76f2916227be612de831b662719036` + TAB + `refs/heads/throwaway/env-check` (the remote branch exists at exactly the recorded commit). ③ `git push origin --delete throwaway/env-check` → accepted (this deletes only that fully specified branch on GitHub). ④ `git ls-remote --heads origin throwaway/env-check` → prints NOTHING (branch absent). ⑤ Vercel Deployments list (browser): the throwaway deployment `AksNtpg7CUJnBjRezsgCCiqGoR1c` is STILL listed. **Correct expectation [DOCS]: branch deletion does NOT delete its Vercel deployment** — the deployment-specific URL remains in history (protected, fail-closed) until retention removes it; only the branch (and eventually its branch alias) goes | Branch gone from GitHub; the throwaway deployment still listed in Vercel history | Command outputs ②/④ + Vercel deployments list ⑤ | ② prints anything other than that exact single hash+ref → STOP (do not delete). ③ rejected (e.g. ruleset misconfigured to cover it) → STOP. ④ still present → STOP. ⑤ deployment missing → STOP | Re-push branch from clone (`git push origin 65f7ef63af76f2916227be612de831b662719036:refs/heads/throwaway/env-check`) | Repo branch |
| A15 | **STATUS PER §0.7: Git portion COMPLETE (branch at exactly C0, verified); deployment portion PRODUCED NO DEPLOYMENT (narrowly recorded observation — cause unverified). Not re-executed under the new approval; the branch is preserved as-is with no empty commit, no forced deployment, no workaround.** ~~Original action: `git push origin 52bacc3:refs/heads/production-gate` (no checkout). Record the resulting deployment's ID + full address (for A27 ⑤)~~ | ~~Branch at C0; a Preview deployment builds~~ Superseded by the §0.7 record | §0.7 | — | — | Repo branch (created; permanent) |
| A16 | Turn **OFF** "Auto-assign Custom Production Domains" (Production environment) | Toggle Disabled | Settings page | Toggle absent → STOP, VOID | Re-enable | Vercel config |
| A17 | **THE FLIP:** Branch Tracking `master` → `production-gate`, Save. Immediately before saving, re-read the current Production deployment ID and confirm it equals **P-ID (recorded at CP-5)**; immediately after saving, read it again | Setting saved; Production deployment ID **equals P-ID both before and after** (identical pre/post); banner names `production-gate` | Deployment ID compared against the CP-5-recorded P-ID; banner | Production deployment ID differs from P-ID at either read, or the Production deployment changes in ANY other way → **STOP; CC reports the observed state and proposes a recovery for Erik's decision** (no prescriptive auto-revert) | Per Erik's decision after report | Vercel config |
| A18 | Add `VITE_SUPABASE_URL`: Preview, Custom Preview Branch `master`, real value | Row "Preview (master)" | Env-vars page | Selector rejects `master` (shouldn't post-flip [DOCS]) → STOP | Delete row | Vercel config |
| A19 | Add `VITE_SUPABASE_ANON_KEY`: Preview (master), real value | Row present | Env-vars page | Same | Delete row | Vercel config |
| A20 | Add `VITE_POSTHOG_KEY`: Preview (master), real value | Row present | Env-vars page | Same | Delete row | Vercel config |
| A21 | Verify the variable table: the three vars above each ×2 (Production; Preview master); **no Production-data-bearing variable is scoped to general Preview or Development** (`VITE_POSTHOG_HOST` remains All Environments — inert, carries no data access, deferred cleanup) | Table exactly as stated | Screenshot | Any Production-data-bearing var in general Preview/Development → STOP | Edit/delete rows | No |
| A22 | Read-only Supabase Auth audit: Site URL + all Additional Redirect URLs; which flows target which addresses; expectations for A24–A26; changes = future separate proposal | Documented | QA record | — | n/a | No |
| A23 | **The single permitted freeze-window push.** In clone: `git checkout master` · `git fetch origin` · `git merge --ff-only origin/master` (tip must remain 52bacc3) · `git commit --allow-empty -m "pipeline: first Preview environment build"` · verify tree = C0's tree, parent = C0 · `git push origin master` | Vercel **Preview** deployment from master with A18–A20 values; Production deployment ID unchanged | Environment=Preview; Production ID | Produces a Production deployment → STOP, VOID | n/a (content-empty) | 1 commit + 1 deployment |
| A24 | Verify `mastermind-story-builder-git-master-erik-akaolies-projects.vercel.app`: (a) serves the A23 deployment; (b) signed-out → login wall. **Freeze ends when a+b pass** | a+b hold | Screenshots | Either fails → STOP (void rule) | n/a | No |
| A25 | Read-only device sweep — desktop, Android, iPhone, in order, on the A24 address: authenticate (Vercel), sign in to MasterMind, open the **approved workspace ("Star Wars")**, open one existing node in the Inspector WITHOUT editing, close it. Do not sign out yet | Works against real data on all three | Erik's notes | Can't reach DB → STOP. Protection blocks Android/iPhone → PAUSE, present alternatives — never weaken protection silently | n/a | No |
| A26 | Reversible write cycle, exact sequence: **(0) confirm NO node titled `PIPELINE-QA-VERIFICATION` exists in the workspace — if one exists → STOP (do not delete or reuse it; it may not belong to this test)** → (1) create the node with that exact title on desktop → (2) reload desktop, confirm persisted → (3) confirm it appears on Android and iPhone → (4) delete it on desktop → (5) confirm absence on all three devices → (6) sign out of MasterMind AND Vercel on all three devices | Node round-trips and is gone; sessions closed | Erik's confirmation | Precheck fails, or the node fails to persist/delete → STOP (stray-node removal then its own approved action) | Deletion of the QA node is the built-in reversal | **Yes — temporary mutation of real Production data in Erik's named workspace** (backups/logs may retain traces) |
| A27 | Historical-address matrix, FULL addresses. Signed-out desktop first, then authenticated where the login wall appears: ① `mastermind-story-builder.vercel.app` → public app; ② current Production deployment-specific address (`...jswnhxrle...`) → login wall; ③ `mastermind-story-builder-git-master-erik-akaolies-projects.vercel.app` → login wall; ④ T1–T4 addresses (§2): must NOT publicly serve content; if the login wall appears, authenticate — the destination must resolve deleted/unavailable, serving no application build and making no request to the prod host; ⑤ **NOT APPLICABLE — no deployment address was created at A15 (§0.7): creating `production-gate` at the already-built C0 produced no visible Vercel deployment, so there is no gate address to check. Recorded explicitly; nothing is checked for this item**; ⑥ the throwaway deployment address (`...dvy5nmeze...`, recorded at A8) → still in history, login wall (protected fail-closed remnant); ⑦ the two historical branch aliases (§2): same exact expectation as ④ — no public content, and after authentication deleted/unavailable, no application build, no prod-host request | ①–④ and ⑥–⑦ as stated; ⑤ recorded not-applicable | Screenshots | ②/③/⑥ publicly serve content → STOP (protection regression); **④ or ⑦ serves the application (publicly OR after authentication) or makes any request to the prod host → STOP** (old builds with Production configuration are not retired) | n/a | No |
| A28 | Record outcomes: facts-sheet append; ADR + CLAUDE.md/BACKLOG drafts + as-executed annotations (all uncommitted pending normal approval) | Drafts exist | Erik review | — | n/a | Local files only |

### Complete external-write inventory (updated 2026-08-13-c; ALL WRITES NOW EXECUTED — final outcomes in §0.8)

**External writes performed under the v5.2 and v5.3-b approvals (§0.5, §0.6, §0.7).
Historical record only:**
- Under the v5.2 approval: 2 GitHub rulesets (A1, A2) · 3 env-var scope changes (A3–A5) ·
  throwaway branch + 1 empty commit + 1 Preview deployment (A7) · release-ops clone
  (PRE-1, local disk).
- Under the 2026-08-13-b approval: 4 Vercel deployment deletions (A10–A13 = T1–T4) · GitHub
  branch `throwaway/env-check` deleted (A14, via `git push origin --delete` from the clone)
  · GitHub branch `production-gate` created at C0, permanent (A15's Git operation — **its
  push produced NO Vercel deployment**, §0.7). **The A7 throwaway deployment REMAINS in
  deployment history after its branch deletion** — protected, fail-closed, aging out via
  retention.

**External writes authorized by the v5.3-c approval (CP-7 + A16–A28) — ALL EXECUTED
2026-08-13 as listed (per-step outcomes in §0.8):**
- Vercel: auto-assign OFF (A16) · Production Branch changed to `production-gate` (A17) ·
  3 env-var additions, Preview(master) scope (A18–A20).
- GitHub: 1 empty-content commit on master (A23 — permanent; the single permitted
  freeze-window push).
- Vercel deployments: **exactly ONE new deployment was predicted — the A23 Preview
  deployment from master — and exactly one occurred** (`48TSmiLpYU6Txa6qcJrGgJdZa7KS`,
  §0.8). No A15 deployment was observed through CP-7 (§0.7, CP-7b).
- Supabase/production data: ONE temporary node created and deleted in Erik's workspace
  "Star Wars" (A26); backups/logs may retain traces. Nothing else.
- Local disk: uncommitted QA/doc drafts (A28).
- No tags are created in Phase A. No Production deployment is created, replaced, or promoted.
- CP-7 (§3.6.5), A21, A22, A24, A25, and A27 are read-only and write nothing anywhere.

### 3.6.5. CP-7 — read-only continuation check, executed FIRST, before A16 (added 2026-08-13-c; EXECUTED — results in §0.8)

Because timing remains an explicitly unruled-out explanation for A15's no-deployment
outcome, the run must confirm the halted state is still what §0.7 recorded before any new
write. All three checks are read-only:

| # | Action (exact) | Expected result | Stop condition |
|---|---|---|---|
| CP-7a | In the clone: `git fetch origin` · `git ls-remote --heads origin production-gate` | Exactly one line: `52bacc35fa6ad923b82f19f7579ffbf95d856f28` + TAB + `refs/heads/production-gate` — the branch remains exactly at C0 | Any other output |
| CP-7b | Vercel → Deployments, **all 7 statuses visible (including Canceled)**, all environments | **No deployment of any status exists for `production-gate`** — no delayed deployment appeared while execution was halted | **A `production-gate` deployment has appeared → STOP before A16; the package must return for another review and the A27 ⑤ not-applicable treatment must be reconsidered** |
| CP-7c | Open the current Production deployment's detail page | Deployment ID still exactly **P-ID = `Eu1r5aDjpQzPnPweqWiBnfhLRpfb`**, commit **C0 = 52bacc3** | Any mismatch |

Any CP-7 failure stops the run before A16 (void rule). CP-7 is INSIDE the new approval
boundary.

### 3.7. Exact approval text and execution boundary — HISTORICAL (Erik sent this approval verbatim on 2026-08-13; execution completed per §0.8. Preserved for audit; NOT a current instruction to authorize anything)

**Execution boundary of the new approval: CP-7 (§3.6.5, read-only, executed first) → A16 →
A28, in that order, exactly as written in this document as amended 2026-08-13-c.** CP-1…A14
are COMPLETE with all evidence recorded (§0.7) and are not re-executed. A15 is closed per
§0.7 (Git portion complete; deployment portion produced no deployment; A27 ⑤ recorded
not-applicable accordingly) and is not re-executed or worked around; if CP-7b finds a
delayed `production-gate` deployment, the run stops before A16 and the A27 ⑤ treatment is
reconsidered under a fresh review. A17's before/after comparison uses the CP-5-recorded
**P-ID = `Eu1r5aDjpQzPnPweqWiBnfhLRpfb`**, unchanged. The approval is void on any stop,
exactly as before. This approval acknowledges that the master push freeze has remained
continuously active since the original PRE-4 message and that no push to `master` has
occurred. **SCOPE: this approval covers ONLY this amended Phase A continuation (CP-7 +
A16–A28). It does not authorize Phase B, any Production promotion, Local isolation, domain
changes, backups, or migration 016.**

To authorize, Erik sends a message containing all five of:

1. "I approve execution of Release-Pipeline Cutover Runbook v5.3 as amended 2026-08-13-c,
   steps CP-7 then A16 through A28 verbatim, as written in
   QA/release-pipeline-cutover-runbook-v5.3-2026-08-13.md, including the §0.7 record
   closing A15 and the not-applicable A27 ⑤. This approval covers only this amended Phase A
   continuation; it does not authorize Phase B or any Production promotion."
2. "I acknowledge the master push freeze has remained continuously active since my original
   PRE-4 approval and remains active through A24; A23 is the only permitted master push."
3. "The workspace for A25/A26 is: Star Wars." (Restated so the new approval is
   self-contained; naming a different workspace he owns is equally valid.)
4. "I accept the recorded A8(b) evidence discrepancy (§0.5): the throwaway verification
   deployment failed closed with a blank page and a startup exception in developer
   diagnostics, rather than the 'loud visible failure' v5.2's wording described. I accept
   this as sufficient for the throwaway verification deployment's purpose."
5. "Any contradiction, failed expectation, or required deviation voids this approval; stop
   and report before any recovery action."

If any of the five is missing, CC asks for the missing piece and does not begin. Erik should
have desktop, Android phone, and iPhone available before A25 (they are not needed for
CP-1…A24).

## 4. Standing release procedure (Model S) — unchanged from v5.2

- **R0 — preflight (every release):** in the release-ops clone: `git remote get-url origin`
  correct · `git status --porcelain` empty · `git fetch origin --tags` — **stop if local tag
  state conflicts with remote** · no local modifications. Erik names the exact approved commit
  (validated on Preview). **Rollback target named**: current Production deployment ID,
  confirmed retained, plus the compatibility assessment — the current database state must be
  compatible with (a) the candidate, (b) current Production, and (c) the rollback target;
  additive schema changes acceptable when all three hold (expand-and-contract); a release
  failing (c) needs its own approved risk plan. Record the Production console-error baseline.
- **R1 — RELEASE:** `git push origin <approved-commit-id>:production-gate`. Expected: staged
  Production deployment (auto-assign OFF). Verify staged commit = approved = the validated
  Preview deployment's commit. Mismatch → STOP.
- **R2 — validate staged:** login wall signed-out; authenticated validation per the release's
  QA plan.
- **R3 — PROMOTE:** dashboard → staged deployment → Promote (no rebuild [DOCS]). Verify
  Production deployment ID = staged ID.
- **R4 — smoke test:** public address signed-out loads; sign-in works; one core flow; no NEW
  console errors vs the R0 baseline. Fail → §5.
- **R5 — TAG (only after R4 passes):** date = current date in **America/Los_Angeles**.
  (1) Compute the exact intended name: `prod-YYYY.MM.DD` if no tag of that name exists, else
  `prod-YYYY.MM.DD.2`, else `.3`, etc. (2) Verify THAT EXACT name is absent locally
  (`git tag -l "<exact-name>"` prints nothing) and remotely
  (`git ls-remote origin refs/tags/<exact-name>` prints nothing). (3)
  `git tag -a <exact-name> <approved-commit-id> -m "deployment: <production-deployment-id>; commit: <approved-commit-id>"`
  (4) verify `git rev-parse <exact-name>^{commit}` = approved ID + annotation content. (5)
  `git push origin <exact-name>`. A mistaken pushed tag is never moved or deleted: preserved,
  documented invalid, correct next tag under a separately approved correction.

## 5. Rollback & incident handling — unchanged from v5.2 (explicit state sequence; exact
actions get their own incident-time approval)

1. **Restore service:** Instant Rollback to the named R0 target.
2. Smoke-test the restored deployment on public Production; tag it per R5 (message notes the
   incident).
3. **Develop the forward fix** on `master`; validate on Preview.
4. Release the fix per R1–R2 (staged Production deployment; validate).
5. Promote the fix (R3) — this also ends the rolled-back state (equivalent to Undo Rollback).
6. **Smoke-test the promoted fix on public Production (R4).** A Production tag is never
   created merely because promotion succeeded.
7. Only after that smoke test passes: tag the fix release per R5.
8. **Check auto-assign:** promotion/Undo Rollback can re-enable it [DOCS]. If re-enabled →
   turn OFF.
9. Re-prove Model S before the next real release: an Erik-approved empty commit (A23
   mechanics) through R1, confirming the result is staged, not public (separately approved).
10. Record the full incident in QA.

## 6. Phase B — rehearsal (separate approval; its own checklist at the time)

**HARD PROOF POINT (added 2026-08-13-c): Phase B's first push of a genuinely new approved
commit to `production-gate` MUST create the expected staged Production deployment. If it
does not, execution STOPS. The A15 no-deployment outcome (§0.7) applies only to the initial
branch creation at already-built C0 and must never be treated as precedent for a missing
deployment on any later push.**

Full R0–R5 with an approved empty commit (tree = the Production commit's tree, verified).
**Tag-ruleset verification (non-production pattern only):**
1. `git tag -a verification-release-tag-protection-2026-08-08 <explicit-commit-id> -m "permanent tag-ruleset verification artifact"` · push it.
2. Attempt `git push --delete origin verification-release-tag-protection-2026-08-08` → expect
   **rejection**.
3. Attempt a forced re-point: `git tag -f verification-release-tag-protection-2026-08-08 <different-commit>` + forced tag push → expect **rejection**.
4. **Local cleanup after the expected rejections:** `git tag -d verification-release-tag-protection-2026-08-08` · `git fetch origin --tags` · verify local tag hash = remote hash (`git ls-remote origin refs/tags/…`) = the ORIGINAL creation hash (remote never moved).
5. The remote tag remains permanently as the pre-declared verification artifact. Either
   attempt succeeding → ruleset broken → STOP. **No experiment ever targets a `prod-*` tag.**
The first real `prod-*` tag lands with B's successful rehearsal promotion.

## 7. Sequence after B (per D5) & estimates (estimate line updated after Phase A completion; sequence unchanged from v5.2)

Local isolation (disposable DB → proven refresh → Local repoint + approved warning banner) →
Phase D domain transition (expand-and-contract; separate inspection first) → Backblaze
(database + Storage bucket; consider proving backup+restoration before tester-cohort
expansion) → migration 016 rehearsal → 016 proposal.
Estimates: B ≈ 1–2 h · D ≈ 1 day + DNS propagation (Phase A completed 2026-08-13).
Approval gates set the pace, deliberately.
