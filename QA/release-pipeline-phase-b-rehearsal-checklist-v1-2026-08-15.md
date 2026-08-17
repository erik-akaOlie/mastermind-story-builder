# Release Pipeline — Phase B: No-Change Release Rehearsal — Checklist v1.1 (DRAFT — PROPOSAL, NOT APPROVED)

**Status: PROPOSAL for Erik's review. v1 drafted 2026-08-15; revised in place to v1.1 the
same day under Erik's explicit documentation-only authorization (after review by Erik and
his external advisory chat). NOTHING in this document is authorized. No step has been
executed. Execution begins only when Erik sends the approval message in §7 with every
required component present.**

**v1.1 changes (substance only; nothing else redesigned):** (1) the 5-minute wait after any
push is a DEFINED OBSERVATION PROCEDURE, not a claimed Vercel timing guarantee (B3-2 and
every other ≤5-min cell; §2); (2) B5-4 — no pre-authorized correction of Auto-assign: an
Enabled reading is recorded and STOPS execution; (3) B6-2 — no pre-authorized Instant
Rollback: a failed smoke test STOPS with a structured report; rollback needs fresh
approval; (4) §7 approval contract updated accordingly; (5) evidence-discipline fix — B0
and B1-7 run `git fetch origin --tags`, which updates LOCAL Git metadata (remote-tracking
refs, downloaded objects/tags), so B0 is no longer labeled "read-only / nothing written
anywhere" and both fetches appear in §4's inventory. Filename unchanged (v1 was never
executed); §7 authorizes THESE v1.1 contents.

This is the "own checklist at the time" that runbook v5.3 §6 calls for. It composes the
standing release procedure (runbook §4, R0–R5) with the §6 tag-ruleset verification, for a
release whose shipped application is unchanged. Parent documents (both published at
`779c0a1`): `QA/release-pipeline-cutover-runbook-v5.3-2026-08-13.md` (§4–§6 operative) and
`docs/decisions/0020-release-pipeline-cutover.md`. Evidence labels as in the runbook:
[DASH] dashboard-observed · [DOCS] documented behavior · [REPO] repo evidence · [VERIFIED]
empirically verified · [ERIK] Erik's decision · [CMD] command output · [HEAD] `curl -I`
headers only · [INFERENCE] · [UNVERIFIED].

**Standing void rule (unchanged): any observation contradicting an expected result STOPS
execution immediately, VOIDS the active approval, and is reported before anything else.
Recovery actions are NEVER pre-authorized — every recovery, correction, or continuation
after a stop needs Erik's fresh explicit approval.**

---

## 0. What Phase B proves — and what it does not

**Proves (if every step passes):**
1. **HARD PROOF POINT** — a genuinely new approved commit pushed to `production-gate`
   CREATES a staged Production deployment (Environment=Production, not serving the public
   domain). Runbook §6 / ADR-0020: this is a STOP if it fails; the A15 no-deployment outcome
   is not precedent either way.
2. The staged deployment can be validated behind Vercel Authentication, then promoted
   **without a rebuild** (deployment ID unchanged across promotion — [DOCS] "Vercel will
   instantly promote the deployment; it doesn't require a rebuild").
3. The public app keeps working after promotion (smoke test vs a recorded baseline).
4. The first `prod-*` tag lands per R5.
5. The tag ruleset actually rejects tag deletion AND forced re-point, using the
   non-production `verification-release-tag-*` pattern only.
6. Empirical answer to an open [DOCS] question that matters for every future release:
   **does dashboard-promoting a staged deployment re-enable "Auto-assign Custom Production
   Domains"?** ([DOCS] says `vercel promote` (CLI) and Undo Rollback DO re-enable it; the
   dashboard Promote of a staged deployment is not stated either way.)

**Does NOT prove / does not do:** no Local isolation, no domain change, no Supabase or
service-configuration change, no migration 016, no A25/A26-style device sweep or write
cycle (those are NOT to be repeated — runbook §0.8), no phone QA (desktop only).

---

## 1. Fixed facts (verified read-only 2026-08-15; re-verified at B0 before any write)

- **Published master = Release-ops master = Development-folder master = `779c0a1`**
  (`779c0a1dca2a6646a5a3ee7a426d7da0fe3a5d50`); history `779c0a1 → 39c50a7 → 5acc5b9 →
  52bacc3 (C0)`. [VERIFIED `git ls-remote`, `rev-parse`, `log` in both folders]
- **GitHub `production-gate` = C0 `52bacc35fa6ad923b82f19f7579ffbf95d856f28`.** C0 is an
  ancestor of `779c0a1` (`git merge-base --is-ancestor` true) → any push of a master commit
  to `production-gate` is a fast-forward (D3). [VERIFIED]
- **GitHub tags:** only `workspace-rename-pre-stage-5` (old, unrelated). No `prod-*`, no
  `verification-release-tag-*`. Local release-ops clone has the same single tag. [VERIFIED]
- **Release-ops clone** `C:\Users\erik\projects\mastermind-release-ops`: clean; remote
  `https://github.com/erik-akaOlie/mastermind-story-builder.git`; git identity
  `Erik Olsen <88750103+erik-akaOlie@users.noreply.github.com>` (same author/committer as
  `779c0a1`); local-only branch `throwaway/env-check` (65f7ef6, absent on GitHub since A14)
  and `refs/reconcile/source → efc768f` — both inert, untouched by this package. [VERIFIED]
- **Difference between Production (C0) and Published master (`779c0a1`)** = exactly five
  documentation files (`BACKLOG.md`, `CLAUDE.md`, the runbook v5.3, the facts sheet,
  ADR-0020) — **zero changes under `src/`, `public/`, `index.html`, `package.json`,
  `package-lock.json`, `vite.config.js`, `vercel.json`, `tailwind.config.js`,
  `postcss.config.js`, `supabase/`.** [VERIFIED `git diff --name-only 52bacc3 779c0a1 -- <those paths>` → empty]
  Trees: C0 = `5acc5b9` = `2b347f97…15ca`; `39c50a7` = `8a8f5e74…571f`; `779c0a1` =
  `c302fef0…2765`.
- **Production deployment (rollback target for this release):** **P-ID
  `Eu1r5aDjpQzPnPweqWiBnfhLRpfb`**, address `mastermind-story-builder-jswnhxrle-erik-akaolies-projects.vercel.app`,
  commit C0, created Aug 4 2026, Production · Current [DASH 2026-08-15, (c) Check 5/6].
  Retention: Production 1 year on Pro [DASH P3] → retained. Eligible for Instant Rollback
  (it has served the production domain) [DOCS].
- **Vercel state [DASH 2026-08-15]:** Branch Tracking = `production-gate`; Auto-assign
  Custom Production Domains = **Disabled**; exactly one domain
  `mastermind-story-builder.vercel.app` → Production; latest master Preview =
  `7viRyiEH1yumUSbA9RGSUTiXmBL3` (`779c0a1`, Ready).
- **[DOCS] Vercel "Promoting Deployments" (last updated 2026-06-26):** production
  deployment states are **Staged** ("a commit has been pushed to [the production branch],
  but a domain has not been auto-assigned"), **Promoted**, **Current**. Dashboard promote
  path: Deployments → ellipsis (…) next to the deployment → **Promote** → confirm dialog →
  **Promote**; "instantly … doesn't require a rebuild"; once promoted it is marked Current.
  A previously promoted deployment cannot be promoted again (rollback instead).
- **[DOCS] Vercel "Instant Rollback" (last updated 2026-07-07):** after a rollback Vercel
  turns auto-assign OFF; **Undo Rollback and `vercel promote` re-enable auto-assignment.**
  Whether the dashboard Promote of a staged deployment also re-enables it: **not stated →
  [UNVERIFIED]; B5b observes it.**
- **[DOCS by omission] tag pushes:** Vercel's Git integration deploys branch pushes; its
  own guide for "deploy based on tags" requires disabling auto-deploy and using a CI
  workflow — implying tags alone do not trigger deployments. Not stated outright →
  observed at B1 and B7 (expected: no new deployment).
- **[REPO] routine app writes during "read-only" use:** opening a workspace writes
  `workspaces.last_opened_at` (`touchWorkspaceOpened`, WorkspaceContext.jsx:158) and
  leaving it uploads a canvas snapshot + updates `snapshot_path` (App.jsx:189–208).
  Signing in creates an auth session row. These are the same bookkeeping writes A25
  performed; **they are NOT content mutations** and are labeled honestly below.

### 1.1 Two deliberate wording deviations from runbook §6 (require Erik's explicit acceptance — §7 component 3)

**(D-1) The rehearsal commit's tree.** §6 says "an approved empty commit (tree = the
Production commit's tree, verified)". §6 was written 2026-08-08 when master = C0. Today
Published master carries three docs-only commits past C0. Literal satisfaction is now
impossible without breaking the branch model: an empty commit whose parent is C0 (tree =
C0's) would put a commit on `production-gate` that master does not contain, so every
future release push would stop being a fast-forward (violates D3, permanently). Therefore
the rehearsal commit is created **on Published master's tip (`779c0a1`)** with `git commit
--allow-empty`, and the verified invariant becomes: **rehearsal tree = `779c0a1`'s tree
(`c302fef0…2765`) AND `git diff --name-only 52bacc3 <B-SHA> -- <application paths>` is
empty** — i.e., the shipped application is byte-for-byte the same source as Production;
only repository documentation differs. This is also the ONLY sequence that rehearses the
standing procedure faithfully (validated-on-Preview commit → pushed to `production-gate`).

**(D-2) The verification tag's name.** §6 pre-declares
`verification-release-tag-protection-2026-08-08` (the date the text was drafted). This
checklist uses the **actual creation date**: `verification-release-tag-protection-2026-MM-DD`
with the America/Los_Angeles date at B1 (expected `2026-08-16` if executed the day after
approval; computed and recorded at B1). The ruleset pattern `verification-release-tag-*` is
what matters; a misdated permanent artifact would mislead future readers. Erik may instead
keep §6's literal name — say so in the approval; the steps are otherwise identical.

---

## 2. Conventions

- **All Git operations run in the release-ops clone**, never the Development folder.
  Stage nothing (`--allow-empty`); commit message via a scratchpad file + `git commit -F`;
  **no Co-Authored-By trailer** [ERIK]. Erik is the only committer (clone identity above).
- **One action per step; expected result / verification / stop condition / recovery /
  external-state flag on every step.** Steps run strictly in order B0 → B8.
- **Who acts (column "Actor"):**
  - **CC-CMD** — CC runs the exact command in the clone; output pasted into the record.
  - **CC-DASH** — CC's browser control navigating the Vercel dashboard READ-ONLY in Erik's
    Chrome (vercel.com is reachable — runbook §0.6). Erik may instead read the same page
    himself and report; either channel is valid. CC never clicks anything that changes
    state on Vercel.
  - **CC-HEAD** — one `curl -I <address>` from the shell: headers only, redirects not
    followed, no cookies, no JS, nothing reaches Supabase.
  - **ERIK** — Erik performs it himself: every MasterMind sign-in (CC never handles
    credentials), the Promote click (the release act — Erik's authority), and the
    console-error reads. No settings are changed by anyone under this checklist.
- **Identifiers recorded during execution:** **B-SHA** (rehearsal commit), **PV-ID**
  (its master Preview deployment), **S-ID + S-ADDR** (staged Production deployment and its
  deployment-specific address), **V-TAG-HASH** (verification tag object hash), **PROD-TAG**
  (final tag name).
- **Defined observation procedure after any push ("≤5 min" in the tables):** the Vercel
  Deployments list is refreshed at approximately **1, 3, and 5 minutes** after the push,
  each time with ALL environments and ALL 7 statuses visible (incl. Canceled). This is the
  evidence procedure, **not a claim that Vercel guarantees deployment creation within five
  minutes** — builds took ~20 s in Phase A; the window is generous so that "nothing
  attributable to the pushed commit became observable" is a real, reproducible observation.
  Where a step expects NO deployment, the same three refreshes are the evidence.
- **Estimated duration:** ≈1–2 h wall clock (runbook §7), desktop only.

---

## 3. Steps

### B0 — Preflight (= R0). No working-tree, branch, GitHub, Vercel, Supabase, or Production mutation. ONE explicitly authorized local Git-metadata write: `git fetch origin --tags` (B0-1) updates the clone's remote-tracking refs and may download objects/tags — it is NOT read-only and is listed in §4.

| # | Action (exact) | Expected result | Stop condition |
|---|---|---|---|
| B0-1 CC-CMD | In the clone: `git remote get-url origin` · `git status --porcelain` · **`git fetch origin --tags` (local Git-metadata write — authorized by §7 as part of B0)** · `git rev-parse origin/master origin/production-gate` · `git ls-remote origin refs/heads/master refs/heads/production-gate 'refs/tags/*'` | URL = `https://github.com/erik-akaOlie/mastermind-story-builder.git`; porcelain empty; fetch OK with NO tag conflict (only `workspace-rename-pre-stage-5`, unchanged); `origin/master` = `779c0a1…`; `origin/production-gate` = `52bacc35…`; ls-remote shows exactly those two heads + that one tag (no `prod-*`, no `verification-release-tag-*`) | Any value differs → STOP (a moved master means the package must be re-drafted around the new tip) |
| B0-2 CC-CMD | `git diff --name-only 52bacc3 origin/master -- src public index.html package.json package-lock.json vite.config.js vercel.json tailwind.config.js postcss.config.js supabase` | Prints nothing (application + schema unchanged since Production; **DB compatibility with candidate, current Production, and rollback target is trivially satisfied — no schema change exists**) | Any path printed → STOP |
| B0-3 CC-DASH | Vercel → Settings → Environments → Production | Branch Tracking `production-gate`; Auto-assign Custom Production Domains **Disabled** ("Production deployments will need to be manually promoted") | Either differs → STOP |
| B0-4 CC-DASH | Open `https://vercel.com/erik-akaolies-projects/mastermind-story-builder/Eu1r5aDjpQzPnPweqWiBnfhLRpfb` | Production · **Current**; commit `52bacc3`; address `…jswnhxrle…`; created Aug 4. **Rollback target for this release = P-ID, confirmed present and retained** | Any mismatch, or not Current → STOP |
| B0-5 CC-DASH | Vercel → Deployments, all environments, all 7 statuses | No deployment of any status exists for branch `production-gate` (still true since CP-7b); newest master Preview = `7viRyiEH…` (`779c0a1`) Ready · Latest; newest Production row = P-ID Current | A `production-gate` deployment exists → STOP (would need re-review, as CP-7b said) |
| B0-6 ERIK | **Console-error baseline.** In Chrome (personal profile), open DevTools → Console, load `https://mastermind-story-builder.vercel.app` signed-out, sign in to MasterMind, open the **approved workspace named in §7**, open ONE existing node in the Inspector without editing, close it, return to the picker, sign out. Report the console: count + first line of any error (screenshot welcome) | Baseline recorded (expected: no errors, or a short known list). Routine app writes occur (`last_opened_at`, cover snapshot) — no content mutation | Cannot sign in / workspace fails to load → STOP (Production is unhealthy before we start) |
| B0-7 CC-DASH or CC-HEAD | `curl -I https://mastermind-story-builder.vercel.app` | `HTTP/1.1 200 OK`, `text/html`, no auth challenge (supplemental only — does not identify the serving deployment; B0-4 does) | Non-200 / auth wall → STOP |

### B1 — Tag-ruleset verification (runbook §6 items 1–5; BEFORE any Production-affecting step, so a broken ruleset stops us before we touch Production)

Name: `V = verification-release-tag-protection-<YYYY-MM-DD>` with the Pacific date from
`powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date).ToUniversalTime(),'Pacific Standard Time').ToString('yyyy-MM-dd')"`
(recorded). **Amended during execution 2026-08-15 (as-executed note):** the original
command `TZ=America/Los_Angeles date +%Y-%m-%d` returned the UTC date (`2026-08-16`) —
this Git Bash has no timezone database, so `TZ` is silently ignored. The misdated tag was
created LOCALLY ONLY at B1-2, detected before B1-3, execution STOPPED (void rule), and Erik
approved the recovery: local tag deleted (verified absent; it never reached GitHub), both
date commands (here and B7-1) replaced with the explicit .NET Pacific-time conversion, B1
resumed from B1-1. Points at `779c0a1` (Published master tip at approval time); the forced
re-point attempt targets C0 `52bacc3`.

| # | Action (exact) | Expected result | Verification | Stop condition | Recovery (not pre-authorized) | External state |
|---|---|---|---|---|---|---|
| B1-1 CC-CMD | `git tag -l "V"` and `git ls-remote origin refs/tags/V` | Both print nothing | outputs | Either non-empty → STOP | — | none |
| B1-2 CC-CMD | `git tag -a V 779c0a1 -m "permanent tag-ruleset verification artifact"` · `git rev-parse V` (record **V-TAG-HASH**) · `git rev-parse V^{commit}` | Annotated tag created locally; `^{commit}` = `779c0a1dca2a6646a5a3ee7a426d7da0fe3a5d50` | outputs | Mismatch → STOP | `git tag -d V` (local only) | local only |
| B1-3 CC-CMD | `git push origin V` | Accepted (creating a tag matching the pattern is allowed; only update/delete/force are blocked) | `git ls-remote origin refs/tags/V` prints `V-TAG-HASH  refs/tags/V` (+ the `^{}` line = `779c0a1…`) | Rejected → STOP (ruleset misconfigured to block creation, or auth failure) | none — a created tag under this pattern is by design permanent | **GitHub: 1 permanent tag** |
| B1-4 CC-DASH | Vercel → Deployments (all env/statuses), per the §2 observation procedure (refresh at ~1, 3, 5 min) | **No new deployment** appeared from the tag push | list | A new deployment appears → STOP + report (unexpected trigger) | — | none expected |
| B1-5 CC-CMD | `git push --delete origin V` | **REJECTED** by GitHub (rule violation message, e.g. `GH013: Repository rule violations found` / cannot delete) | `git ls-remote origin refs/tags/V` still prints `V-TAG-HASH` | **Deletion SUCCEEDS → STOP: ruleset broken.** (Also stop if the remote hash changed) | Re-push the tag from local (only on Erik's go) | none if rejected |
| B1-6 CC-CMD | `git tag -f V 52bacc3` (local re-point) · `git push --force origin refs/tags/V` | Local tag now points at C0; the forced push is **REJECTED** | `git ls-remote origin refs/tags/V` still prints the ORIGINAL `V-TAG-HASH` (remote never moved) | **Forced push SUCCEEDS or remote hash changed → STOP: ruleset broken** | — | none if rejected |
| B1-7 CC-CMD | Local cleanup: `git tag -d V` · **`git fetch origin --tags` (local Git-metadata write — authorized by §7 as part of B1)** · `git rev-parse V` · `git ls-remote origin refs/tags/V` | Local tag re-created from remote; local hash = remote hash = **V-TAG-HASH** (original creation hash) | outputs | Any of the three differ → STOP | — | none external; local clone tag/metadata updated (§4) |

Outcome recorded: "tag ruleset empirically rejects deletion and forced re-point" —
[VERIFIED] once B1-5 and B1-6 both reject. The remote tag V remains permanently.

### B2 — Rehearsal commit on master → Preview validation (A23 mechanics; the commit that R1 will release)

| # | Action (exact) | Expected result | Verification | Stop condition | Recovery (not pre-authorized) | External state |
|---|---|---|---|---|---|---|
| B2-1 CC-CMD | `git checkout master` · `git fetch origin` · `git merge --ff-only origin/master` · `git rev-parse HEAD` | On master; "Already up to date"; HEAD = `779c0a1…` | outputs | HEAD ≠ `779c0a1` → STOP (master moved; re-draft) | — | none |
| B2-2 CC-CMD | Write the message file in the scratchpad: line 1 `pipeline: Phase B release rehearsal (no application change)`, blank line, body: `Empty commit created for the Phase B no-change release rehearsal (runbook v5.3 §6; Phase B checklist v1). Tree identical to 779c0a1; application source identical to Production C0 52bacc3.` Then `git commit --allow-empty -F <file>` | Commit created; **B-SHA** recorded (`git rev-parse HEAD`) | `git log -1 --format='%H%n%an <%ae>%n%cn <%ce>%n%B'` shows Erik as author + committer, no Co-Authored-By | Identity wrong / trailer present → STOP (`git reset --hard 779c0a1` is the local-only undo — on Erik's go) | local only | local commit |
| B2-3 CC-CMD | `git rev-parse HEAD^{tree} 779c0a1^{tree}` · `git rev-parse HEAD~1` · `git diff --name-only 52bacc3 HEAD -- src public index.html package.json package-lock.json vite.config.js vercel.json tailwind.config.js postcss.config.js supabase` · `git merge-base --is-ancestor 52bacc3 HEAD && echo ff-ok` | Two identical tree hashes (`c302fef0…2765`); parent = `779c0a1…`; diff prints nothing; `ff-ok` | outputs | Any differ → STOP (local-only state; nothing pushed) | local reset on Erik's go | none |
| B2-4 CC-CMD | `git push origin master` | Accepted (fast-forward `779c0a1 → B-SHA`); `git ls-remote origin refs/heads/master` = B-SHA | output + ls-remote | Rejected → STOP | none (a pushed empty commit is permanent by design) | **GitHub: master advanced by 1 empty commit (permanent)** |
| B2-5 CC-DASH | Vercel → Deployments, per the §2 observation procedure (refresh at ~1, 3, 5 min) | Exactly ONE new deployment: **Environment=Preview**, branch `master`, commit B-SHA (message "pipeline: Phase B release rehearsal…"), status → **Ready**; record **PV-ID**. Production row still P-ID Current. NO deployment for `production-gate` yet | list + PV-ID detail page | Built as Production, or a `production-gate` deployment appears, or build Errored, or **no Preview deployment attributable to B-SHA becomes observable during the procedure** → STOP | — | **Vercel: 1 Preview deployment** |
| B2-6 CC-HEAD | `curl -I https://mastermind-story-builder-git-master-erik-akaolies-projects.vercel.app` | `302` to `https://vercel.com/sso-api?…` (Vercel Authentication interception, no app HTML) | headers | App HTML served signed-out → STOP (protection regression) | — | none |
| B2-7 CC-DASH | PV-ID detail page badges | PV-ID = Ready · **Latest** on branch master; `7viRyiEH…` now Stale (per the (c) Check-3 evidence lesson: badges, not the historical Domains list) | detail page | Not Latest after 5 min → STOP | — | none |

Preview validation is deliberately light: B-SHA's tree is byte-identical to `779c0a1`,
whose Preview passed the six (c) checks on 2026-08-15; a Ready build of the same tree at
the alias behind the wall is the evidence R0 needs ("validated on Preview"). No
authenticated Preview load is required (adds no evidence).

### B3 — RELEASE push (= R1) — **THE HARD PROOF POINT**

| # | Action (exact) | Expected result | Verification | Stop condition | Recovery (not pre-authorized) | External state |
|---|---|---|---|---|---|---|
| B3-1 CC-CMD | `git ls-remote origin refs/heads/production-gate` (must still be C0) · `git push origin <B-SHA>:production-gate` (no checkout) · `git ls-remote origin refs/heads/production-gate` | Pre = `52bacc35…`; push accepted as fast-forward; post = B-SHA | outputs | Pre ≠ C0, or push rejected → STOP | none (`production-gate` cannot be force-moved — ruleset; the branch would rest at a docs-only commit that Production does not serve, which is harmless) | **GitHub: `production-gate` advanced C0 → B-SHA (permanent)** |
| B3-2 CC-DASH | Vercel → Deployments, all environments, all 7 statuses, per the §2 observation procedure (refresh at ~1, 3, 5 min after the push), then open the new row's detail page | **A NEW deployment EXISTS for branch `production-gate`, commit B-SHA, Environment = Production**, status → **Ready**, state **Staged** ([DOCS] label; if the UI wording differs but the deployment is Production, Ready, and NOT Current, record the exact wording — the substance is what matters); it has its own deployment-specific address (record **S-ID + S-ADDR**); **P-ID is STILL Current**; the public domain is NOT on the new deployment; the "Promote" option is offered for it | list + S-ID detail page + P-ID detail page re-read | **HARD PROOF: if no deployment attributable to commit B-SHA becomes observable through these evidence channels during the defined observation procedure → STOP.** The window is the procedure, not a Vercel timing guarantee; the stop is unconditional: **no retry, no second empty commit, no manual deployment, no configuration change, no diagnosis-as-recovery, no inferred recovery** — report, and wait for a fresh approval. Also STOP if: it is created as **Preview**; it becomes **Current** on its own (auto-assign not actually off → the public app changed without promotion — Erik decides recovery); it Errors; the public domain moved | Per Erik's decision after report | **Vercel: 1 Production (staged) deployment** |

### B4 — Validate the staged deployment (= R2)

| # | Action (exact) | Expected result | Verification | Stop condition | External state |
|---|---|---|---|---|---|
| B4-1 CC-HEAD | `curl -I https://<S-ADDR>` | `302` to `https://vercel.com/sso-api?…` — a Production deployment-specific address is behind Vercel Authentication (Standard Protection), exactly as A27 ② showed for `…jswnhxrle…` | headers | App HTML served signed-out → STOP (protection regression) | none |
| B4-2 ERIK | In Chrome: open `https://<S-ADDR>`; pass the Vercel login wall; DevTools Console open; sign in to MasterMind; open the **§7-named workspace**; open ONE existing node in the Inspector WITHOUT editing; close it; back to the picker; sign out. Report console vs the B0-6 baseline | The staged build serves the real app against Production data (it carries Production env vars — this is the exact artifact that will be promoted); no NEW console errors vs baseline. Routine bookkeeping writes only (`last_opened_at`, snapshot) — no content mutation | Erik's report | Sign-in fails, workspace/data missing, or new console errors → STOP (do not promote) | Production Supabase: routine bookkeeping writes only |
| B4-3 CC-DASH | Re-read P-ID detail page and Settings → Environments → Production | P-ID still Current; auto-assign still Disabled (nothing moved during validation) | pages | Either changed → STOP | none |

### B5 — PROMOTE (= R3) — the release act, performed by Erik

| # | Action (exact) | Expected result | Verification | Stop condition | Recovery | External state |
|---|---|---|---|---|---|---|
| B5-1 ERIK (CC-DASH may read alongside) | Open `https://vercel.com/erik-akaolies-projects/mastermind-story-builder/<S-ID>`; confirm on the DETAIL PAGE: ID = S-ID (URL + breadcrumb), commit B-SHA, branch `production-gate`, Environment Production, not Current | Identity confirmed BEFORE promoting (same discipline as A10–A13) | detail page | Any identifier differs → STOP | — | none |
| B5-2 ERIK | Vercel → Deployments → ellipsis (…) next to S-ID → **Promote** → the dialog names the domain `mastermind-story-builder.vercel.app` → **Promote** ([DOCS] path). Record the exact dialog wording | Promotion completes instantly (no build) | dialog + result | Dialog names a different deployment/domain → Cancel, STOP | — (promotion is reversed only by Instant Rollback → §5) | **Vercel: public domain re-pointed P-ID → S-ID (THE RELEASE)** |
| B5-3 CC-DASH | Overview + Deployments + S-ID detail + P-ID detail | Production · **Current = S-ID** (SAME deployment ID as staged — proof of no rebuild); **no new deployment row was created by the promotion**; P-ID no longer Current (previous); the public domain listed on S-ID | pages | Current ≠ S-ID, or a new deployment appeared (rebuild), or the domain didn't move → STOP + report | Per Erik | none |
| **B5-4 CC-DASH (read-only)** | Settings → Environments → Production → **Auto-assign Custom Production Domains** | **Expected-unknown [UNVERIFIED]:** Disabled (= PASS, continue to B6) OR Enabled (documented for CLI promote / Undo Rollback; not stated for dashboard promote). **RECORD which — this is a deliberate empirical finding.** Branch Tracking must still read `production-gate` | settings page (screenshot either way) | Branch Tracking changed → STOP. **If auto-assign reads Enabled: record the exact page state and STOP. Do NOT change the setting. Do NOT perform any further `production-gate` push. Do NOT proceed to B6/B7. Report to Erik; both the correction and continuation need his fresh explicit approval.** Consequence stated openly: S-ID is then public, un-smoke-tested and untagged, until that approval (Erik is present; the gap is minutes) | Not pre-authorized | none (read only) |

### B6 — Smoke test public Production (= R4)

| # | Action (exact) | Expected result | Stop condition | External state |
|---|---|---|---|---|
| B6-1 CC-HEAD | `curl -I https://mastermind-story-builder.vercel.app` | `200`, `text/html`, no auth wall (supplemental) | Otherwise → STOP | none |
| B6-2 ERIK | Repeat B0-6 exactly on `https://mastermind-story-builder.vercel.app`: signed-out load shows the sign-in screen; sign in; open the §7-named workspace; open one node; close; picker; console compare; sign out | Works; **no NEW console errors vs the B0-6 baseline** | **FAIL → STOP and report, in this structure:** (1) exactly what failed; (2) whether it is NEW relative to the B0-6 baseline; (3) apparent user impact / whether Production is materially impaired; (4) confirmation that P-ID `Eu1r5aDjpQzPnPweqWiBnfhLRpfb` remains the verified, retained, DB-compatible rollback target; (5) the exact proposed rollback operation (Instant Rollback → P-ID, §5). **Rollback executes ONLY on Erik's fresh explicit approval — nothing is pre-authorized. No `prod-*` tag is created for a failed release.** Consequence stated openly: public Production stays on S-ID until that approval (Erik is present) | Production Supabase: routine bookkeeping writes only |

### B7 — TAG (= R5; only after B6 passes)

| # | Action (exact) | Expected result | Stop condition | External state |
|---|---|---|---|---|
| B7-1 CC-CMD | `powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date).ToUniversalTime(),'Pacific Standard Time').ToString('yyyy.MM.dd')"` → `D` (explicit Pacific conversion — amended 2026-08-15 after the B1 stop; the former `TZ=America/Los_Angeles date` returned UTC in this shell). Intended name `PROD-TAG = prod-D` (if it existed, `.2`, `.3`… — it will not, none exist). `git tag -l "prod-D"` · `git ls-remote origin refs/tags/prod-D` | Both print nothing | Either non-empty → STOP | none |
| B7-2 CC-CMD | `git tag -a prod-D <B-SHA> -m "deployment: <S-ID>; commit: <B-SHA-full>"` · `git rev-parse prod-D^{commit}` · `git cat-file -p prod-D` | `^{commit}` = B-SHA; annotation shows deployment + commit lines | Mismatch → STOP (`git tag -d` locally on Erik's go — nothing pushed) | local |
| B7-3 CC-CMD | `git push origin prod-D` · `git ls-remote origin refs/tags/prod-D` | Accepted; remote shows the tag (+ `^{}` = B-SHA) | Rejected → STOP | **GitHub: first `prod-*` tag (permanent, protected)** |
| B7-4 CC-DASH | Deployments list, per the §2 observation procedure (refresh at ~1, 3, 5 min) | No new deployment from the tag push; Current still S-ID | Otherwise → STOP | none |

### B8 — Record (local files only; every write below is uncommitted and awaits Erik's normal review; commit/push mechanics proposed separately — like (a)/(b) after Phase A)

- This checklist file: append an **as-executed record** (per-step outcome, all recorded
  identifiers B-SHA / PV-ID / S-ID / S-ADDR / V-TAG-HASH / PROD-TAG, exact UI wordings,
  the B5-4 auto-assign finding, console baseline vs smoke).
- `QA/release-pipeline-phase-a-facts-2026-08-07.md`: "Phase B record" append (identifiers
  + proof point + auto-assign finding); also correct the now-stale line "main working folder
  still at `efc768f` (NOT realigned)" — realignment to `779c0a1` happened 2026-08-15.
- `docs/decisions/0020-release-pipeline-cutover.md`: amendment — Model S staged behavior
  now [VERIFIED]; auto-assign-after-promote finding; first `prod-*` tag.
- `CLAUDE.md` Release Pipeline section: "not yet empirically proven" → proven; Phase B done;
  **fold in the standing loose ends** (`779c0a1` / Preview `7viRyiEH…`; domain direction —
  Production `mastermind.justlivingthedream.com`, Preview `preview.mastermind.…` extends D4,
  `staging.` reserved only; master-terminology rule).
- `BACKLOG.md`: Phase B ✅ with completed outcomes only; next = Local isolation (D5).
- `CHANGELOG.md`: no entry (no user-facing change) — noted, not omitted by accident.
- **Development-folder master** will be one commit behind Published master (B-SHA) after
  B2-4; realignment is a separate housekeeping step (as on 2026-08-15), NOT in this package.

---

## 4. Complete external-write inventory (everything this approval would authorize)

- **GitHub:** 1 empty commit on `master` (B2, permanent) · `production-gate` fast-forwarded
  C0 → B-SHA (B3, permanent) · 1 permanent `verification-release-tag-protection-<date>` tag
  (B1) · 1 permanent `prod-<date>` tag (B7) · two DELIBERATELY REJECTED pushes (B1-5 delete,
  B1-6 force) that change nothing.
- **Vercel:** 1 Preview deployment (B2) · 1 Production deployment, staged then promoted
  (B3/B5) · **the public domain re-pointed from P-ID to S-ID — the release** (B5).
  **No Vercel setting is changed by this package** (B5-4 is a read-only check; an
  Enabled reading stops execution).
- **Supabase Production data:** routine bookkeeping writes from Erik's own sign-ins and
  workspace opens (auth session rows, `last_opened_at`, cover snapshot upload) in the
  §7-named workspace — same category as A25; **no content mutation; no schema change.**
- **Local (release-ops clone):** two `git fetch origin --tags` runs (B0-1, B1-7) that
  update remote-tracking refs / download objects and tags — local Git-metadata writes,
  not read-only; the rehearsal commit on local master (B2); local tags V and prod-D
  (B1, B7) plus V's temporary local re-point and delete/re-fetch cycle (B1-6/B1-7).
- **Local (elsewhere):** scratchpad commit-message file; B8 doc drafts in the Development
  folder (uncommitted).
- **Not touched:** Vercel settings, Supabase configuration, domains, env vars, rulesets,
  Local setup, migration 016, any other user's data. **No recovery or correction of any
  kind is pre-authorized.**

## 5. If something goes wrong after promotion (Phase B-specific reading of runbook §5)

State sequence; every action below needs its own fresh explicit approval at the time
(nothing is pre-authorized): (1) Instant Rollback to **P-ID** (eligible + retained; DB compatible — no schema change) restores the
prior public app; (2) [DOCS] a rollback turns auto-assign OFF (already our desired state);
(3) NO `prod-*` tag is created for a failed release; (4) full incident record; (5) Model S
must be re-proven before the next release (§5 step 9). A stop BEFORE B5 needs no rollback:
nothing public changed.

## 6. What Erik must have ready

- Desktop Chrome, personal profile, signed in to Vercel; DevTools usable.
- MasterMind credentials (typed by Erik only) and the name of ONE workspace he owns for
  B0-6 / B4-2 / B6-2 (an unimportant one is fine; read-only use + routine bookkeeping writes).
- ~1–2 hours in one sitting; no phones needed.
- Awareness that after B5 the public app is a FRESH BUILD of identical source (Node 24.x,
  same lockfile) — functionally the same app; hashed asset filenames will differ. Rollback
  target P-ID is named above.

## 7. Approval text — required components (send ALL in one message; if any is missing CC asks and does not begin)

1. "I approve execution of the Phase B rehearsal checklist **v1.1**, steps B0 through B8
   verbatim, as written in `QA/release-pipeline-phase-b-rehearsal-checklist-v1-2026-08-15.md`
   (the file revised in place to v1.1). This approval covers only Phase B; it does not
   authorize Local isolation, domain changes, backups, migration 016, or any Supabase,
   Vercel-settings, or service-configuration change. It authorizes the two local
   `git fetch origin --tags` runs in B0-1 and B1-7."
2. "The workspace for B0-6 / B4-2 / B6-2 is: ______." (any workspace Erik owns)
3. "I accept the two wording deviations from runbook §6 recorded in §1.1: the rehearsal
   commit is created on Published master's tip (`779c0a1`) with tree identical to it and
   application paths identical to Production C0; and the verification tag is named with its
   actual creation date." — OR: "…keep §6's literal tag name `verification-release-tag-protection-2026-08-08`."
4. "I acknowledge that if, after promotion (B5-4), Auto-assign Custom Production Domains
   reads Enabled, execution STOPS with the finding recorded; no setting change and no
   continuation is pre-authorized — both need my fresh approval."
5. "I acknowledge that if the B6 smoke test fails, execution STOPS with the structured
   report; Instant Rollback to P-ID is NOT pre-authorized and needs my fresh approval; no
   `prod-*` tag is created for a failed release."
6. "Any contradiction, failed expectation, or required deviation voids this approval; stop
   and report before any recovery action. Recovery is never pre-authorized."

**Erik performs himself:** B0-6, B4-2, B5-1/B5-2 (the Promote click), and B6-2. **CC
performs:** all clone commands, HEAD checks, and read-only dashboard reads (or Erik reads
and reports — either is valid). CC does not enter credentials, click Promote, or change
any setting; **nobody changes any setting under this approval.**

---

## 8. AS-EXECUTED RECORD — 2026-08-15 (Pacific), executed under Erik's v1.1 approval + one recovery approval — **PHASE B COMPLETE, ALL GATES PASSED**

**Approvals (both in-session, both with every required component):** (1) the v1.1 approval
(workspace **Star Wars**; §1.1 deviations accepted; B5-4 Enabled = STOP; B6 fail = STOP;
recovery never pre-authorized; Erik performs B0-6/B4-2/B5-1/B5-2/B6-2); its component 1
used the tightened wording "authorizes only the actions expressly specified in steps
B0–B8" — that wording governs. (2) the **B1 recovery approval** after the one stop (below).
Evidence labels as in §0. All times America/Los_Angeles (PDT).

**Recorded identifiers (canonical):**
- **B-SHA = `8af746945e9d04776e782548c1a335cffb208a34`** (`8af7469`, "pipeline: Phase B
  release rehearsal (no application change)"; parent `779c0a1`; tree `c302fef0…2765`
  identical to `779c0a1`; zero application-path diff vs C0). Author + committer Erik.
- **PV-ID = `GYGg933nHWSnqNCXNbEzYBNtVrLX`** (Preview, master, `8af7469`, Ready 19s,
  `…-jfbj9b5tq-…`; master alias attached; Latest).
- **S-ID = `TdLdhwDGc3q569ucqhLcpinSY9MG`**, **S-ADDR
  `mastermind-story-builder-gnrrez7c7-erik-akaolies-projects.vercel.app`** — the staged
  Production deployment, later PROMOTED without rebuild → **now Production · Current,
  serving `mastermind-story-builder.vercel.app`**. Branch alias observed:
  `mastermind-story-builder-git-prod-688cf1-erik-akaolies-projects.vercel.app`; the
  team-scoped generated alias `mastermind-story-builder-erik-akaolies-projects.vercel.app`
  was also listed on it (generated address; not the public custom domain).
- **P-ID `Eu1r5aDjpQzPnPweqWiBnfhLRpfb`** (C0) = the PREVIOUS Production deployment
  (rollback target for this release; still retained).
- **V = `verification-release-tag-protection-2026-08-15`**, V-TAG-HASH
  `1f62d7243f836edbf79240f5c477c20fb4134731` → `779c0a1` (permanent).
- **PROD-TAG = `prod-2026.08.15`**, tag object `620ed78ca9dc0872d0282ae8a974bd0489d60977`
  → `8af7469`, message `deployment: TdLdhwDGc3q569ucqhLcpinSY9MG; commit: 8af74694…8a34`.
- End state (four locations, per the terminology rule): **Published master = `8af7469` ·
  GitHub `production-gate` = `8af7469` · Release-ops master = `8af7469` (clone clean) ·
  Development-folder master = `779c0a1`.** The Development-folder gap is the EXPECTED
  post-Phase-B state (the release candidate was created in the release-ops clone), not the
  earlier repository-history divergence; realignment requires its own separate approval.

**Per-step outcomes:**

| Step | Result | Evidence |
|---|---|---|
| B0-1 | PASS | [CMD] URL correct; clean; fetch OK, no tag conflict; `origin/master`=`779c0a1`, `origin/production-gate`=C0; ls-remote exactly two heads + `workspace-rename-pre-stage-5` |
| B0-2 | PASS | [CMD] app/schema-path diff C0→master empty → DB compatibility trivially satisfied |
| B0-3 | PASS | [DASH] Branch Tracking `production-gate`; Auto-assign **Disabled** |
| B0-4 | PASS | [DASH] P-ID Production · Current, `52bacc3`, `…jswnhxrle…`, Aug 4 (Ready · Stale = branch-latest badge only) |
| B0-5 | PASS | [DASH] Status 7/7 (Canceled included), All Environments, branch filter `production-gate` → "No Results — No deployments on the production-gate branch match the current filters". Observation (not a stop): the branch-filter header showed "Branch link for production-gate" pointing at the git-master alias — unexplained UI display |
| B0-6 | PASS (ERIK) | Public app: signed in, Star Wars, one node opened/closed, sign-out. **Console baseline: 0 errors; 3 warnings** (React Flow `getRectOfNodes` + `getTransformForBounds` deprecations from `index-BJ_oKPdH.js:57`; `[PostHog.js] You have already initialized PostHog! Re-initializing is a no-op` on sign-out); 8→12 Issues (browser advisories) |
| B0-7 | PASS | [HEAD] 200 text/html, `Last-Modified: Tue, 11 Aug 2026 19:49:23 GMT` |
| **B1 STOP** | **STOP at B1-2, before B1-3** | The as-written `TZ=America/Los_Angeles date` returned the UTC date (`2026-08-16`; the tagger timestamp itself read Aug 15 17:46 -0700). Cause: this Git Bash has no tz database, so `TZ` is ignored [VERIFIED by read-only diagnostic: `date`=PDT, `date -u`=UTC, `TZ=…`=UTC/"GMT", .NET Pacific conversion=PDT]. Misdated tag existed LOCALLY ONLY. **Recovery approved by Erik:** local tag deleted (verified absent; remote had never had it); both date commands (B1, B7-1) replaced with the explicit .NET Pacific conversion; resumed at B1-1. Same defect would have mis-named the `prod-*` tag — fixed before B7 |
| B1-1/B1-2 | PASS | [CMD] `V` absent local+remote; annotated tag created → `779c0a1`, V-TAG-HASH `1f62d724…` |
| B1-3 | PASS | [CMD] push accepted; ls-remote `1f62d724…` + `^{}`=`779c0a1` |
| B1-4 | PASS | [DASH] reads at ~1/3/5 min, 7/7 statuses: no new deployment from the tag push |
| B1-5 | PASS | [CMD] `git push --delete` → **REJECTED** `GH013 … Cannot delete this tag`; remote hash unchanged |
| B1-6 | PASS | [CMD] `git tag -f V 52bacc3` + `git push --force` → **REJECTED** `Cannot force-push to this tag / Cannot update this protected ref`; remote still `1f62d724…`→`779c0a1` |
| B1-7 | PASS | [CMD] local `-d`, fetch, local = remote = `1f62d724…`; clone clean. **Tag ruleset empirically rejects deletion AND forced re-point [VERIFIED]** |
| B2-1 | PASS | [CMD] master ff, HEAD `779c0a1` |
| B2-2/B2-3 | PASS | [CMD] B-SHA `8af7469`; Erik author+committer, no trailer; trees identical; parent `779c0a1`; app diff vs C0 empty; ff-ok |
| B2-4 | PASS | [CMD] `779c0a1..8af7469 master -> master` at 18:00:00 PDT |
| B2-5 | PASS | [DASH] ~1 min: exactly one new row — **Preview**, master, `8af7469`, Ready 19s → PV-ID; Production row unchanged; no `production-gate` row |
| B2-6 | PASS | [HEAD] master alias 302 → `vercel.com/sso-api` |
| B2-7 | PASS | [DASH] PV-ID Ready · **Latest**; master alias listed |
| B3-1 | PASS | [CMD] pre = C0; `git push origin 8af7469…:production-gate` → `52bacc3..8af7469` at 18:01:57 PDT; post = B-SHA |
| **B3-2 — HARD PROOF** | **PASS [VERIFIED]** | [DASH] within ~1 min: new row **Production** (clock icon), `production-gate`, `8af7469`, Ready 19s; detail page **Environment: Production · Staged** (exact [DOCS] label), "Assigning Custom Domains: Skipped", public domain NOT listed; **P-ID still Production · Current** with the public domain. **A genuinely new commit pushed to `production-gate` CREATED a staged Production deployment.** |
| B4-1 | PASS | [HEAD] S-ADDR 302 → `vercel.com/sso-api` |
| B4-2 | PASS (ERIK) | Staged build behind the wall: signed in, Star Wars, node opened/closed, sign-out; console = baseline (0 errors, same 3 warnings; 9 Issues) |
| B4-3 | PASS | [DASH] auto-assign Disabled; Branch Tracking `production-gate`; P-ID still Current |
| B5-1 | PASS (ERIK) | Detail page: URL `TdLdhwDGc3q569ucqhLcpinSY9MG`, Source `production-gate`/`8af7469`, Production · Staged, public domain absent (Erik's screenshot) |
| B5-2 | DONE (ERIK) | Erik promoted via the ⋯ menu; **dialog wording NOT captured** (Erik reported it named `mastermind-story-builder.vercel.app`; he confirmed before screenshotting) — recorded as Erik-reported |
| B5-3 | PASS | [DASH] S-ID detail page: **same ID `TdLdhwDGc…` now Production · Current**, `mastermind-story-builder.vercel.app` listed, still "created 20m ago / 19s" (**no rebuild**); Deployments list: the SAME row carries the Current marker, **no new row**; C0 row now plain Production (previous) |
| **B5-4** | **PASS + FINDING** | [DASH] after the dashboard Promote: **Auto-assign Custom Production Domains still Disabled** ("Production deployments will need to be manually promoted"); Branch Tracking `production-gate`. **Empirical finding, scoped narrowly: in THIS one observed dashboard promotion (2026-08-15), Auto-assign remained Disabled — a single observation, NOT a general guarantee about dashboard promotions.** The [DOCS] re-enable behavior for CLI `vercel promote` / Undo Rollback still stands, and the post-promotion toggle check remains a permanent part of the procedure |
| B6-1 | PASS | [HEAD] 200 text/html; **`Last-Modified: Sun, 16 Aug 2026 01:05:43 GMT`** (= 18:05 PDT, the promotion moment); same Etag as before (served page byte-identical — consistent with a no-change release) |
| B6-2 | PASS (ERIK) | Public app after promotion (hard reload): signed in, Star Wars, node, sign-out; console = baseline (0 errors, same 3 warnings; 12 Issues). **Smoke test PASSED** |
| B7-1/B7-2 | PASS | [CMD] Pacific date via .NET → `prod-2026.08.15`; absent local+remote; annotated at `8af7469` naming S-ID |
| B7-3 | PASS | [CMD] pushed 18:27:37 PDT; ls-remote `620ed78c…` + `^{}`=`8af7469` |
| B7-4 | PASS | [DASH] ~1/3/5 min: no deployment from the tag push; Current still S-ID |
| B8 | this record + doc updates (uncommitted; commit/push proposed separately) | — |

**External writes performed (matches §4 exactly, plus the recovery):** GitHub — 1 empty
commit on master (`8af7469`), `production-gate` ff C0→`8af7469`, tag
`verification-release-tag-protection-2026-08-15`, tag `prod-2026.08.15`; two rejected pushes
(B1-5, B1-6). Vercel — 1 Preview deployment (PV-ID), 1 Production deployment staged then
promoted (S-ID), public domain re-pointed P-ID→S-ID; **no setting changed**. Supabase —
routine bookkeeping writes only (Erik's sign-ins / Star Wars opens). Local — the two
authorized fetches; the misdated local tag created+deleted (never pushed); scratchpad
message file; this file's edits.

**What Phase B proved:** Model S end-to-end [VERIFIED] — new `production-gate` push → staged
Production deployment (hard proof); validation behind Vercel Authentication; promotion
without rebuild (same deployment ID); public smoke test vs recorded baseline; first `prod-*`
tag; tag ruleset rejects delete + force; dashboard promote leaves auto-assign OFF.
**Process finding:** the release-ops shell needs the explicit .NET Pacific-date conversion
(runbook R5's "date = current date in America/Los_Angeles" must be implemented that way —
recorded here for the standing procedure).
