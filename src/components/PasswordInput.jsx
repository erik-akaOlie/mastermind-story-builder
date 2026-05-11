// ============================================================================
// PasswordInput
// ----------------------------------------------------------------------------
// Standard text input with a built-in show/hide eye toggle on the right.
// Used by Login + Profile so password fields look and behave identically
// regardless of the browser. Edge's native ::-ms-reveal is hidden globally
// in index.css to avoid stacking two eye icons on the same field.
// ============================================================================

import { useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'

export default function PasswordInput({
  value,
  onChange,
  autoComplete,
  required = false,
  minLength,
  ...rest
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        // .ph-mask is read by the PostHog session-replay maskInputFn/maskTextFn
        // (see src/lib/analytics.js) so the value is masked regardless of
        // whether the eye toggle has flipped type from password → text. PostHog
        // already masks type=password by default; this covers the visible state.
        className="ph-mask w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
        {...rest}
      />
      <button
        type="button"
        // Keep input focused when clicking the eye so typing can resume immediately.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        // Skip in tab order — tab should advance to the next field, not the eye.
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
      >
        {visible ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
      </button>
    </div>
  )
}
