import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { requireSupabaseServerEnv } from './config'

/**
 * The server-side Supabase client, authenticated with the SERVICE ROLE key.
 *
 * The service role BYPASSES Row Level Security — it is the trusted backend
 * identity. Authorization for every privileged read/write is therefore done in
 * the application layer BEFORE this client is used (the three-layer model in
 * docs/08-security §3: middleware → server action/component → data layer).
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  This module must never be imported into client code. The `server-only`
 *  guard above turns any such import into a build error, so the service-role
 *  key can never be bundled for the browser. (CLAUDE.md §3.)
 * ─────────────────────────────────────────────────────────────────────────
 */

let cached: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (cached) return cached
  const { url, serviceRoleKey } = requireSupabaseServerEnv()
  cached = createClient(url, serviceRoleKey, {
    auth: {
      // A backend service holds no user session and must not try to persist or
      // refresh one.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  return cached
}
