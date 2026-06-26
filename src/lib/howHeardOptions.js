// ============================================================================
// "How did you hear about MasterMind?" options.
// ----------------------------------------------------------------------------
// Single source of truth shared by the signup form (optional) and the
// waitlist form (required), per ADR-0017 §1. The stored value is the label
// string itself (e.g. "Discord"); selecting "Other" reveals a free-text
// field whose value is stored separately in how_heard_other.
// ============================================================================

export const HOW_HEARD_OPTIONS = [
  'Discord',
  'Reddit',
  'YouTube',
  'LinkedIn',
  'Friend / word of mouth',
  'Other',
]

export const HOW_HEARD_OTHER = 'Other'
