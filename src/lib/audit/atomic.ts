import 'server-only'

import { headers } from 'next/headers'

import { getUserSession } from '@/lib/auth/server'
import { getServiceClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { AuditError, type AuditContext } from './index'

/**
 * The atomic audited mutation.
 *
 * `withAudit()` runs a closure and then writes the audit row. supabase-js
 * issues each statement over its own HTTP request, so by the time that second
 * write happens the first has already committed — a failure leaves the change
 * applied and unrecorded, which is precisely what an audit trail exists to
 * prevent. It was not theoretical: a foreign key on `audit_logs` once rejected
 * the record after a member update had gone through (fixed in 0009).
 *
 * This closes it. The mutation is described rather than executed, handed to
 * the `audited_write` Postgres function (migration 0014), and PostgREST runs
 * that single RPC call inside a single transaction. Postgres then guarantees
 * what application ordering could not: the mutations and the audit row commit
 * together or not at all.
 *
 * Two properties fall out of doing it this way, and both are improvements over
 * the old wrapper beyond atomicity:
 *
 *   · `before` and `after` are captured by the DATABASE from the rows it
 *     actually touched, not asserted by the caller. A trail recording what the
 *     application believed it did is worth much less than one recording what
 *     happened.
 *   · Values the database generates — `request_number`, `approval_number`,
 *     `verification_code` — come back in the result. The client cannot supply
 *     them, and does not need a second round trip to read them.
 */

/**
 * One write. `match` selects rows; `values` are the columns to set.
 *
 * `reorder_block` is the odd one out and deliberately so. The other kinds say
 * WHICH ROWS to change, which means the caller had to read them first — over a
 * separate request, outside the transaction, so the answer could already be
 * stale (see migration 0015). It instead says what to DO — move this block one
 * place — and lets the database pick the neighbour under a lock. Any future op
 * whose target depends on the current state of other rows belongs in the same
 * shape.
 */
export interface AuditedOp {
  kind: 'insert' | 'update' | 'upsert' | 'delete' | 'reorder_block'
  /** Must be on the allowlist inside `audited_write`; `audit_logs` is not. */
  table: string
  /** Required for update/upsert/delete/reorder_block. Columns are checked against the catalog. */
  match?: Record<string, unknown>
  /** Required for insert/update/upsert. */
  values?: Record<string, unknown>
  /** `reorder_block` only. */
  direction?: 'up' | 'down'
}

export interface AuditedResult<T = Record<string, unknown>> {
  /** Rows written, one array per op, in the order the ops were given. */
  rows: T[][]
  /** Rows as they were before, one array per op. Empty for an insert. */
  before: T[][]
}

/** Actions the audit trail refuses without a stated reason. Mirrors ./index.ts. */
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
  'servicerequest.reject',
]

/**
 * Apply `ops` and record `ctx`, atomically.
 *
 * Throws if the caller is unauthenticated, if a reason-requiring action has no
 * reason, or if the database refuses any part — in which case nothing was
 * written, so the caller can report failure honestly.
 */
export async function withAtomicAudit<T = Record<string, unknown>>(
  ctx: AuditContext & { entityType: string; entityId: string },
  ops: AuditedOp[],
): Promise<AuditedResult<T>> {
  const session = await getUserSession()
  if (!session) throw new AuditError('Cannot audit an unauthenticated mutation')

  if (REASON_REQUIRED.includes(ctx.action) && !ctx.reason?.trim()) {
    throw new AuditError(`Action "${ctx.action}" requires a reason`)
  }

  if (!isSupabaseConfigured()) {
    throw new AuditError(
      'withAtomicAudit requires Supabase. Use withAudit for the in-memory fallback.',
    )
  }

  if (ops.length === 0) {
    throw new AuditError(`Action "${ctx.action}" was given no operations to apply`)
  }

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

  const { data, error } = await getServiceClient().rpc('audited_write', {
    p_audit: {
      action: ctx.action,
      entity_type: ctx.entityType,
      entity_id: ctx.entityId,
      actor_user_id: session.uid,
      // A snapshot, not a reference. Roles change; the record must not.
      actor_role: session.role,
      reason: ctx.reason ?? null,
      ip_address: ip,
      user_agent: userAgent,
    },
    p_ops: ops,
  })

  if (error) {
    /*
     * Nothing was applied — the whole call rolled back — so this is a clean
     * failure the caller can surface, not a change to reconcile. That is the
     * difference from the old wrapper, where the same log line meant a
     * mutation had already landed unrecorded.
     */
    console.error('[audit] atomic mutation refused; nothing was written', {
      action: ctx.action,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      actor: session.uid,
      cause: error.message,
    })
    throw new AuditError(`Audited write failed: ${error.message}`)
  }

  const result = (data ?? { rows: [], before: [] }) as AuditedResult<T>
  return { rows: result.rows ?? [], before: result.before ?? [] }
}

/** Convenience for the common case: one op, and you want the row back. */
export async function auditedOne<T = Record<string, unknown>>(
  ctx: AuditContext & { entityType: string; entityId: string },
  op: AuditedOp,
): Promise<T | null> {
  const { rows } = await withAtomicAudit<T>(ctx, [op])
  return rows[0]?.[0] ?? null
}
