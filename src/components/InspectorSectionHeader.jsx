// ============================================================================
// InspectorSectionHeader — labeled section divider for the Inspector body.
// ----------------------------------------------------------------------------
// An uppercase label followed by a 1px horizontal rule that runs from just
// right of the label to the inspector's right edge. Used once per top-level
// Inspector section (Card View / GM's Eyes Only / Connection Manager) to make
// the section boundaries legible without wrapping each section in a box.
//
// Reusable by design, but intentionally named for its current home (the
// Inspector). If the same treatment proves useful elsewhere, rename/generalize
// then — not preemptively.
//
// Spec (Figma node 69:96, reconciled to the 8pt grid per CLAUDE.md):
//   - label: Inter Medium 12px, color #4b5563 (content/secondary), uppercase
//   - rule:  1px, color #6b7280 (content/tertiary), fills remaining width
//   - gap label→rule: 8px (Figma showed 10px; reconciled down to 8)
// ============================================================================

export default function InspectorSectionHeader({ label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase leading-none whitespace-nowrap text-[#4b5563]">
        {label}
      </span>
      <div className="h-px flex-1 bg-[#6b7280]" />
    </div>
  )
}
