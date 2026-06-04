// ============================================================================
// MigrateBlocks
// ----------------------------------------------------------------------------
// One-shot in-app tool that converts every card's legacy fielded content into
// the two new block-JSON zones (card_view / gm_only) for the BlockNote editor.
// Visited at /#migrate-blocks. Phase 1 of the block-editor rework (ADR-0016).
//
// Two explicit actions:
//   1. Dry-run preview (default) — converts + classifies every card, writes
//      NOTHING. Proves CONVERSION readiness only.
//   2. Apply for real — writes the two new kinds idempotently, then reads them
//      back and verifies. Proves the SAVED data survived the database round-trip.
//
// Hard guarantees (surfaced in the UI): legacy rows are never modified, deleted,
// or overwritten; re-running never duplicates rows; this tool never deletes
// anything. Legacy cleanup is a future, separate tool + decision.
//
// Delete this file (and its route in main.jsx) once the migration is verified
// and the block editor is reading from the migrated data.
// ============================================================================

import { useState } from 'react'
import { ArrowLeft, CheckCircle, WarningCircle, Eye, Lightning } from '@phosphor-icons/react'
import { runBlockMigration } from '../lib/blockMigration.js'

const SYSTEM_BLUE = '#0284C7'

export default function MigrateBlocks() {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [applyArmed, setApplyArmed] = useState(false)

  async function run(dryRun) {
    setBusy(true)
    setError(null)
    setReport(null)
    try {
      const r = await runBlockMigration({ dryRun })
      setReport(r)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setApplyArmed(false)
    }
  }

  function onApplyClick() {
    if (!applyArmed) {
      setApplyArmed(true)
      return
    }
    run(false)
  }

  function backToCanvas() {
    window.location.hash = ''
    window.location.reload()
  }

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
          Migrate cards to the block editor
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Converts each card&rsquo;s existing content — Summary, Story Notes, Hidden
          Lore, DM Notes, and Image Section images — into the two new content zones
          (<b>Card View</b> and <b>GM&rsquo;s Eyes Only</b>). Connections are left in
          place and read live; they are never copied into card content.
        </p>

        {/* What each action proves — Erik asked this be explicit. */}
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 mb-4 space-y-2">
          <div className="flex gap-2">
            <Eye size={18} weight="bold" className="mt-0.5 shrink-0" color={SYSTEM_BLUE} />
            <span>
              <b>Dry-run</b> proves <b>conversion readiness</b> — that every card
              converts cleanly. It writes nothing, so it cannot prove the saved data
              is intact.
            </span>
          </div>
          <div className="flex gap-2">
            <Lightning size={18} weight="bold" className="mt-0.5 shrink-0" color={SYSTEM_BLUE} />
            <span>
              <b>Apply for real</b> writes the new zones, then reads them back and
              re-checks them — proving the <b>saved data survived the database
              round-trip</b>.
            </span>
          </div>
        </div>

        {/* Safety guarantees */}
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 mb-6 space-y-1">
          <div>• Your original content rows are never modified, deleted, or overwritten.</div>
          <div>• Safe to run as many times as you like — re-running never duplicates anything.</div>
          <div>• This tool never deletes data. Removing the old rows is a separate, later step.</div>
        </div>

        {error && (
          <ErrorBox title="Migration couldn't run" body={error} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="px-4 py-2 rounded-md text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: SYSTEM_BLUE }}
            disabled={busy}
            onClick={() => run(true)}
          >
            {busy && report === null ? 'Working…' : 'Run dry-run preview'}
          </button>

          <button
            className={
              'px-4 py-2 rounded-md font-medium border disabled:opacity-50 disabled:cursor-not-allowed ' +
              (applyArmed
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50')
            }
            disabled={busy}
            onClick={onApplyClick}
          >
            {applyArmed ? 'Click again to apply for real' : 'Apply migration for real'}
          </button>

          {applyArmed && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700"
              onClick={() => setApplyArmed(false)}
            >
              Cancel
            </button>
          )}
        </div>

        {report && <ReportView report={report} />}
      </div>
    </div>
  )
}

// ── Report ───────────────────────────────────────────────────────────────────

function ReportView({ report }) {
  const { dryRun, total, toMigrate, migrated, verified, skipped, failed, nothingToMigrate } = report

  return (
    <div className="mt-6">
      <div
        className={
          'rounded-md px-3 py-2 text-sm font-medium mb-4 ' +
          (dryRun ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-gray-900 text-white')
        }
      >
        {dryRun
          ? 'Dry-run preview — nothing was written. This proves conversion readiness only.'
          : 'Live migration — saved rows were read back and verified.'}
      </div>

      {nothingToMigrate ? (
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle size={20} weight="fill" color="#16a34a" />
          Nothing to migrate — every card is already up to date.
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 divide-y divide-gray-100 text-sm">
          <Stat label="Total cards found" value={total} />
          {dryRun ? (
            <Stat label="Would migrate" value={toMigrate} emphasis />
          ) : (
            <>
              <Stat label="Cards migrated (written)" value={migrated} emphasis />
              <Stat
                label="Cards verified (read back, no loss)"
                value={verified}
                tone={verified === migrated ? 'good' : 'warn'}
              />
            </>
          )}
          <Stat label="Skipped (already up to date)" value={skipped} />
          <Stat
            label="Failed"
            value={failed.length}
            tone={failed.length ? 'bad' : 'good'}
          />
        </div>
      )}

      {!dryRun && !nothingToMigrate && failed.length === 0 && migrated > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 mt-4">
          <CheckCircle size={20} weight="fill" color="#16a34a" />
          All {migrated} migrated card{migrated === 1 ? '' : 's'} verified intact after the database round-trip.
        </div>
      )}

      {failed.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-2">
            <WarningCircle size={18} weight="fill" />
            {failed.length} card{failed.length === 1 ? '' : 's'} failed
          </div>
          <ul className="text-xs text-gray-700 space-y-1 max-h-60 overflow-y-auto">
            {failed.map((f, i) => (
              <li key={i} className="border-l-2 border-red-300 pl-2">
                <span className="font-medium">{f.label || 'Untitled'}</span>{' '}
                <span className="text-gray-400">({f.phase})</span>: {f.reason}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-2">
            Legacy content is untouched for every card, including these. Re-run to retry.
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, emphasis, tone }) {
  const toneColor =
    tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-700' : 'text-gray-900'
  return (
    <div className="flex justify-between items-center px-4 py-2">
      <span className="text-gray-600">{label}</span>
      <span className={(emphasis ? 'text-base font-semibold ' : 'font-medium ') + toneColor}>{value}</span>
    </div>
  )
}

function ErrorBox({ title, body }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 mb-4">
      <div className="text-sm font-medium text-red-800 mb-1">{title}</div>
      <div className="text-xs text-red-700">{body}</div>
    </div>
  )
}
