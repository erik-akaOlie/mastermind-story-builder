// ============================================================================
// delete-account Edge Function
// ----------------------------------------------------------------------------
// Server-side account deletion. Invoked by the authenticated client when the
// user clicks "Delete account" on the Profile page. Performs three things the
// client cannot do itself:
//
//   1. Delete every storage object under the user's prefix in profile-media
//      (path: {userId}/...) and under each owned workspace's prefix in
//      workspace-media (path: {workspaceId}/{cardId}/...).
//   2. Issue a PostHog person-delete so session recordings and other
//      user-scoped events are wiped from PostHog (GDPR-aligned).
//   3. Delete the auth.users row. The cascade chain wipes profiles,
//      workspaces, node_types, nodes, connections, text_nodes, and
//      node_sections automatically (see schema.sql).
//
// Order matters: we read workspace IDs BEFORE deleting auth.users because
// the cascade wipes them and we'd lose the storage-cleanup paths.
//
// Failure model:
//   - Storage and PostHog errors are logged server-side and DO NOT block
//     account deletion. Orphaned objects/events are invisible to the user;
//     the user-facing commitment is "your account is deleted."
//   - auth.users delete failure IS surfaced — the account survives and the
//     user can retry.
//
// Auth: `verify_jwt = true` in config.toml means the Supabase platform
// validates the caller's JWT at the edge and rejects unauthenticated
// requests before this code runs. We re-derive the user inside the function
// from the same JWT to know whose account to delete.
// ============================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const POSTHOG_PERSONAL_API_KEY  = Deno.env.get('POSTHOG_PERSONAL_API_KEY')
const POSTHOG_PROJECT_ID        = Deno.env.get('POSTHOG_PROJECT_ID')
// IMPORTANT: PostHog has two subdomains. `us.i.posthog.com` is the event
// ingest endpoint (used by posthog-js in the browser). `us.posthog.com` is
// the app + management REST API, which is what we need for the persons
// lookup/delete endpoints below. Defaulting to the wrong one causes the
// lookup to silently return zero results — fixed 2026-05-27.
// Set POSTHOG_HOST=https://eu.posthog.com (no `.i.`) if you're on EU cloud.
const POSTHOG_HOST              = Deno.env.get('POSTHOG_HOST') ?? 'https://us.posthog.com'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ error: 'method not allowed' }, 405)

  try {
    // verify_jwt=true already validated the token at the platform edge.
    // We still need to extract it to identify the user.
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: 'unauthorized' }, 401)
    const jwt = authHeader.slice('Bearer '.length)

    // Service-role client bypasses RLS and can call admin auth APIs.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData?.user) return json({ ok: false, error: 'unauthorized' }, 401)
    const userId = userData.user.id

    // Collect owned workspaces BEFORE the cascade wipes them.
    const { data: workspaces, error: wsErr } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId)
    if (wsErr) throw new Error(`workspaces fetch: ${wsErr.message}`)
    const workspaceIds = (workspaces ?? []).map((w) => w.id as string)

    // Best-effort cleanup. Failures are logged WITH userId so they can be
    // correlated and investigated later via `supabase functions logs`; they
    // do not block account deletion.
    await safeCleanup(userId, 'profile-media',
      () => removeAllUnderPrefix(admin, 'profile-media', userId))
    for (const wsId of workspaceIds) {
      await safeCleanup(userId, `workspace-media/${wsId}`,
        () => removeAllUnderPrefix(admin, 'workspace-media', wsId))
    }
    await safeCleanup(userId, 'posthog', () => deletePersonInPostHog(userId))

    // The committed step. Cascades through everything in Postgres.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) throw new Error(`auth.users delete: ${delErr.message}`)

    console.log(`[delete-account] user=${userId} succeeded`)
    return json({ ok: true })
  } catch (e) {
    console.error('[delete-account] failed:', e)
    return json({ ok: false, error: (e as Error).message ?? 'unknown error' }, 500)
  }
})

async function safeCleanup(userId: string, label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e) {
    console.error(`[delete-account] user=${userId} ${label} cleanup failed (continuing):`, e)
  }
}

// ----------------------------------------------------------------------------
// Recursively list and remove every object under `prefix` in `bucket`.
//
// Supabase Storage `.list()` returns immediate children only (folders AND
// files). Folder entries are recognised by `entry.id == null`. Today's
// layouts are typically shallow (profile-media: {userId}/file; workspace-media:
// {workspaceId}/{cardId}/file), but the recursion is depth-agnostic by
// design — if the layout grows deeper later, this function still empties
// the prefix correctly with no edit.
//
// Pagination: `.list()` defaults to limit=100. We loop until we get fewer
// than `pageSize` results, which signals the end. Real accounts will be
// well under this, but the loop costs nothing.
// ----------------------------------------------------------------------------
async function removeAllUnderPrefix(admin: SupabaseClient, bucket: string, prefix: string) {
  const filePaths: string[] = []
  const pageSize = 100
  let offset = 0

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit:  pageSize,
      offset,
    })
    if (error) throw error
    if (!data || data.length === 0) break

    for (const entry of data) {
      const childPath = `${prefix}/${entry.name}`
      if (entry.id) {
        filePaths.push(childPath)
      } else {
        await removeAllUnderPrefix(admin, bucket, childPath)
      }
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  if (filePaths.length > 0) {
    const { error } = await admin.storage.from(bucket).remove(filePaths)
    if (error) throw error
  }
}

// ----------------------------------------------------------------------------
// PostHog person-delete.
//
// Two-step: PostHog's REST API addresses persons by internal numeric `id`,
// but we identify users by Supabase user UUID (which we set as PostHog
// distinct_id in analytics.js). So we look up the person first, then delete.
//
// `delete_events=true` is what causes session recordings + all captured
// events to be deleted alongside the person record. Without it, only the
// person record is removed and events remain.
//
// No-op when env secrets are absent (e.g. local dev) or the user was never
// a tester (no PostHog record). Treats 404 as success — same end state.
// ----------------------------------------------------------------------------
async function deletePersonInPostHog(distinctId: string) {
  if (!POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID) {
    console.log(
      `[delete-account] posthog skipped: ` +
      `key=${POSTHOG_PERSONAL_API_KEY ? 'set' : 'missing'} ` +
      `projectId=${POSTHOG_PROJECT_ID ? 'set' : 'missing'}`,
    )
    return
  }

  const headers = { Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}` }

  const lookupUrl =
    `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/persons/` +
    `?distinct_id=${encodeURIComponent(distinctId)}`
  const lookup = await fetch(lookupUrl, { headers })
  if (!lookup.ok) {
    const body = await lookup.text()
    throw new Error(`posthog lookup ${lookup.status}: ${body}`)
  }
  const lookupJson = await lookup.json() as { results?: Array<{ id: number | string }> }
  const foundCount = lookupJson.results?.length ?? 0
  console.log(`[delete-account] posthog lookup distinct_id=${distinctId} found=${foundCount}`)
  const personId = lookupJson.results?.[0]?.id
  if (personId == null) return  // not a tester; nothing to delete

  const deleteUrl =
    `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/persons/${personId}/` +
    `?delete_events=true`
  const del = await fetch(deleteUrl, { method: 'DELETE', headers })
  console.log(`[delete-account] posthog delete person_id=${personId} status=${del.status}`)
  if (!del.ok && del.status !== 404) {
    const body = await del.text()
    throw new Error(`posthog delete ${del.status}: ${body}`)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
