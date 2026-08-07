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
 *  Two independent conditions must BOTH hold. A single flag is one typo, one
 *  bad `.env` copy, or one mis-set CI variable away from catastrophe.
 *
 *    1. NODE_ENV must not be 'production'
 *    2. ASOO_ENABLE_MOCK_AUTH must be exactly 'true'
 *
 *  Condition 1 alone would break preview deploys that legitimately need mock
 *  auth; condition 2 alone would be one stray env var from disaster. Requiring
 *  both means a production build physically cannot enable it, because the
 *  NODE_ENV check is evaluated at runtime on every call.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function isMockAuthEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.ASOO_ENABLE_MOCK_AUTH === 'true'
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
