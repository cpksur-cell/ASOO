import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * The request-scoped Supabase client that carries the user's session.
 *
 * Distinct from `getServiceClient()` in ./server.ts, and the difference
 * matters: that one is the trusted backend identity and bypasses RLS, while
 * this one acts AS THE SIGNED-IN USER, so every policy in 0006/0008 applies.
 * Use this to answer "who is this?" and the service client to do privileged
 * work once that question has been answered.
 *
 * Reads the session out of cookies via @supabase/ssr. Cookie writes are
 * wrapped because a Server Component is not allowed to set them — the
 * middleware refreshes the session instead, so the failure is expected and
 * ignorable there.
 */
export async function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const cookieStore = await cookies()

  return createServerClient(new URL(url).origin, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          /*
           * Called from a Server Component, where cookies are read-only. Safe
           * to swallow: middleware.ts runs on every request and performs the
           * refresh there, which is the supported place to do it.
           */
        }
      },
    },
  })
}

/** True when the server has what it needs to verify a session. */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
