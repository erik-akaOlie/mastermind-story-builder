// ============================================================================
// scripts/copy-campaign-to-demo.js
// ----------------------------------------------------------------------------
// One-shot deep-copy of a campaign from one user account to another.
//
// What it does:
//   1. Resolves source + dest user IDs by email
//   2. Reads the source campaign + all its data (cards, sections, connections,
//      text annotations, image files in Storage)
//   3. Ensures the dest user has a `node_types` row for every type the source
//      cards use (matched by `key`); creates any missing ones
//   4. Inserts a brand-new campaign for the dest user with new UUIDs throughout
//   5. Physically copies image files in Storage to new paths under the new
//      campaign's UUID prefix, and rewrites all path references to match
//
// Idempotency:
//   The script REFUSES to run if the dest user already has a campaign with
//   the target name. Delete that campaign in the dashboard if you want a
//   fresh re-run — DB rows cascade-delete; orphaned Storage files can be
//   purged from the Storage UI separately.
//
// Required env (in .env or .env.local):
//   VITE_SUPABASE_URL              — your project URL (already in .env)
//   SUPABASE_SERVICE_ROLE_KEY      — the SECRET service-role key (NOT the
//                                    anon key); copy from Supabase dashboard
//                                    → Project Settings → API → service_role.
//                                    NEVER commit this. Goes in .env.local
//                                    (which is gitignored).
//
// Run it:
//   node scripts/copy-campaign-to-demo.js
//
// After it finishes:
//   Delete the SUPABASE_SERVICE_ROLE_KEY line from .env.local so the secret
//   isn't sitting on disk.
// ============================================================================

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// ---------- EDIT THESE FOR YOUR RUN ----------
const CONFIG = {
  SOURCE_USER_EMAIL:    'ejolsen23@gmail.com',
  SOURCE_CAMPAIGN_NAME: 'Curse of Strahd',           // exact campaign name
  DEST_USER_EMAIL:      'masterminddemo@gmail.com',
  DEST_CAMPAIGN_NAME:   'Curse of Strahd (Demo)',    // name in the new account
}
// ----------------------------------------------

const BUCKET = 'card-media'

// ---------- env loader (no extra dependency) ----------
function loadEnvFile(path) {
  let contents
  try {
    contents = readFileSync(path, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return
    throw err
  }
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) die('Missing VITE_SUPABASE_URL (expected in .env)')
if (!SERVICE_KEY) die('Missing SUPABASE_SERVICE_ROLE_KEY (expected in .env.local — see header comment)')

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---------- helpers ----------
function die(msg) {
  console.error(`\n  Error: ${msg}\n`)
  process.exit(1)
}

function isStoragePath(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('data:')
    && !value.startsWith('http://')
    && !value.startsWith('https://')
    && !value.startsWith('/')
}

function pathForVariant(path, variant) {
  return path.replace(/\.(full|thumb)\.webp$/, `.${variant}.webp`)
}

function rewriteStoragePath(oldPath, oldCampaignId, newCampaignId, nodeIdMap) {
  // Storage path shape: "{campaignId}/{cardId}/{filename}"
  const parts = oldPath.split('/')
  if (parts.length < 3) return null
  if (parts[0] !== oldCampaignId) return null
  const newNodeId = nodeIdMap[parts[1]]
  if (!newNodeId) return null
  return [newCampaignId, newNodeId, ...parts.slice(2)].join('/')
}

async function findUserIdByEmail(email) {
  const target = email.toLowerCase()
  let page = 1
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const found = data.users.find((u) => (u.email || '').toLowerCase() === target)
    if (found) return found.id
    if (data.users.length < 1000) return null
    page++
  }
}

async function copyStorageFile(fromPath, toPath) {
  const { error } = await sb.storage.from(BUCKET).copy(fromPath, toPath)
  return error
}

// ---------- main ----------
async function main() {
  console.log(`\n  Source:  "${CONFIG.SOURCE_CAMPAIGN_NAME}"  (${CONFIG.SOURCE_USER_EMAIL})`)
  console.log(`  Dest:    "${CONFIG.DEST_CAMPAIGN_NAME}"  (${CONFIG.DEST_USER_EMAIL})\n`)

  // --- 1. Resolve users ---
  const sourceUserId = await findUserIdByEmail(CONFIG.SOURCE_USER_EMAIL)
  if (!sourceUserId) die(`No user found with email ${CONFIG.SOURCE_USER_EMAIL}`)
  const destUserId = await findUserIdByEmail(CONFIG.DEST_USER_EMAIL)
  if (!destUserId) die(`No user found with email ${CONFIG.DEST_USER_EMAIL}`)
  console.log(`  Source user id:  ${sourceUserId}`)
  console.log(`  Dest user id:    ${destUserId}`)

  // --- 2. Resolve source campaign ---
  const { data: sourceCamps, error: scErr } = await sb
    .from('campaigns')
    .select('*')
    .eq('owner_id', sourceUserId)
    .eq('name', CONFIG.SOURCE_CAMPAIGN_NAME)
  if (scErr) throw scErr
  if (sourceCamps.length === 0) die(`No campaign named "${CONFIG.SOURCE_CAMPAIGN_NAME}" owned by ${CONFIG.SOURCE_USER_EMAIL}`)
  if (sourceCamps.length > 1) die(`Found ${sourceCamps.length} campaigns named "${CONFIG.SOURCE_CAMPAIGN_NAME}" — narrow it down`)
  const sourceCamp = sourceCamps[0]
  console.log(`  Source campaign: ${sourceCamp.id}`)

  // --- 3. Refuse if dest already has a campaign with that name ---
  const { data: existingDest, error: edErr } = await sb
    .from('campaigns')
    .select('id, name')
    .eq('owner_id', destUserId)
    .eq('name', CONFIG.DEST_CAMPAIGN_NAME)
  if (edErr) throw edErr
  if (existingDest.length > 0) {
    die(`Dest user already has a campaign named "${CONFIG.DEST_CAMPAIGN_NAME}" (id: ${existingDest[0].id}).
  Delete it from the Supabase dashboard first if you want a fresh re-run.`)
  }

  // --- 4. Load all source data ---
  const [
    { data: sourceNodes,     error: e1 },
    { data: sourceTextNodes, error: e2 },
    { data: sourceConns,     error: e3 },
    { data: sourceTypes,     error: e4 },
    { data: destTypes,       error: e5 },
  ] = await Promise.all([
    sb.from('nodes').select('*').eq('campaign_id', sourceCamp.id),
    sb.from('text_nodes').select('*').eq('campaign_id', sourceCamp.id),
    sb.from('connections').select('*').eq('campaign_id', sourceCamp.id),
    sb.from('node_types').select('*').eq('owner_id', sourceUserId),
    sb.from('node_types').select('*').eq('owner_id', destUserId),
  ])
  if (e1) throw e1
  if (e2) throw e2
  if (e3) throw e3
  if (e4) throw e4
  if (e5) throw e5

  let sourceSections = []
  if (sourceNodes.length > 0) {
    const ids = sourceNodes.map((n) => n.id)
    const { data, error } = await sb.from('node_sections').select('*').in('node_id', ids)
    if (error) throw error
    sourceSections = data
  }

  console.log(`\n  Source data: ${sourceNodes.length} cards, ${sourceSections.length} sections, ${sourceConns.length} connections, ${sourceTextNodes.length} text annotations`)
  console.log(`  Source user has ${sourceTypes.length} node types`)
  console.log(`  Dest user has ${destTypes.length} node types`)

  // --- 5. Type mapping: ensure dest user has every type the source cards use ---
  const sourceTypeById = Object.fromEntries(sourceTypes.map((t) => [t.id, t]))
  const destTypeByKey = Object.fromEntries(destTypes.map((t) => [t.key, t]))
  const usedSourceTypeIds = [...new Set(sourceNodes.map((n) => n.type_id))]
  const typeIdMap = {}
  let typesCreated = 0

  for (const sourceTypeId of usedSourceTypeIds) {
    const sourceType = sourceTypeById[sourceTypeId]
    if (!sourceType) {
      console.warn(`    Warning: source type id ${sourceTypeId} not in source node_types — cards using it will be skipped`)
      continue
    }
    let destType = destTypeByKey[sourceType.key]
    if (!destType) {
      const { data, error } = await sb.from('node_types').insert({
        owner_id:   destUserId,
        key:        sourceType.key,
        label:      sourceType.label,
        color:      sourceType.color,
        icon_name:  sourceType.icon_name,
        is_system:  sourceType.is_system,
        sort_order: sourceType.sort_order,
      }).select().single()
      if (error) throw error
      destType = data
      destTypeByKey[destType.key] = destType
      typesCreated++
      console.log(`    + Created type "${destType.key}" under dest user`)
    }
    typeIdMap[sourceTypeId] = destType.id
  }
  if (typesCreated === 0) console.log(`  All used types already exist on dest user`)

  // --- 6. Insert new campaign ---
  const { data: newCamp, error: ncErr } = await sb.from('campaigns').insert({
    owner_id:        destUserId,
    name:            CONFIG.DEST_CAMPAIGN_NAME,
    description:     sourceCamp.description,
    cover_image_url: sourceCamp.cover_image_url,
  }).select().single()
  if (ncErr) throw ncErr
  console.log(`\n  New campaign id: ${newCamp.id}`)

  // --- 7. Pre-generate node UUIDs and map ---
  const nodeIdMap = {}
  for (const sn of sourceNodes) nodeIdMap[sn.id] = randomUUID()

  // --- 8. Copy avatar files + build new node rows ---
  const newNodeRows = []
  let avatarsCopied = 0, avatarsSkipped = 0, avatarsFailed = 0

  for (const sn of sourceNodes) {
    const newTypeId = typeIdMap[sn.type_id]
    if (!newTypeId) {
      console.warn(`    Skipping card "${sn.label}" (id ${sn.id}): unmapped type`)
      continue
    }
    let newAvatarPath = sn.avatar_url

    if (isStoragePath(sn.avatar_url)) {
      const newPath = rewriteStoragePath(sn.avatar_url, sourceCamp.id, newCamp.id, nodeIdMap)
      if (!newPath) {
        avatarsSkipped++
        newAvatarPath = sn.avatar_url
      } else {
        const fullErr  = await copyStorageFile(pathForVariant(sn.avatar_url, 'full'),  pathForVariant(newPath, 'full'))
        const thumbErr = await copyStorageFile(pathForVariant(sn.avatar_url, 'thumb'), pathForVariant(newPath, 'thumb'))
        if (fullErr || thumbErr) {
          console.warn(`    Avatar copy failed for "${sn.label}": ${(fullErr || thumbErr).message}`)
          avatarsFailed++
          newAvatarPath = null  // RLS would block original path anyway
        } else {
          avatarsCopied++
          newAvatarPath = newPath
        }
      }
    } else {
      // null, base64, https://, or /avatars/* — leave as-is
      avatarsSkipped++
    }

    newNodeRows.push({
      id:          nodeIdMap[sn.id],
      campaign_id: newCamp.id,
      type_id:     newTypeId,
      label:       sn.label,
      summary:     sn.summary,
      avatar_url:  newAvatarPath,
      position_x:  sn.position_x,
      position_y:  sn.position_y,
    })
  }
  console.log(`  Avatars: copied ${avatarsCopied}, passed through ${avatarsSkipped}, failed ${avatarsFailed}`)

  // --- 9. Copy media files + build new section rows ---
  const newSectionRows = []
  let mediaCopied = 0, mediaSkipped = 0, mediaFailed = 0

  for (const sec of sourceSections) {
    const newNodeId = nodeIdMap[sec.node_id]
    if (!newNodeId) continue  // node was skipped

    let newContent = sec.content

    if (sec.kind === 'media' && Array.isArray(sec.content)) {
      const rewritten = []
      for (const entry of sec.content) {
        if (typeof entry === 'string') {
          // Legacy: base64 or /avatars/* — pass through
          rewritten.push(entry)
          mediaSkipped++
          continue
        }
        if (entry && typeof entry === 'object' && typeof entry.path === 'string') {
          if (!isStoragePath(entry.path)) {
            rewritten.push(entry)
            mediaSkipped++
            continue
          }
          const newPath = rewriteStoragePath(entry.path, sourceCamp.id, newCamp.id, nodeIdMap)
          if (!newPath) {
            mediaSkipped++
            continue  // can't safely rewrite — drop
          }
          const fullErr  = await copyStorageFile(pathForVariant(entry.path, 'full'),  pathForVariant(newPath, 'full'))
          const thumbErr = await copyStorageFile(pathForVariant(entry.path, 'thumb'), pathForVariant(newPath, 'thumb'))
          if (fullErr || thumbErr) {
            console.warn(`    Media copy failed for ${entry.path}: ${(fullErr || thumbErr).message}`)
            mediaFailed++
            continue  // drop the broken entry
          }
          rewritten.push({ ...entry, path: newPath })
          mediaCopied++
          continue
        }
        // Unknown shape — pass through
        rewritten.push(entry)
        mediaSkipped++
      }
      newContent = rewritten
    }

    newSectionRows.push({
      node_id:    newNodeId,
      kind:       sec.kind,
      title:      sec.title,
      content:    newContent,
      sort_order: sec.sort_order,
    })
  }
  console.log(`  Media:   copied ${mediaCopied}, passed through ${mediaSkipped}, failed ${mediaFailed}`)

  // --- 10. Insert new node rows ---
  if (newNodeRows.length > 0) {
    const { error } = await sb.from('nodes').insert(newNodeRows)
    if (error) throw error
  }
  console.log(`\n  Inserted ${newNodeRows.length} cards`)

  // --- 11. Insert section rows (chunked) ---
  if (newSectionRows.length > 0) {
    const CHUNK = 200
    for (let i = 0; i < newSectionRows.length; i += CHUNK) {
      const chunk = newSectionRows.slice(i, i + CHUNK)
      const { error } = await sb.from('node_sections').insert(chunk)
      if (error) throw error
    }
  }
  console.log(`  Inserted ${newSectionRows.length} sections`)

  // --- 12. Insert connections ---
  const newConnRows = sourceConns
    .map((c) => ({
      campaign_id:    newCamp.id,
      source_node_id: nodeIdMap[c.source_node_id],
      target_node_id: nodeIdMap[c.target_node_id],
    }))
    .filter((r) => r.source_node_id && r.target_node_id)

  if (newConnRows.length > 0) {
    const { error } = await sb.from('connections').insert(newConnRows)
    if (error) throw error
  }
  const droppedConns = sourceConns.length - newConnRows.length
  console.log(`  Inserted ${newConnRows.length} connections${droppedConns > 0 ? ` (${droppedConns} dropped — referenced unmapped cards)` : ''}`)

  // --- 13. Insert text nodes ---
  const newTextNodeRows = sourceTextNodes.map((t) => ({
    campaign_id:  newCamp.id,
    content_html: t.content_html,
    position_x:   t.position_x,
    position_y:   t.position_y,
    width:        t.width,
    height:       t.height,
    font_size:    t.font_size,
    align:        t.align,
  }))
  if (newTextNodeRows.length > 0) {
    const { error } = await sb.from('text_nodes').insert(newTextNodeRows)
    if (error) throw error
  }
  console.log(`  Inserted ${newTextNodeRows.length} text annotations`)

  console.log(`\n  Done.  New campaign id: ${newCamp.id}`)
  console.log(`  Sign in as ${CONFIG.DEST_USER_EMAIL} to see "${CONFIG.DEST_CAMPAIGN_NAME}".\n`)
}

main().catch((err) => {
  console.error('\n  Migration failed:')
  console.error(err)
  process.exit(1)
})
