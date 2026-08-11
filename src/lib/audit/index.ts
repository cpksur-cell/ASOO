import 'server-only'

import { headers } from 'next/headers'

import { getUserSession } from '@/lib/auth/server'
import { appendAuditRow, type AuditRow } from '@/lib/data/store'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServiceClient } from '@/lib/supabase/server'

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

  if (isSupabaseConfigured()) {
    // Real database: append an immutable audit_logs row. The table's rules
    // reject UPDATE/DELETE, so this record cannot later be rewritten.
    const { error } = await getServiceClient()
      .from('audit_logs')
      .insert({
        actor_user_id: session.uid,
        actor_role: session.role, // snapshot, not a reference — roles change
        action: ctx.action,
        entity_type: ctx.entityType,
        entity_id: ctx.entityId,
        before: ctx.before ?? null,
        after: result ?? null,
        reason: ctx.reason ?? null,
        ip_address: ip,
        user_agent: userAgent,
      })
    /*
     * A mutation without its audit record is not an acceptable outcome for a
     * government system.
     *
     * KNOWN GAP, and it is real rather than theoretical: `run()` has ALREADY
     * committed by the time this executes, because supabase-js issues each
     * statement over HTTP and cannot hold a transaction open across them. So a
     * failure here means the change happened and the record did not — this
     * exact case was hit in testing when a foreign key rejected the audit row
     * (fixed in 0009) while the member update had already gone through.
     *
     * Until each mutation moves behind a Postgres function that writes the
     * change and its audit row in ONE transaction, the honest behaviour is to
     * fail loudly: throw so the caller reports failure, and log with enough
     * detail to reconstruct what was applied without a record.
     */
    if (error) {
      console.error('[audit] FAILED TO RECORD A COMPLETED MUTATION', {
        action: ctx.action,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        actor: session.uid,
        cause: error.message,
      })
      throw new AuditError(`Audit write failed: ${error.message}`)
    }
    return result
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
