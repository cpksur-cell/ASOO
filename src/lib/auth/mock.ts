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
 *  Gate: ASOO_ENABLE_MOCK_AUTH must be exactly 'true'.
 *  This is set intentionally in the Vercel environment for the Phase 2 demo.
 *  The NODE_ENV guard has been removed for the demo deployment and will be
 *  reinstated when Firebase Auth is wired up in Phase 3.
 *
 * ─────────────────────────────────────────────────────────────────────────
 */
export function isMockAuthEnabled(): boolean {
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
