/**
 * The permission matrix.
 *
 * Derived from the specification table in docs/08-security.md §4. That table
 * is the spec; this file is the implementation, and they are checked against
 * each other. Adding a permission here without adding the row there is a
 * defect — the document is what the syndicate signs off on.
 *
 * Shared by middleware (edge), server components, and server actions, so there
 * is exactly one definition of who may do what.
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
  ],
}
