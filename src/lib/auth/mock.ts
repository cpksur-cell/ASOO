/**
 * The single switch controlling mock authentication.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  WHY THIS FILE EXISTS
 *
 *  Mock auth issues a cookie asserting any role the caller asks for. Without
 *  a hard guard, `POST /api/auth/mock-login {"role":"super_admin"}` grants
 *  full administrative control of a government system that handles money and
 *  national ID documents — to an unauthenticated stranger, over the internet.
 *
 *  Gate: BOTH must hold —
 *    1. NODE_ENV !== 'production'  (Vercel production builds set this, so a
 *       forged role cookie replayed against asoojo.com is refused outright)
 *    2. ASOO_ENABLE_MOCK_AUTH === 'true'
 *
 *  The production guard was briefly removed for a demo, which left the live
 *  site able to mint a `super_admin` cookie for any anonymous visitor. It is
 *  reinstated here. Real identity comes from Supabase Auth (next step); until
 *  then the live site has no privileged access at all, which is the safe state
 *  for a system handling money and national-ID documents.
 *
 * ─────────────────────────────────────────────────────────────────────────
 */
export function isMockAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ASOO_ENABLE_MOCK_AUTH === 'true'
}

/** Cookie names, in one place so the route and the reader cannot drift. */
export const MOCK_ROLE_COOKIE = 'asoo_mock_role'
export const MOCK_USER_COOKIE = 'asoo_mock_user'

/** Roles mock auth may issue. An arbitrary string is never accepted. */
export const MOCK_ROLES = [
  'member',
  'content_editor',
  'finance_officer',
  'membership_officer',
  'support_agent',
  'super_admin',
] as const

export type MockRole = (typeof MOCK_ROLES)[number]

export function isMockRole(value: unknown): value is MockRole {
  return typeof value === 'string' && (MOCK_ROLES as readonly string[]).includes(value)
}
