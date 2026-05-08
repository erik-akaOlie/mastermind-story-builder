// ============================================================================
// Error Reporting + Retry Wrapper
// ----------------------------------------------------------------------------
// persistWrite() wraps a Supabase mutation with:
//   - up to 3 attempts (initial + 2 silent retries, 250ms then 500ms between)
//   - failure tracking via useSyncStore (drives the ambient indicator + lock)
//   - a toast on final failure for immediate user feedback
//
// Non-retryable errors (HTTP 4xx) short-circuit after the first attempt —
// retrying a 400/403/409 wastes time and load.
//
// Retries of create operations CAN produce duplicates if the server accepts a
// request but the response never reaches the client. This is rare in practice.
// For create paths where duplicates would be destructive (e.g. createCampaign
// which seeds node_types in a second insert), call the raw lib function or
// pass { retries: 0 }.
// ============================================================================

import { useSyncStore } from '../store/useSyncStore.js'
import { toastSaveFailed } from './feedbackToasts.jsx'

const DEFAULT_RETRY_DELAYS_MS = [250, 500] // between attempts 1→2 and 2→3

export async function persistWrite(fn, context = 'your changes', options = {}) {
  const delays = options.retries === 0 ? [] : DEFAULT_RETRY_DELAYS_MS
  const maxAttempts = delays.length + 1

  useSyncStore.getState().startWrite()

  let lastErr = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1])
    try {
      const result = await fn()
      useSyncStore.getState().writeSucceeded()
      return result
    } catch (err) {
      lastErr = err
      console.error(`[persistWrite:${context}] attempt ${attempt + 1} failed`, err)
      if (isNonRetryable(err)) break
    }
  }

  useSyncStore.getState().writeFailed(lastErr, context)
  toastSaveFailed(context)
  throw lastErr
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isNonRetryable(err) {
  const status = err?.status ?? err?.statusCode
  return typeof status === 'number' && status >= 400 && status < 500
}
