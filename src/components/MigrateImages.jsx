// ============================================================================
// MigrateImages
// ----------------------------------------------------------------------------
// One-shot in-app tool that moves legacy base64 images out of the database
// and into Supabase Storage per ADR-0005. Visited at /#migrate.
//
// Flow:
//   1. Scan every campaign the signed-in user owns (RLS scopes the queries).
//   2. Collect avatars (nodes.avatar_url) and inspiration entries
//      (node_sections.content for kind='media') that still hold base64 strings.
//   3. On click, for each item: decode → transcode to two WebP variants →
//      upload to card-media → rewrite the DB reference to the new path.
//   4. Avatars become a plain path string in nodes.avatar_url.
//      Inspiration entries become { path, alt, uploaded_at } objects in the
//      JSONB media array (per ADR-0005).
//
// Idempotent: re-running picks up only the entries still in base64 form.
// Delete this file (and its route in main.jsx) once Erik's data has migrated.
// ============================================================================

import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import {
  base64ToBlob,
  buildImagePath,
  isBase64DataUri,
  slugify,
  transcodeImage,
} from '../lib/imageStorage.js'

const BUCKET = 'card-media'
const SYSTEM_BLUE = '#0284C7'

export default function MigrateImages() {
  const [scanning, setScanning] = useState(true)
  const [scanError, setScanError] = useState(null)
  const [items, setItems] = useState([])
  const [running, setRunning] = useState(false)
  const [doneCount, setDoneCount] = useState(0)
  const [errors, setErrors] = useState([])
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    scan()
      .then(setItems)
      .catch((err) => setScanError(err.message))
      .finally(() => setScanning(false))
  }, [])

  async function runMigration() {
    setRunning(true)
    setErrors([])
    setDoneCount(0)
    for (const item of items) {
      try {
        await migrateOne(item)
        setDoneCount((d) => d + 1)
      } catch (err) {
        setErrors((e) => [...e, { label: item.label, kind: item.kind, message: err.message }])
      }
    }
    setRunning(false)
    setFinished(true)
  }

  function backToCanvas() {
    window.location.hash = ''
    window.location.reload()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-8">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-8">
        <button
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
          onClick={backToCanvas}
        >
          <ArrowLeft size={16} weight="bold" />
          Back to canvas
        </button>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Migrate images to Storage
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Moves any image still stored as base64 inside the database into the
          <code className="mx-1 px-1 py-0.5 bg-gray-100 rounded text-xs">card-media</code>
          bucket. Safe to run; safe to re-run.
        </p>

        {scanning && <Status text="Scanning your campaigns…" />}

        {scanError && (
          <ErrorBox
            title="Couldn't scan"
            body={scanError}
            hint="If this says 'bucket not found' or similar, run supabase/migrations/002_card_media_bucket.sql in the Supabase SQL Editor first."
          />
        )}

        {!scanning && !scanError && items.length === 0 && (
          <Status
            icon={<CheckCircle size={20} weight="fill" color="#16a34a" />}
            text="Nothing to migrate. Every image is already in Storage."
          />
        )}

        {!scanning && !scanError && items.length > 0 && (
          <>
            <Summary items={items} />

            <div className="flex items-center gap-3 mt-6">
              <button
                className="px-4 py-2 rounded-md text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: SYSTEM_BLUE }}
                disabled={running || finished}
                onClick={runMigration}
              >
                {running
                  ? `Migrating… ${doneCount} / ${items.length}`
                  : finished
                    ? 'Done'
                    : `Start migration (${items.length} image${items.length === 1 ? '' : 's'})`}
              </button>

              {finished && (
                <button
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                  onClick={backToCanvas}
                >
                  Back to canvas
                </button>
              )}
            </div>

            {running && (
              <ProgressBar current={doneCount} total={items.length} />
            )}

            {errors.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-2">
                  <WarningCircle size={18} weight="fill" />
                  {errors.length} item{errors.length === 1 ? '' : 's'} failed
                </div>
                <ul className="text-xs text-gray-700 space-y-1 max-h-48 overflow-y-auto">
                  {errors.map((e, i) => (
                    <li key={i} className="border-l-2 border-red-300 pl-2">
                      <span className="font-medium">{e.kind}</span> on “{e.label || 'Untitled'}”: {e.message}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Re-run the migration to retry failed items — successful ones won't be re-uploaded.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Summary({ items }) {
  const avatars = items.filter((i) => i.kind === 'avatar').length
  const media = items.filter((i) => i.kind === 'media').length
  const totalBytes = items.reduce((sum, i) => sum + i.estimatedBytes, 0)
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
      <div className="flex justify-between">
        <span>Card avatars</span>
        <span className="font-medium">{avatars}</span>
      </div>
      <div className="flex justify-between mt-1">
        <span>Inspiration images</span>
        <span className="font-medium">{media}</span>
      </div>
      <div className="flex justify-between mt-1 pt-2 border-t border-gray-200">
        <span>Approx. data to move</span>
        <span className="font-medium">{formatBytes(totalBytes)}</span>
      </div>
    </div>
  )
}

function ProgressBar({ current, total }) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100)
  return (
    <div className="mt-4">
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: SYSTEM_BLUE }}
        />
      </div>
    </div>
  )
}

function Status({ icon, text }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      {icon}
      {text}
    </div>
  )
}

function ErrorBox({ title, body, hint }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <div className="text-sm font-medium text-red-800 mb-1">{title}</div>
      <div className="text-xs text-red-700 mb-2">{body}</div>
      {hint && <div className="text-xs text-red-600">{hint}</div>}
    </div>
  )
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

// ============================================================================
// Scanning
// ============================================================================

async function scan() {
  // RLS limits these to campaigns/nodes/sections the user owns.
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id')
  if (campErr) throw campErr
  if (!campaigns || campaigns.length === 0) return []

  const campaignIds = campaigns.map((c) => c.id)

  const { data: nodeRows, error: nodesErr } = await supabase
    .from('nodes')
    .select('id, label, avatar_url, campaign_id')
    .in('campaign_id', campaignIds)
  if (nodesErr) throw nodesErr

  const nodeIds = nodeRows.map((n) => n.id)
  const nodeById = Object.fromEntries(nodeRows.map((n) => [n.id, n]))

  let mediaRows = []
  if (nodeIds.length > 0) {
    const { data, error } = await supabase
      .from('node_sections')
      .select('id, node_id, content')
      .eq('kind', 'media')
      .in('node_id', nodeIds)
    if (error) throw error
    mediaRows = data || []
  }

  const items = []

  for (const n of nodeRows) {
    if (isBase64DataUri(n.avatar_url)) {
      items.push({
        kind: 'avatar',
        campaignId: n.campaign_id,
        nodeId: n.id,
        label: n.label,
        base64: n.avatar_url,
        estimatedBytes: estimateBase64Bytes(n.avatar_url),
      })
    }
  }

  for (const s of mediaRows) {
    const arr = Array.isArray(s.content) ? s.content : []
    arr.forEach((entry, indexInArray) => {
      if (typeof entry === 'string' && isBase64DataUri(entry)) {
        const node = nodeById[s.node_id]
        if (!node) return
        items.push({
          kind: 'media',
          campaignId: node.campaign_id,
          nodeId: s.node_id,
          sectionId: s.id,
          indexInArray,
          label: node.label,
          base64: entry,
          estimatedBytes: estimateBase64Bytes(entry),
        })
      }
    })
  }

  return items
}

// Base64 inflates ~33%; the decoded blob is roughly 3/4 of the string length.
function estimateBase64Bytes(dataUri) {
  if (typeof dataUri !== 'string') return 0
  const commaIdx = dataUri.indexOf(',')
  const payloadLen = commaIdx === -1 ? dataUri.length : dataUri.length - commaIdx - 1
  return Math.round(payloadLen * 0.75)
}

// ============================================================================
// Migration of a single item
// ============================================================================

async function migrateOne(item) {
  const blob = base64ToBlob(item.base64)
  const variants = await transcodeImage(blob)
  const slug = slugify(item.label)
  const timestamp = Date.now()
  const section = item.kind === 'avatar' ? 'avatar' : 'inspiration'

  // Upload both variants. Failure here aborts before we touch the DB, so the
  // base64 source is preserved for a retry.
  for (const [variant, b] of Object.entries(variants)) {
    const path = buildImagePath({
      campaignId: item.campaignId,
      cardId: item.nodeId,
      section,
      slug,
      timestamp,
      variant,
    })
    const { error } = await supabase.storage.from(BUCKET).upload(path, b, {
      contentType: 'image/webp',
      upsert: false,
    })
    if (error) throw error
  }

  const fullPath = buildImagePath({
    campaignId: item.campaignId,
    cardId: item.nodeId,
    section,
    slug,
    timestamp,
    variant: 'full',
  })

  if (item.kind === 'avatar') {
    const { error } = await supabase
      .from('nodes')
      .update({ avatar_url: fullPath })
      .eq('id', item.nodeId)
    if (error) throw error
    return
  }

  // For media: read the array fresh, swap this index, write it back. The
  // outer loop is sequential so this read-modify-write doesn't race with
  // itself across entries in the same array.
  const { data: section_, error: readErr } = await supabase
    .from('node_sections')
    .select('content')
    .eq('id', item.sectionId)
    .single()
  if (readErr) throw readErr

  const arr = Array.isArray(section_.content) ? [...section_.content] : []
  arr[item.indexInArray] = {
    path: fullPath,
    alt: '',
    uploaded_at: new Date().toISOString(),
  }
  const { error: writeErr } = await supabase
    .from('node_sections')
    .update({ content: arr })
    .eq('id', item.sectionId)
  if (writeErr) throw writeErr
}
