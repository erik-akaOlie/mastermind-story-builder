// ============================================================================
// EditorErrorBoundary — stops a BlockNote editor crash from white-screening the
// whole app, and SURFACES the error so it can actually be diagnosed.
// ----------------------------------------------------------------------------
// The block editor is a deep third-party tree (BlockNote + Mantine + ProseMirror);
// a render error anywhere inside it would otherwise unmount the entire React app
// (blank white screen) with the real error buried in the console. This boundary
// catches that error, keeps the rest of the app (Inspector chrome, canvas) alive,
// and renders the message + stack in a readable box so it can be copied verbatim.
//
// Error boundaries MUST be class components (no hook equivalent for componentDidCatch).
// ============================================================================

import { Component } from 'react'

export class EditorErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Also log to the console with the component stack for full context.
    console.error('[EditorErrorBoundary] editor crashed:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          margin: 8,
          padding: 16,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          color: '#991b1b',
          fontSize: 13,
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
          maxHeight: 480,
        }}
      >
        <strong>The editor hit an error. (This box prevents the white screen.)</strong>
        {'\n\nCopy everything below and send it to Claude:\n\n'}
        {String(error?.message || error)}
        {'\n\n'}
        {error?.stack}
      </div>
    )
  }
}
