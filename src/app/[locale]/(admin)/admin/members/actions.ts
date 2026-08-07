'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
import { getStoredMember, setStoredMemberStatus } from '@/lib/data/store'

export type MemberActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'INVALID' | 'NOT_FOUND' }

const suspendSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(1),
})

/**
 * Suspend a member. `members:suspend`, and a reason is MANDATORY — `withAudit`
 * refuses `member.suspend` without one (docs/08-security.md §7). Suspension
 * removes the member from the public directory immediately; that is the point
 * of it. docs/06-ux-flows.md §9.
 */
export async function suspendMemberAction(input: unknown): Promise<MemberActionResult> {
  const parsed = suspendSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id, reason } = parsed.data

  try {
    await assertPermission('members', 'suspend')
    const before = getStoredMember(id)
    if (!before) return { ok: false, error: 'NOT_FOUND' }

    await withAudit(
      {
        action: 'member.suspend',
        entityType: 'member',
        entityId: id,
        reason,
        before: { status: before.status },
      },
      async () => setStoredMemberStatus(id, 'suspended'),
    )
    revalidatePath('/ar/directory')
    revalidatePath('/en/directory')
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    throw err
  }
}

const reactivateSchema = z.object({ id: z.string().min(1) })

export async function reactivateMemberAction(input: unknown): Promise<MemberActionResult> {
  const parsed = reactivateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id } = parsed.data

  try {
    await assertPermission('members', 'suspend')
    const before = getStoredMember(id)
    if (!before) return { ok: false, error: 'NOT_FOUND' }

    await withAudit(
      {
        action: 'member.reactivate',
        entityType: 'member',
        entityId: id,
        before: { status: before.status },
      },
      async () => setStoredMemberStatus(id, 'active'),
    )
    revalidatePath('/ar/directory')
    revalidatePath('/en/directory')
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    throw err
  }
}
