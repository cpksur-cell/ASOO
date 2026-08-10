/**
 * Whether the app has real Supabase credentials to talk to.
 *
 * The whole data layer is written to degrade gracefully: when this returns
 * false — which is the case on any deployment where the Supabase env vars have
 * not been set yet — reads and writes fall back to the in-memory demo store, so
 * the live site keeps working exactly as before. The moment the three vars
 * below are present, the same call sites start hitting Postgres instead.
 *
 * This runs on the SERVER only. The service-role key must never reach a client
 * bundle, so nothing here is exported to browser code.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

/**
 * Reduce a configured Supabase URL to its ORIGIN.
 *
 * The dashboard surfaces more than one URL, and the REST endpoint
 * (`https://<ref>.supabase.co/rest/v1/`) is an easy one to copy by mistake.
 * supabase-js appends `/rest/v1` itself, so passing that value produces
 * `/rest/v1/rest/v1/<table>` and every single query fails with an opaque
 * `PGRST125: Invalid path specified in request URL` — which looks like a
 * broken schema rather than a mis-pasted variable. Normalising here makes both
 * forms work and removes a genuinely nasty hour of debugging.
 */
function normalizeSupabaseUrl(raw: string): string {
  try {
    return new URL(raw).origin
  } catch {
    // Not parseable as a URL — hand it back untouched so the client library
    // raises its own, clearer error about the malformed value.
    return raw
  }
}

/** Reads the required server env, throwing a clear error if half-configured. */
export function requireSupabaseServerEnv(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase is not fully configured: set NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY. See docs/11-supabase.md.',
    )
  }
  return { url: normalizeSupabaseUrl(url), serviceRoleKey }
}
