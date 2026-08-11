import 'server-only'

import { cookies } from 'next/headers'

import type { Locale } from '@/i18n/config'
import { createAuthClient } from '@/lib/supabase/auth-server'
import { getServiceClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isMockAuthEnabled, isMockRole, MOCK_ROLE_COOKIE, MOCK_USER_COOKIE } from './mock'
import { isRole, PERMISSIONS, type Role, STAFF_ROLES } from './roles'

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
   * Real session — Supabase Auth.
   *
   * `getUser()`, NEVER `getSession()`. getSession returns whatever the cookie
   * claims without checking it, so a forged cookie would be believed;
   * getUser revalidates the JWT against the auth server, which is the whole
   * point of asking. It costs a round trip and is worth it.
   */
  const supabase = await createAuthClient()
  if (!supabase) return null

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  return {
    uid: user.id,
    email: user.email ?? '',
    displayName:
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split('@')[0] ??
      user.id,
    role: await resolveRole(user.id),
    preferredLocale:
      (user.user_metadata?.preferred_locale as Locale | undefined) ?? 'ar',
  }
}

/**
 * Resolve a user's role from the database.
 *
 * Deliberately NOT read from a JWT claim or a cookie. Those travel with the
 * request and are shaped by the client; `user_roles` is server state that a
 * user cannot influence. A stale token therefore cannot carry a revoked
 * privilege — the role is re-read on each request.
 *
 * Read with the SERVICE client on purpose: the RLS policy on `user_roles`
 * would otherwise have to expose the table to the user themselves, and the
 * answer is needed before any permission decision is possible.
 *
 * Falls back to `member`, the least-privileged role, if the lookup finds
 * nothing — an unknown role must never be treated as staff.
 */
async function resolveRole(userId: string): Promise<Role> {
  if (!isSupabaseConfigured()) return 'member'

  const { data, error } = await getServiceClient()
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', userId)

  if (error || !data?.length) return 'member'

  const codes = data
    .flatMap((row) => {
      const rel = (row as { roles?: { code?: string } | Array<{ code?: string }> }).roles
      return Array.isArray(rel) ? rel.map((r) => r.code) : [rel?.code]
    })
    .filter((c): c is string => typeof c === 'string')

  // Most privileged wins when an account holds more than one role.
  const ORDER: Role[] = [
    'super_admin',
    'membership_officer',
    'finance_officer',
    'content_editor',
    'support_agent',
    'member',
  ]
  for (const role of ORDER) {
    if (codes.includes(role)) return role
  }
  return codes.find(isRole) ?? 'member'
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
