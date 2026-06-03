// ─────────────────────────────────────────────────────────────────────────
// SPIKE-ONLY entry. Reachable at #editor-spike (pre-auth, no Supabase).
// Toggles between the BlockNote and Tiptap prototypes so they can be
// compared side by side against the four deciding factors.
// Throwaway. Delete src/spike/ + the #editor-spike branch in main.jsx.
// ─────────────────────────────────────────────────────────────────────────
import { Component, lazy, Suspense } from 'react'
// BlockNote was selected per ADR-0016; the Tiptap prototype has been removed.
// This spike is kept as a working reference for the real build.
// Lazy so a load-time error surfaces in the on-page error catcher below.
const BlockNoteSpike = lazy(() => import('./BlockNoteSpike.jsx'))

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) return (
      <pre style={{ color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 12 }}>
        {String(this.state.err?.stack || this.state.err)}
      </pre>
    )
    return this.props.children
  }
}

export default function SpikeIndex() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Block Editor Spike — BlockNote (selected)</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Reference spike for ADR-0016. Validates: inline <code>[[Node]]</code> links · custom Connections + Image Album blocks · two zones · the [[ workaround · the delete-reverts-to-text lifecycle.
      </p>
      <Boundary>
        <Suspense fallback={<div style={{ fontSize: 13, color: '#6b7280' }}>Loading editor…</div>}>
          <BlockNoteSpike />
        </Suspense>
      </Boundary>
    </div>
  )
}
