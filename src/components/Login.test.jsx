// ============================================================================
// Login tests — signup success panel (iPhone QA Finding E, 2026-07-08)
// ----------------------------------------------------------------------------
// After a signup that requires email confirmation, the form must be REPLACED
// by a green success panel (same pattern as the waitlist success state) —
// the old inline gray banner mid-form was easy to miss, and "check your
// email" is the one instruction the new user cannot skip.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Login from './Login'

const { mockSignUp } = vi.hoisted(() => ({ mockSignUp: vi.fn() }))

vi.mock('../lib/AuthContext.jsx', () => ({
  useAuth: () => ({ signIn: vi.fn(), signUp: mockSignUp }),
}))
vi.mock('../lib/betaConfig.js', () => ({
  isBetaOpen: () => Promise.resolve(true),
}))
vi.mock('../lib/waitlist.js', () => ({
  joinWaitlist: vi.fn(),
}))

async function fillAndSubmitSignup(container) {
  // Switch from the default sign-in mode to signup.
  fireEvent.click(screen.getByText(/create one/i))

  fireEvent.change(container.querySelector('input[autocomplete="name"]'), {
    target: { value: 'Test GM' },
  })
  fireEvent.change(container.querySelector('input[autocomplete="email"]'), {
    target: { value: 'gm@example.com' },
  })
  fireEvent.change(container.querySelector('.ph-mask'), {
    target: { value: 'hunter2hunter2' },
  })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
}

describe('Login — signup success panel', () => {
  beforeEach(() => {
    mockSignUp.mockReset()
  })

  it('replaces the signup form with an email-first success panel when confirmation is pending', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
    const { container } = render(<Login />)
    await fillAndSubmitSignup(container)

    // Success panel present, with the email the user entered.
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(screen.getByText('gm@example.com')).toBeInTheDocument()
    expect(screen.getByText(/bring you back to MasterMind/i)).toBeInTheDocument()
    // The form is gone.
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument()
    // The real next step is in the user's inbox, so there is NO primary CTA —
    // only the secondary "Back to sign in" escape hatch (the mode toggle).
    expect(screen.queryByRole('button', { name: /go to sign in/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to sign in/i })).toBeInTheDocument()
  })

  it('"Back to sign in" leaves the panel and shows the sign-in form (and signup resets)', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
    const { container } = render(<Login />)
    await fillAndSubmitSignup(container)
    await screen.findByText(/check your email/i)

    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }))
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()

    // Returning to signup shows the form again, not a stale success panel.
    fireEvent.click(screen.getByText(/create one/i))
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument()
  })

  it('a signup error keeps the form visible with the error shown', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: { message: 'Email already registered' } })
    const { container } = render(<Login />)
    await fillAndSubmitSignup(container)

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument()
  })
})
