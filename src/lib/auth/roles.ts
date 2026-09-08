/**
 * The permission matrix — the intended BASELINE, not the runtime authority.
 *
 * Derived from the specification table in docs/08-security.md §4. That table
 * is the spec; this file is the implementation, and they are checked against
 * each other. Adding a permission here without adding the row there is a
 * defect — the document is what the syndicate signs off on.
 *
 * WHAT ACTUALLY DECIDES. `can()` and `assertPermission()` read
 * `role_permissions` from the database (migration 0016), which this file seeds
 * and `npm run verify` keeps in step. When Supabase is configured, the rows
 * decide; this map is consulted only when there is no database at all. So a
 * grant added directly to the database takes effect without a deploy, and the
 * repository will not show it — `node scripts/permissions-seed.mjs --write`
 * plus a re-applied 0016 is how a change gets written down.
 *
 * An earlier version of this comment said the matrix was shared with edge
 * middleware. It never was: middleware only asks whether a session plausibly
 * exists, never what it may do, and this module is imported solely by
 * `server.ts`. That mistaken claim was the stated reason the tables could not
 * be made authoritative.
 */

export const ROLES = [
  'super_admin',
  'membership_officer',
  'finance_officer',
  'content_editor',
  'support_agent',
  'member',
] as const

export type Role = (typeof ROLES)[number]

/** Narrows an arbitrary string — a database value, a claim — to a known role. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** Roles that may reach /admin. `member` is deliberately absent. */
export const STAFF_ROLES = [
  'super_admin',
  'membership_officer',
  'finance_officer',
  'content_editor',
  'support_agent',
] as const

export const PERMISSIONS: Record<Role, readonly string[]> = {
  super_admin: ['*:*'],

  membership_officer: [
    'members:read', 'members:create', 'members:update', 'members:suspend', 'members:export',
    'applications:read', 'applications:review',
    'renewals:read', 'renewals:review',
    'certificates:issue', 'certificates:revoke', 'certificates:verify',
    'complaints:read', 'complaints:manage',
    // Report review is a technical function; the membership office owns it.
    'reports:review', 'reports:approve', 'reports:verify',
    // Counter e-services (electronic plate, unarchived change statement): the
    // membership office is the desk that goes to the department and answers.
    'requests:read', 'requests:fulfill',
    'media:upload',
    'notifications:campaign',
  ],

  finance_officer: [
    'members:read',
    'renewals:read',
    'feeplans:read', 'feeplans:manage',
    'invoices:read', 'invoices:issue', 'invoices:bulk_issue', 'invoices:waive',
    'payments:read', 'payments:record_manual', 'payments:refund',
    'reports:financial',
    'certificates:verify',
    'notifications:campaign',
  ],

  content_editor: [
    'posts:read', 'posts:write', 'posts:publish',
    'pages:write',
    'documents:write',
    'links:manage',
    'media:upload',
    'layout:manage',
    'certificates:verify',
    'notifications:templates', 'notifications:campaign',
  ],

  support_agent: [
    'members:read',
    'complaints:read', 'complaints:manage',
    // Support staffs the same counter, so it answers the same queue.
    'requests:read', 'requests:fulfill',
    'certificates:verify',
    'media:upload',
    'posts:read',
  ],

  // Member permissions are all self-scoped. The row-level `auth.uid` binding
  // in Data Connect is what actually confines them to their own records —
  // this list only says which operations they may attempt at all.
  member: [
    'profile:read', 'profile:update',
    'invoices:read', 'payments:pay',
    'renewals:submit',
    'certificates:request',
    'complaints:file', 'complaints:read',
    'certificates:verify',
    // Upload technical reports against their own orders, and verify approvals.
    'reports:submit', 'reports:verify',
    // Ask the counter for an electronic plate or an unarchived change
    // statement, and read back only their OWN requests — the ownership check
    // in the action is what confines this, not the permission itself.
    'requests:submit', 'requests:read',
  ],
}
