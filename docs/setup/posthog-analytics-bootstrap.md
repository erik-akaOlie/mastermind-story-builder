# PostHog Analytics — Bootstrap Walkthrough

One-time setup steps to run before the code-side wiring lands.

**Total time:** ~5 minutes.

**Status check before you start:** open a fresh PowerShell terminal at
the project root. Run:

```powershell
git status
```

You should see "On branch master" and either "Your branch is up to
date with 'origin/master'" or "ahead of 'origin/master' by N commits".
Untracked avatars in `public/avatars/` and `weekly-updates/drafts/...`
are expected and ignored.

If anything else shows up modified, stop and reconcile first.

---

## Step 1 — Add the PostHog keys to your local `.env`

You have a `.env` file at the project root with two existing entries:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Open `.env` in a text editor and **append the following two lines at
the bottom**, replacing `phc_xxxx...` with the project token from your
PostHog dashboard (Project Settings → Project API Key):

```
VITE_POSTHOG_KEY=phc_xxxx_paste_your_real_token_here
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

If your PostHog project was created in the EU region instead, use
`https://eu.i.posthog.com` for the host. If you don't know which
region you picked, log into PostHog — the URL bar will say either
`us.posthog.com` or `eu.posthog.com`. Use the matching ingest host.

**Save the file.**

**Verify visually:** open `.env` again and confirm you see four lines
total, two for Supabase and two for PostHog. The PostHog token line
should start with `VITE_POSTHOG_KEY=phc_` followed by your real token.

---

## Step 2 — Run migration 004 in the Supabase SQL Editor

This adds the `is_test_user` column to `public.profiles`, which gates
the PostHog SDK to invited testers only.

1. Open your Supabase project dashboard in a browser.
2. In the left sidebar, click **SQL Editor**.
3. Click **+ New query** (top-right of the editor).
4. **Copy the entire contents** of
   [`supabase/migrations/004_is_test_user_flag.sql`](../../supabase/migrations/004_is_test_user_flag.sql)
   and paste it into the SQL editor pane. The comment block at the top
   is safe to paste — it's just SQL comments.
5. Click **Run** (bottom-right of the editor, or `Ctrl+Enter`).

**Verify visually:** the Results pane should show "Success. No rows
returned." with a green check. No red error message.

---

## Step 3 — Confirm the column exists

In the same SQL Editor, replace your query with this:

```sql
SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'is_test_user';
```

Click **Run** again.

**Verify visually:** the Results pane should show exactly one row:

| column_name  | data_type | column_default |
|---|---|---|
| is_test_user | boolean   | false          |

If you see zero rows, Step 2 didn't apply — re-run it.

---

## Step 4 — Confirm all existing profiles defaulted to false

Run one more query in the SQL Editor:

```sql
SELECT count(*) AS total_profiles,
       count(*) FILTER (WHERE is_test_user = true) AS test_users,
       count(*) FILTER (WHERE is_test_user = false) AS regular_users
  FROM public.profiles;
```

**Verify visually:** `test_users` should be `0`. `regular_users` should
equal `total_profiles`. Every existing profile (yours plus any testers
who already have accounts) starts off NOT being recorded — which is
exactly what we want.

---

## What NOT to do yet

- **Do not flag anyone as `is_test_user = true` yet.** The PostHog SDK
  isn't wired up; flipping the flag now has no effect except to record
  zero sessions while the SDK doesn't exist. Flagging happens in the
  next session, after the SDK is in place, so we can verify it
  actually starts recording.
- **Do not commit your edited `.env`.** The `.gitignore` already
  blocks `.env`, so this should be a non-issue, but worth saying.
- **Do not share your PostHog Project API Key publicly.** It's a
  write-only ingest key (someone with it can send events to your
  project, but can't read your data or change settings), so it's safe
  to ship in frontend code — but treating it as semi-private is still
  the right default.

---

## You're done

Bootstrap is complete. Next session picks up with the code-side
wiring:

- Install `posthog-js` as a dependency
- Add `is_test_user` to `ProfileContext`
- Conditionally initialize the PostHog SDK based on the flag
- Wire up the ~10–15 named events from ADR-0009
- Apply content-masking selectors to card titles, summaries, bullet
  lists, and text annotations
- Flag your own profile `is_test_user = true` temporarily to verify
  the SDK loads and records, then flip it back to `false` before
  tester invites go out

If anything in Steps 1–4 didn't go as described — different output,
error message, missing column — capture exactly what you saw and
we'll diagnose in the next session before continuing.

See ADR-0009 for the full design rationale:
[`docs/decisions/0009-behavioral-analytics-session-replay.md`](../decisions/0009-behavioral-analytics-session-replay.md)
