// ============================================================================
// canvasColor — single source of truth for a workspace's canvas background.
// ----------------------------------------------------------------------------
// Used by the auto-snapshot background and by the CampaignPicker's empty-state
// tile (a workspace with no cover and no snapshot renders as its bare canvas,
// which itself reads as "nothing on the canvas yet").
//
// Canvas color is GLOBAL today (#031a15, per CLAUDE.md) but is expected to
// become per-workspace later. Every consumer resolves through
// getWorkspaceCanvasColor(workspace) so that change is a one-liner here (read a
// workspaces.canvas_color column) with zero call-site churn — no tech debt.
// ============================================================================

export const DEFAULT_CANVAS_COLOR = '#031a15'

// Resolve a workspace row's canvas color. Falls back to the global default
// until per-workspace colors exist. Tolerant of null/partial rows.
export function getWorkspaceCanvasColor(workspace) {
  return workspace?.canvas_color || DEFAULT_CANVAS_COLOR
}
