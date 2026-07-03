// RootErrorBoundary — the last line of defense against a white screen.
//
// Before this existed, any uncaught render error anywhere outside the block
// editor's own boundary (e.g. the Inspector header) unmounted the entire
// React tree — the user saw a blank white page with zero information, and on
// a phone there's no devtools console to read (2026-07-02 mobile session:
// per-node white screens with no way to see why).
//
// This boundary renders the actual error + component stack, selectable and
// scrollable, so any device becomes its own console. Reload gives a clean
// recovery path. It deliberately does NOT try to be pretty — it's an
// incident surface, and the information is the design.

import { Component } from 'react'

export class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, componentStack: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('RootErrorBoundary caught:', error, info?.componentStack)
    this.setState({ componentStack: info?.componentStack || null })
  }

  render() {
    const { error, componentStack } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ minHeight: '100vh', background: '#fef2f2', padding: '1rem', fontFamily: 'ui-monospace, monospace' }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#b91c1c', marginBottom: '0.5rem' }}>
          Something crashed — details below
        </h1>
        <p style={{ fontSize: '0.75rem', color: '#7f1d1d', marginBottom: '1rem' }}>
          Screenshot or copy this and send it to the MasterMind team, then reload.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '0.5rem 1rem', marginBottom: '1rem', background: '#0284c7',
            color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600,
          }}
        >
          Reload
        </button>
        <pre
          style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.7rem',
            color: '#450a0a', background: '#fff', border: '1px solid #fecaca',
            borderRadius: '0.5rem', padding: '0.75rem', userSelect: 'text',
          }}
        >
          {String(error?.stack || error?.message || error)}
          {componentStack ? `\n\n— component stack —${componentStack}` : ''}
        </pre>
      </div>
    )
  }
}
