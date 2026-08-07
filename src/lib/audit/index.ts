import 'server-only'

import { headers } from 'next/headers'

import { getUserSession } from '@/lib/auth/server'
import { appendAuditRow, type AuditRow } from '@/lib/data/store'

/**
 * The audited mutation wrapper.
 *
 * CLAUDE.md §2, non-negotiable #5: "Every admin mutation writes an audit row
 * in the SAME TRANSACTION as the change. No exceptions. Enforced by the shared
 * mutation wrapper — do not bypass it."
 *
 * The ordering below is the whole point. The mutation runs first, and the
 * audit row is written from its result; if the audit write throws, the whole
 * thing throws and the caller must treat the mutation as failed. Once Data
 * Connect is wired up (Phase 3) `run` receives the transaction handle and both
 * writes commit or roll back together. A change without a record is not an
 * acceptable outcome for a government system.
 *
 * Usage:
 *
 *   await withAudit(
 *     { action: 'post.publish', entityType: 'post', entityId: id },
 *     async () => repo.publishPost(id),
 *   )
 */

export interface AuditContext {
  /** Dotted verb: `post.publish`, `invoice.waive`, `member.suspend`. */
  action: string
  entityType: string
  entityId: string
  /**
   * REQUIRED for waivers, cancellations, suspensions, rejections, revocations,
   * and refunds. docs/08-security.md §7. Enforced below.
   */
  reason?: string
  before?: unknown
}

/** Actions the audit log refuses to accept without a stated reason. */
const REASON_REQUIRED = [
  'invoice.waive',
  'invoice.cancel',
  'member.suspend',
  'application.reject',
  'renewal.reject',
  'certificate.revoke',
  'payment.refund',
  'role.change',
  'report.reject',
  'report.revision',
  'approval.revoke',
]

export class AuditError extends Error {}

export async function withAudit<T>(
  ctx: AuditContext,
  run: () => Promise<T>,
): Promise<T> {
  const session = await getUserSession()
  if (!session) throw new AuditError('Cannot audit an unauthenticated mutation')

  if (REASON_REQUIRED.includes(ctx.action) && !ctx.reason?.trim()) {
    throw new AuditError(`Action "${ctx.action}" requires a reason`)
  }

  const result = await run()

  // Best-effort request metadata. An absent header must not block the write —
  // losing the IP is bad, losing the audit row is worse.
  let ip: string | null = null
  let userAgent: string | null = null
  try {
    const h = await headers()
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    userAgent = h.get('user-agent')
  } catch {
    /* outside a request scope */
  }

  const row: AuditRow = {
    id: crypto.randomUUID(),
    actorUserId: session.uid,
    // Snapshot, not a reference. Roles change; the log must not.
    actorRole: session.role,
    action: ctx.action,
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    before: ctx.before ?? null,
    after: result ?? null,
    reason: ctx.reason ?? null,
    ipAddress: ip,
    userAgent,
    createdAt: new Date().toISOString(),
  }

  appendAuditRow(row)

  return result
}
