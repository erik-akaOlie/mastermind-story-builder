# ADR-0020: Release-pipeline cutover — staged Production behind a deployment-control branch

**Status:** Accepted
**Date:** 2026-08-13 (decisions ratified 2026-08-06–08; executed 2026-08-13)
**Deciders:** Erik (product/ops owner), with CC execution and an external advisory review
loop (Erik's ChatGPT chat) across the reviewed runbook revisions (v1 through v5.2) and the
in-flight amendments (v5.3, -b, -c).

## Context

Until 2026-08-13, pushing `master` deployed the public production app instantly, local dev
and every Vercel Preview build carried Production database credentials, and no branch or tag
protections existed. The launch queue was deliberately paused behind fixing this.

## Decision (Model S — staged Production, validated before promotion)

1. **`production-gate` is the deployment-control branch.** Vercel Production Branch
   Tracking = `production-gate` (flipped from `master` at step A17). It advances
   fast-forward-only to individually approved commits, one push per release (R1).
2. **Auto-assign Custom Production Domains = OFF.** The configured and required Model S
   behavior: a push to `production-gate` creates a *staged* Production deployment that
   does NOT serve the public domain until manually promoted (R3) after validation (R2).
   Promotion is the release act, not the push. **Empirically PROVEN 2026-08-15 (Phase B
   rehearsal):** the first genuinely new commit pushed to `production-gate` (`8af7469`)
   created a "Production · Staged" deployment that did not touch the public domain; Erik
   promoted it from the dashboard without rebuild (same deployment ID
   `TdLdhwDGc3q569ucqhLcpinSY9MG` became Current); the smoke test passed; the first release
   tag `prod-2026.08.15` was created. See "Phase B amendment" below.
3. **`master` is the integration branch → Preview environment.** Master pushes build
   Preview deployments with real app configuration via branch-pinned env vars
   (Preview/`master` scope), reachable at the stable generated alias
   `mastermind-story-builder-git-master-erik-akaolies-projects.vercel.app`, behind Vercel
   Authentication (Standard Protection). General Preview and Development carry NO
   Production-data-bearing variables — Unpinned branches receive no Production-data-bearing variables. In the controlled A8 verification, the current build failed closed: startup exception, no sign-in surface, zero Production-host requests, and the Production hostname absent from every JavaScript asset loaded and inspected during that test.
4. **GitHub rulesets (bypass lists empty, enforcement active):**
   `protect-release-branches` (id 20819599) — `master` + `production-gate`, deletions and
   force pushes blocked; `protect-release-tags` (id 20819712) — `prod-*` +
   `verification-release-tag-*`, updates/deletions/force pushes blocked.
5. **Release record** = Vercel Production history + `prod-YYYY.MM.DD[.n]` annotated tags
   (created only after the post-promotion smoke test, R5) + the QA record. Rollback =
   Instant Rollback to a named, retention-checked target (R0), with the incident procedure
   in the runbook §5.
6. **All release Git operations run in a dedicated clone**
   (`C:\Users\erik\projects\mastermind-release-ops`), never the main working folder.

The full standing procedure (R0–R5), rollback/incident handling, and Phase B rehearsal plan
live in `QA/release-pipeline-cutover-runbook-v5.3-2026-08-13.md` (§4–§6) — the runbook is
the operational source of truth; this ADR records the architecture and the decision trail.

## As-executed facts worth preserving (2026-08-13)

- **C0 = `52bacc3`** was the fixed starting commit; the live Production deployment
  (`Eu1r5aDjpQzPnPweqWiBnfhLRpfb`, address `…jswnhxrle…`, Aug 4) was verified unchanged
  before and after the branch flip.
- **Four obsolete real-credential Preview deployments (T1–T4) were deleted** after per-page
  five-identifier verification; at A27 their deployment addresses returned
  `404: DEPLOYMENT_NOT_FOUND` and the two historical branch aliases returned
  `404: NOT_FOUND` — no public content in either case. The A7 fail-closed throwaway
  deployment remains in history behind the login wall by design (aging out via retention).
- **Vercel behavior facts observed:** (a) the delete-deployment confirmation dialog is
  generic — target identity lives on the deployment detail page; (b) after pushing the
  existing, already-built commit as a NEW branch (`production-gate` at C0), **no
  production-gate deployment was observed through CP-7 and no deployment address was
  recorded** — cause unestablished; Phase B's first genuinely new approved commit pushed
  to `production-gate` is a hard proof point that MUST produce a staged Production
  deployment.
- **A22 audit:** Supabase Auth Site URL = the public production domain; redirect allow-list
  = public domain `/**` + `localhost:5173/**`. Password sign-in performs no redirect, so
  the master alias works for testing without any Supabase change. Phase D (custom domain)
  will revisit these values under its own proposal.
- **Three-device verification (A25/A26):** desktop + Android + iPhone all reached real data
  through the master alias, and a `PIPELINE-QA-VERIFICATION` node was created, propagated,
  deleted, and confirmed absent everywhere (the only production-data write of the cutover).
- The master push freeze held from the first PRE-4 approval through exactly one push
  (A23's empty commit `5acc5b9`, tree-identical to C0).

## Phase B amendment (2026-08-15) — rehearsal executed; Model S proven

Record: `QA/release-pipeline-phase-b-rehearsal-checklist-v1-2026-08-15.md` §8 and the facts
sheet's "Phase B record". Facts that change or sharpen this ADR:

- **The staged-deployment behavior is proven [VERIFIED]** (a genuinely new `production-gate`
  push → "Production · Staged"; the A15 no-deployment outcome was specific to creating the
  branch at an already-built commit and is not the normal case).
- **Promotion does not rebuild [VERIFIED]** — the deployment ID is preserved across
  promotion; verify "Current = the staged ID" at every R3.
- **In this one observed dashboard promotion (2026-08-15), Auto-assign Custom Production
  Domains remained Disabled [VERIFIED, single observation]** — not a general guarantee
  about dashboard promotions. The [DOCS] re-enable warning for CLI `vercel promote` and
  Undo Rollback still applies; the post-promotion toggle check remains a permanent part
  of the procedure.
- **Tag ruleset proven [VERIFIED]:** deletion and forced re-point of a
  `verification-release-tag-*` tag are rejected by GitHub with bypass lists empty; the
  permanent artifact is `verification-release-tag-protection-2026-08-15` → `779c0a1`.
- **Release record begins:** `prod-2026.08.15` → `8af7469`, annotated with the promoted
  deployment ID. Previous Production P-ID `Eu1r5…` (C0) is retained as that release's
  rollback target.
- **R5 date requirement (enduring):** the release-tag date is the **America/Los_Angeles
  calendar date**, and the method used to compute it must be **proven in the release-ops
  execution environment**. Currently proven on the Windows release-ops machine: the
  explicit .NET/PowerShell time-zone conversion (recorded in CLAUDE.md). Known-invalid in
  that environment's Git Bash: `TZ=America/Los_Angeles date …` — it returned the UTC date
  (no tz database). Discovered by a stop before anything was pushed; recovered under a
  separate approval. The specific command is an implementation detail, not architecture.

## Consequences

- Pushing `master` no longer touches production. Under the approved operating procedure,
  the public app changes only via R1–R3 (approved push to `production-gate`, staged
  validation, manual promote) — a process rule, not a technical impossibility: a project
  administrator could still make out-of-process Vercel changes, which the procedure,
  rulesets, and records are designed to make deliberate and visible rather than prevent
  absolutely.
- Every release needs Erik's explicit approval. Each SUCCESSFUL release (validation and
  smoke test passed) produces its protected `prod-*` tag + QA record; failed validation
  or smoke testing does not produce a release tag.
- Local dev still points at Production. Local isolation is the next workstream;
  subsequent launch gates — including focused security readiness, domain transition,
  proven backups, and migration 016 — are tracked in `BACKLOG.md` and require separate
  approval.
- Promotion/Undo Rollback can silently re-enable domain auto-assign [DOCS]; §5 step 8 of
  the runbook makes checking it part of every incident recovery.

## Rejected alternatives

- **Model G (git-driven production from a protected branch, no staging):** rejected — no
  pre-promotion validation of the exact production artifact.
- **Vercel custom environment for staging:** available on Pro (one custom environment is
  included at no additional charge) but unused — the branch-based Preview model meets the
  current need without adding unnecessary environment and operational complexity; revisit
  only with a separately approved need.
- **Forcing a deployment for `production-gate` at creation (empty commit / manual deploy):**
  rejected during execution — would have made the control branch diverge from approved
  history or normalized workarounds; the branch's first deployment is expected during
  Phase B's rehearsal and its absence there is a hard stop.
