import 'server-only'

import { cache } from 'react'

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
 * What a role may do, read from the DATABASE.
 *
 * `role_permissions` is the authority (migration 0016). `PERMISSIONS` in
 * ./roles.ts is the seed those rows are generated from and the fallback when
 * there is no database at all — it is no longer consulted when one exists.
 *
 * MEMOISED PER REQUEST. A single page render asks `can()` many times to decide
 * what to draw; without this each question would be its own round trip. React's
 * `cache` scopes the answer to one request, so permissions cannot change
 * halfway through rendering a page and every check on that page agrees.
 *
 * FAILS CLOSED. A lookup that errors returns no grants, so every check denies.
 * The alternative — falling back to the code matrix when the database is
 * unreachable — would mean the system grants different things when it is
 * unhealthy than when it is well, and would hand anyone who can induce a
 * database error whichever of the two is more permissive. An outage locking
 * admins out is the safer failure, and it is loud.
 */
const grantsForRole = cache(async (role: Role): Promise<ReadonlySet<string>> => {
  if (!isSupabaseConfigured()) {
    // Demo mode: there is no database to be authoritative. This is the same
    // fallback the data layer makes, not a bypass — with Supabase configured
    // this branch is unreachable.
    return new Set(PERMISSIONS[role] ?? [])
  }

  const { data, error } = await getServiceClient()
    .from('roles')
    .select('code, role_permissions(permissions(code))')
    .eq('code', role)
    .maybeSingle()

  if (error || !data) {
    console.error(
      `[auth] permission lookup failed for role "${role}" — denying everything`,
      error?.message ?? 'role not found',
    )
    return new Set()
  }

  const rows = (data as { role_permissions?: unknown }).role_permissions
  const codes = (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const rel = (row as { permissions?: { code?: string } | Array<{ code?: string }> }).permissions
    return Array.isArray(rel) ? rel.map((p) => p?.code) : [rel?.code]
  })

  return new Set(codes.filter((c): c is string => typeof c === 'string'))
})

/**
 * Does this set of grants cover `resource:action`?
 *
 * Three ways to match, and the two wildcards are why this is not a plain
 * `has()`: `*:*` is the super-admin grant, and `resource:*` lets a role be
 * given a whole resource without enumerating its verbs.
 */
function isGranted(granted: ReadonlySet<string>, resource: string, action: string): boolean {
  return granted.has('*:*') || granted.has(`${resource}:*`) || granted.has(`${resource}:${action}`)
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
  return isGranted(await grantsForRole(session.role), resource, action)
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
 * Reads `role_permissions` (migration 0016), seeded from ./roles.ts, which is
 * itself generated from the specification table in docs/08-security.md §4 —
 * that document is the spec this is checked against.
 *
 * A failed lookup denies: see `grantsForRole`. That means a database outage
 * refuses admin work rather than guessing at it, which is the correct
 * direction for an authorization decision.
 */
export async function assertPermission(resource: string, action: string): Promise<UserSession> {
  const session = await getUserSession()
  if (!session) throw new AuthError('UNAUTHENTICATED')

  if (!isGranted(await grantsForRole(session.role), resource, action)) {
    throw new AuthError('UNAUTHORIZED')
  }
  return session
}
