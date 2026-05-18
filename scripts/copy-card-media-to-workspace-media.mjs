#!/usr/bin/env node
/**
 * copy-card-media-to-workspace-media.mjs
 * ---------------------------------------------------------------------------
 * One-shot script that copies every object from the `card-media` Storage
 * bucket to the new `workspace-media` bucket as part of the campaign ->
 * workspace rename (ADR-0012, migration 007).
 *
 * SAFETY: leaves the source objects in place. The destructive cleanup
 * (drop `card-media` bucket) is a separate, later step that runs only
 * after verifying renders work against `workspace-media`.
 *
 * REQUIREMENTS:
 *   - SUPABASE_URL          — your project's URL (https://<ref>.supabase.co)
 *   - SUPABASE_SERVICE_ROLE — service-role key (NOT the anon key). Service
 *                             role bypasses RLS so we can list and copy
 *                             every object regardless of owner.
 *
 * USAGE:
 *   $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE="..."
 *   node scripts/copy-card-media-to-workspace-media.mjs
 *
 *   Add `--dry-run` to list what would be copied without copying.
 *
 * IDEMPOTENT: re-runs skip objects that already exist in workspace-media
 * (Supabase's upload returns a 409-ish error on collision; we treat that
 * as "already done" and continue).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL          = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
const DRY_RUN               = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE first.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SOURCE = 'card-media'
const TARGET = 'workspace-media'

/**
 * Recursively list every object under a given prefix. Supabase's
 * storage.list returns only the immediate children, so we walk the tree.
 */
async function listAll(bucket, prefix = '') {
  const out = []
  // 1000 is the documented page size cap.
  let offset = 0
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`list ${bucket}/${prefix} failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
      // entry.id is null when it's a "folder" (a synthetic listing entry
      // that represents a path prefix). Recurse into it.
      if (entry.id === null || entry.id === undefined) {
        const nested = await listAll(bucket, fullPath)
        out.push(...nested)
      } else {
        out.push({ path: fullPath, size: entry.metadata?.size ?? 0 })
      }
    }
    if (data.length < 1000) break
    offset += data.length
  }
  return out
}

async function downloadObject(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw new Error(`download ${bucket}/${path} failed: ${error.message}`)
  // data is a Blob; convert to ArrayBuffer for the upload.
  return await data.arrayBuffer()
}

async function uploadObject(bucket, path, arrayBuffer, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType,
    upsert: false, // refuse to clobber; rerunning skips already-copied objects
  })
  if (error) {
    // Supabase returns a Duplicate error when the object exists with upsert: false.
    if (/already exists|duplicate/i.test(error.message)) {
      return { skipped: true, reason: 'already in target' }
    }
    throw new Error(`upload ${bucket}/${path} failed: ${error.message}`)
  }
  return { skipped: false }
}

function inferContentType(path) {
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.png'))  return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

async function main() {
  console.log(`[copy] source: ${SOURCE}`)
  console.log(`[copy] target: ${TARGET}`)
  console.log(`[copy] dry-run: ${DRY_RUN}`)

  console.log('[copy] listing objects in source bucket...')
  const objects = await listAll(SOURCE)
  console.log(`[copy] found ${objects.length} objects`)

  if (DRY_RUN) {
    for (const { path, size } of objects) {
      console.log(`  ${path}  (${size} B)`)
    }
    console.log('[copy] dry-run complete; nothing copied.')
    return
  }

  let copied = 0
  let skipped = 0
  let failed = 0

  for (const { path } of objects) {
    try {
      const contentType = inferContentType(path)
      const buf = await downloadObject(SOURCE, path)
      const result = await uploadObject(TARGET, path, buf, contentType)
      if (result.skipped) {
        skipped += 1
        if (skipped <= 5 || skipped % 50 === 0) {
          console.log(`  skip (already in target): ${path}`)
        }
      } else {
        copied += 1
        if (copied <= 5 || copied % 50 === 0) {
          console.log(`  copied: ${path}`)
        }
      }
    } catch (err) {
      failed += 1
      console.error(`  FAIL: ${path}: ${err.message}`)
    }
  }

  console.log(`[copy] done. copied=${copied}, skipped=${skipped}, failed=${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('[copy] fatal:', err)
  process.exit(1)
})
