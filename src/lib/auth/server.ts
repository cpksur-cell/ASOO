import 'server-only'

import { cookies } from 'next/headers'

import type { Locale } from '@/i18n/config'
import { isMockAuthEnabled, isMockRole, MOCK_ROLE_COOKIE, MOCK_USER_COOKIE } from './mock'
import { PERMISSIONS, type Role, STAFF_ROLES } from './roles'

export interface UserSession {
  uid: string
  email: string
  displayName: string
  role: Role
  preferredLocale: Locale
}

/**
 * Resolve the current session.
 *
 * Layer 2 of the three-layer authorization model in docs/08-security.md §3:
 * middleware gates the route, this re-checks the operation, and Data Connect
 * enforces row ownership. None of the three is trusted alone.
 */
export async function getUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies()

  /*
   * Mock session — development only.
   *
   * The guard is re-evaluated HERE and not just at the issuing route. A cookie
   * minted on a dev machine must not grant anything if it is replayed against
   * a production deployment, so the reader refuses it independently.
   */
  if (isMockAuthEnabled()) {
    const mockRole = cookieStore.get(MOCK_ROLE_COOKIE)?.value
    if (isMockRole(mockRole)) {
      return {
        uid: cookieStore.get(MOCK_USER_COOKIE)?.value ?? `mock-uid-${mockRole}`,
        email: `${mockRole}@asoo.invalid`,
        displayName: mockRole
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        role: mockRole,
        preferredLocale: 'ar',
      }
    }
  }

  /*
   * Real session — Firebase Auth.
   *
   * Phase 2 replaces this with `getAuth().verifySessionCookie(value, true)`
   * via the Admin SDK, reading the role from a custom claim. The checkRevoked
   * flag is not optional: a suspended member must lose access immediately, not
   * at the next token refresh.
   */
  const sessionCookie = cookieStore.get('__session')?.value
  if (!sessionCookie) return null

  return null
}

/** True when the session holds the given role. `super_admin` holds all of them. */
export async function hasRole(role: Role): Promise<boolean> {
  const session = await getUserSession()
  if (!session) return false
  if (session.role === 'super_admin') return true
  return session.role === role
}

export async function isStaff(): Promise<boolean> {
  const session = await getUserSession()
  return Boolean(session && (STAFF_ROLES as readonly string[]).includes(session.role))
}

/**
 * Non-throwing permission check, for deciding what to RENDER.
 *
 * Use this to hide a nav item or a button. Never use it as the access control
 * itself — a hidden link is not a permission boundary. The page still calls
 * `assertPermission`, and the server action calls it again.
 */
export async function can(resource: string, action: string): Promise<boolean> {
  const session = await getUserSession()
  if (!session) return false
  const granted = PERMISSIONS[session.role] ?? []
  return (
    granted.includes('*:*') ||
    granted.includes(`${resource}:*`) ||
    granted.includes(`${resource}:${action}`)
  )
}

export class AuthError extends Error {
  constructor(public readonly code: 'UNAUTHENTICATED' | 'UNAUTHORIZED') {
    super(code)
    this.name = 'AuthError'
  }
}

/**
 * Throw unless the session may perform `resource:action`.
 *
 * The matrix lives in ./roles.ts, generated from the specification table in
 * docs/08-security.md §4 — that document is the spec this is checked against.
 */
export async function assertPermission(resource: string, action: string): Promise<UserSession> {
  const session = await getUserSession()
  if (!session) throw new AuthError('UNAUTHENTICATED')

  const granted = PERMISSIONS[session.role] ?? []
  const allowed =
    granted.includes('*:*') ||
    granted.includes(`${resource}:*`) ||
    granted.includes(`${resource}:${action}`)

  if (!allowed) throw new AuthError('UNAUTHORIZED')
  return session
}
