// ============================================================================
// uuid — safeRandomUUID(): crypto.randomUUID with insecure-context fallbacks
// ----------------------------------------------------------------------------
// crypto.randomUUID exists ONLY in secure contexts (HTTPS or localhost). On a
// plain-HTTP origin — notably the LAN dev server (http://192.168.x.x:5173)
// used for on-device mobile testing — it is undefined, and any code path that
// calls it crashes. First observed 2026-07-06: the oldest workspace failed to
// load on the LAN URL because lib/nodes.js assigns fresh ids to legacy bullet
// items that predate per-item ids.
//
// Fallback chain (mirrors editor/blockIds.generateBlockId):
//   1. crypto.randomUUID — secure contexts, the normal path everywhere real.
//   2. crypto.getRandomValues-based UUID v4 — available in ALL contexts,
//      including insecure HTTP; cryptographically identical quality.
//   3. counter — last resort so this never throws in any environment (jsdom
//      without polyfills, exotic embedders).
//
// Use this instead of calling crypto.randomUUID() directly anywhere in app
// code. (editor/blockIds.js keeps its own copy on purpose — it is a shared
// PURE module with its own test surface.)
// ============================================================================

let _fallbackCounter = 0

export function safeRandomUUID() {
  const g = globalThis
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID()
  }
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    const b = g.crypto.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40 // version 4
    b[8] = (b[8] & 0x3f) | 0x80 // variant
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
  }
  _fallbackCounter += 1
  return `mm-id-${_fallbackCounter}`
}
