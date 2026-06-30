# ADR-0018: Transactional auth email — reusable per-app sending infrastructure
Date: 2026-06-29
Status: Accepted (MasterMind instance shipped + verified end-to-end 2026-06-29)

> **Scope.** This ADR covers **automated transactional auth email** (signup confirmation, password reset, magic links) sent by Supabase Auth. It does **not** cover human/support mailboxes (the inbox a person reads and replies from) — that is a separate concern (see "Out of scope").

## Context

Supabase's built-in auth email sender is test-only: ~2 messages/hour **project-wide** (one shared bucket across all signups) and effectively unusable at launch volume. Supabase Pro does **not** raise this — custom SMTP is the only fix. The Mox free-beta launch (see [ADR-0017](./0017-mox-free-beta-launch.md)) made reliable confirmation email at burst volume a hard launch gate, since email confirmation is the chosen abuse control and must stay on.

Critically, **MasterMind is the first of several apps** Erik plans to launch under the **Just Living the Dream** company (`justlivingthedream.com`). Each future app will have its own beta, its own signups, and the same transactional-email need. So the decision is not "wire email for MasterMind" — it's "establish a reusable per-app email pattern where MasterMind is the first tenant, not a one-off."

Constraints that shaped the choice: **$0 added cost** (Erik is cost-sensitive — no new domains, no paid tiers), use the **already-owned** company domain, and **do not disable email confirmation** to dodge the work.

## Decision

### Architecture: shared infrastructure + per-app sending subdomain

Split into what's built **once for the company** vs. a **quick per-app add**:

**Shared — company-level (build once, reuse forever):**
- **One Resend account** (free tier: 3,000 emails/month, 100/day) sends for *all* apps. Capacity + billing in one place. *(Currently owned under a personal Gmail — flagged to re-home under a company identity; non-blocking, see "Follow-ups.")*
- **The company domain + its DNS at GoDaddy** (`justlivingthedream.com`). All apps' sending records live here as subdomains. See [[project_domains_godaddy]] for the one-letter `justlivin**g**thedream.com` (with "g") vs. `justlivinthedream.com` (no "g", a decoy that redirects) trap.

**Per-app — a fast, repeatable slot:**
- A dedicated sending subdomain **`auth.<app>.justlivingthedream.com`** verified in Resend. Per-app isolation means one app's deliverability problems can never drag down another's. The app name lives *in the subdomain* deliberately — that is isolation, not lock-in.
- Its DNS records (DKIM + SPF: one MX + one TXT). DMARC is optional and **skipped per app** (see below).
- The app's own Supabase project, pointed at the shared Resend account via custom SMTP, with its own sender name, Site URL, and raised email rate limit.

### Why Resend + owned subdomain (over alternatives)
- **Built-in Supabase sender** — rejected: ~2/hr project-wide, breaks at launch.
- **Gmail SMTP** (`contact.mastermind.lab@gmail.com`) — rejected as primary: no DNS setup but fragile deliverability + Google throttling risk mid-launch; kept only as a fragile fallback.
- **New dedicated email domain** — rejected: violates the $0 constraint; the owned company domain works perfectly via subdomains.
- **Resend free tier + owned subdomain** — chosen: best deliverability, $0, ~20–30 min one-time DNS, and naturally per-app via subdomains.

### Two rate limits, two different scopes (the non-obvious gotcha)
After enabling custom SMTP, Supabase imposes its **own** auth-email throttle (default ~30/hour, **project-wide**) — separate from Resend's capacity. This must be raised in **Authentication → Rate Limits → "Rate limit for sending emails"** or a launch burst jams there even though Resend could deliver. Contrast with **"Rate limit for sign-ups and sign-ins"**, which is **per-IP** (default 30/5min) — left at default because distributed users each sit on their own IP, and it doubles as brute-force protection.

### DMARC: skipped per app (for now)
DMARC is **not required** for Resend verification or auth delivery, and Resend's generated record is `p=none` with no reporting address (inert). It would sit at the **org root** (`_dmarc.justlivingthedream.com`), affecting the whole domain. Decision: skip per app; add **one monitored company-level DMARC** deliberately later (with a real `rua` reporting address) as company-wide hygiene — not as part of any single app's launch.

### Secrets handling
The Resend API key is the SMTP password and lives **only** in Supabase's dashboard (server-side, encrypted). It must **never** go in the app's `.env` — Vite bakes `VITE_*` values into client JS shipped to every browser (same rule as the Supabase `service_role` key per `CLAUDE.md`). Rotation = create new key in Resend → paste into Supabase SMTP password + save → *then* delete the old key (order matters: never leave Supabase holding a dead key).

## The repeatable playbook (each future app)

1. **Resend** → add sending domain `auth.<newapp>.justlivingthedream.com` (Manual setup for transparency). Copy the DKIM + SPF records.
2. **GoDaddy** (`justlivin**g**thedream.com` zone) → add the records. GoDaddy's "Name" field is **relative** — enter the host *without* `.justlivingthedream.com` (it's appended automatically). MX gets Priority 10. Leave existing root mail/SPF/DMARC untouched (subdomain-scoped records can't disturb them). Verify in Resend.
3. **Resend** → create a Sending-access API key (the SMTP password). Treat as a secret; do not screenshot.
4. **Supabase** (Authentication → Emails → SMTP Settings) → Enable custom SMTP; Host `smtp.resend.com`, Port `465`, Username `resend` (literal), Password = the API key; Sender email `no-reply@auth.<newapp>.justlivingthedream.com`, Sender name = the product name.
5. **Supabase** (Authentication → URL Configuration) → Site URL = the app's production URL; add `http://localhost:5173/**` for dev.
6. **Supabase** (Authentication → Rate Limits) → raise "Rate limit for sending emails" to ~100/hour.
7. **Verify end-to-end** (don't trust "saved"): a brand-new email (a Gmail `+alias` works) signs up → confirmation email arrives → link lands in the production app; confirm in Resend → Logs; confirm existing sign-in still works. If the key was rotated, re-verify *after* the swap.

## MasterMind instance (first tenant — shipped 2026-06-29)
- Sending subdomain: `auth.mastermind.justlivingthedream.com` (Resend, region us-east-1, GoDaddy DNS) — **Verified**.
- Supabase project `MasterMind-StoryBuilder`: custom SMTP via Resend, sender `no-reply@auth.mastermind.justlivingthedream.com`, sender name `MasterMind`, port 465, email rate limit 100/hr. Site URL already correct (`https://mastermind-story-builder.vercel.app`).
- Verified: real `+alias` signup → inbox (not spam) → link → live app; Resend logs confirm delivery; own sign-in intact; exposed key (briefly shown in a setup screenshot) rotated and old key deleted.

## Consequences

**Enables.** Confirmation email **configured for expected beta volume** — verified end-to-end **once** via a real signup round-trip, **not load-tested** against a literal 50–60-person burst. Plus a documented ~20-minute repeat for every future Just Living the Dream app at $0 marginal cost.

**Known ceiling.** Resend free tier is **100/day, 3,000/month**. That comfortably covers 50–60 beta signups across a launch day, but a *surprise* same-day rush past ~100 would hit the daily cap (excess queues/defers, not a config error). A beta-scale ceiling, not a 100k-user one — a provider/plan upgrade later, no architecture change.

**Trade-offs accepted.**
- Per-app subdomains mean a small DNS setup per app (the playbook makes it mechanical).
- Beta-scale capacity only (see Known ceiling above); a provider/plan upgrade is a future, no-architecture-change step.
- DMARC deferred to a future company-level step.

## Follow-ups (non-blocking)
- **Re-home the Resend account** from personal Gmail to a company identity (an address on `justlivingthedream.com`). Easy now while only one domain exists. See [[project_auth_email_smtp_setup]].
- **Company-level monitored DMARC** at `_dmarc.justlivingthedream.com` once a couple apps send.

## References
- [ADR-0017](./0017-mox-free-beta-launch.md) — the launch this gated.
- `CLAUDE.md` Environment Variables — the `VITE_*` client-bundling rule that keeps secrets out of `.env`.
- BACKLOG: "Custom SMTP for auth email — LAUNCH BLOCKER" (closed by this work).
- Memory: [[project_domains_godaddy]], [[project_auth_email_smtp_setup]].
