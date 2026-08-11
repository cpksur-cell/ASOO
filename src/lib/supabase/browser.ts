'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * The browser-side Supabase client.
 *
 * Uses the ANON key only, which is safe to ship: every table is under RLS
 * (0006, 0008), so this client can read exactly what a signed-out or
 * signed-in visitor is entitled to and nothing more. The service-role key
 * never leaves the server.
 *
 * Used for the auth handshake — sign in, sign out, password reset. Data
 * fetching stays on the server, where permission is checked before the query.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase auth is not configured: NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See docs/11-supabase.md.',
    )
  }

  // Normalised to the origin for the same reason as the server client: the
  // dashboard also shows the REST endpoint, and pasting that produces a
  // doubled /rest/v1 path and an opaque failure.
  return createBrowserClient(new URL(url).origin, anonKey)
}

/** True when the browser has what it needs to sign a user in. */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
