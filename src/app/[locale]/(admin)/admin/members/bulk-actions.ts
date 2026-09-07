'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAtomicAudit } from '@/lib/audit/atomic'
import {
  buildBulkMemberOps,
  buildMemberUpdateOps,
  getAdminMember,
  type MemberPatch,
} from '@/lib/data/admin-members'

export type MemberEditResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'INVALID' | 'NOT_FOUND' | 'FAILED' }

export type BulkResult =
  | { ok: true; count: number }
  | { ok: false; error: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'INVALID' | 'NOTHING' | 'FAILED' }

const MEMBER_STATUSES = ['active', 'suspended', 'expired', 'withdrawn', 'pending'] as const

const editSchema = z.object({
  id: z.string().uuid(),
  licenseNumber: z.string().trim().max(64).optional(),
  governorateCode: z.string().trim().max(64).optional(),
  categoryCode: z.string().trim().max(64).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  isDirectoryVisible: z.boolean().optional(),
  fullNameAr: z.string().trim().min(1).max(200).optional(),
  fullNameEn: z.string().trim().max(200).optional(),
  officeNameAr: z.string().trim().max(200).optional(),
  officeNameEn: z.string().trim().max(200).optional(),
})

/**
 * Correct a single member record.
 *
 * The roster arrived as names only, so this is how a governorate, an office,
 * a real DLS licence number, or a mis-transliterated English name gets fixed.
 *
 * The whole `before` row is captured for the audit trail: for a membership
 * record, "what did it say previously" is the question that actually gets
 * asked later, and a diff is only reconstructable if the prior state was
 * recorded.
 */
export async function updateMemberAction(input: unknown): Promise<MemberEditResult> {
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id, ...rest } = parsed.data

  try {
    await assertPermission('members', 'update')

    const before = await getAdminMember(id)
    if (!before) return { ok: false, error: 'NOT_FOUND' }

    // Only forward keys the caller actually sent, so an omitted field is left
    // alone rather than being blanked.
    const patch: MemberPatch = {}
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value
    }
    if (Object.keys(patch).length === 0) return { ok: true }

    const ops = await buildMemberUpdateOps(id, patch)
    if (ops.length === 0) return { ok: true }

    // Atomic: the member row, the translation rows and the audit record all
    // commit together or not at all. `before` is captured inside the
    // transaction by the database, so it reflects the row as it actually was
    // at the moment of the write — not as it looked when we read it earlier.
    await withAtomicAudit(
      { action: 'member.update', entityType: 'member', entityId: id },
      ops,
    )

    revalidatePath('/ar/admin/members')
    revalidatePath('/en/admin/members')
    // The public directory reflects these fields, so it must not serve stale
    // cached pages after a correction.
    revalidatePath('/ar/directory')
    revalidatePath('/en/directory')
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    return { ok: false, error: 'FAILED' }
  }
}

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  governorateCode: z.string().trim().max(64).optional(),
  categoryCode: z.string().trim().max(64).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  isDirectoryVisible: z.boolean().optional(),
})

/**
 * Apply one change to many members.
 *
 * Capped at 500 ids per call: a bulk edit is a large, hard-to-review action,
 * and an unbounded one invites a single mistake that rewrites the entire
 * register. One audit row records the whole operation, including every id it
 * touched, so the blast radius is reconstructable afterwards.
 */
export async function bulkUpdateMembersAction(input: unknown): Promise<BulkResult> {
  const parsed = bulkSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { ids, ...patch } = parsed.data

  const hasChange = Object.values(patch).some((v) => v !== undefined)
  if (!hasChange) return { ok: false, error: 'NOTHING' }

  try {
    await assertPermission('members', 'update')

    const ops = await buildBulkMemberOps(ids, patch)
    if (ops.length === 0) return { ok: false, error: 'NOTHING' }

    // One transaction for the whole batch. Previously a failure part-way
    // through left some members changed, some not, and possibly no audit row
    // at all — the worst outcome for the highest-blast-radius action in the
    // system. Now the batch is all-or-nothing, and the audit row carries a
    // before/after snapshot per member rather than just the list of ids.
    const { rows } = await withAtomicAudit(
      {
        action: 'member.bulk_update',
        entityType: 'member',
        // No single subject — name the batch, and the per-member detail lives
        // in the recorded before/after.
        entityId: `batch:${ids.length}`,
      },
      ops,
    )
    const count = rows.filter((r) => r.length > 0).length

    revalidatePath('/ar/admin/members')
    revalidatePath('/en/admin/members')
    revalidatePath('/ar/directory')
    revalidatePath('/en/directory')
    return { ok: true, count }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    return { ok: false, error: 'FAILED' }
  }
}
