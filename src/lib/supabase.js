// ============================================================================
// Supabase client
// ----------------------------------------------------------------------------
// Single shared Supabase client instance for the whole app.
// Read URL + publishable key from Vite environment variables (see .env.example).
// ============================================================================

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,       // remember the user after refresh
    autoRefreshToken: true,     // transparently refresh the session
    detectSessionInUrl: true,   // handle auth redirects (magic links, oauth, etc.)
  },
})
