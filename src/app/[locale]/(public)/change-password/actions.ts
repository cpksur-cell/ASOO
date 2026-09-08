'use server'

import { z } from 'zod'

import { getUserSession } from '@/lib/auth/server'
import { createAuthClient } from '@/lib/supabase/auth-server'
import { getServiceClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { withAudit } from '@/lib/audit'

export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false
      error: 'UNAUTHENTICATED' | 'INVALID' | 'TOO_SHORT' | 'SAME_AS_OLD' | 'FAILED'
    }

/**
 * The minimum a member's own password may be.
 *
 * Twelve rather than eight. These accounts reach personal identity documents
 * and, for staff, the register itself; the initial password is shared and
 * public knowledge inside the syndicate, so the replacement is the first thing
 * that actually protects the account.
 */
const MIN_LENGTH = 12

const schema = z.object({
  password: z.string().min(1).max(200),
  confirm: z.string().min(1).max(200),
})

/**
 * Replace the password this account was provisioned with.
 *
 * Deliberately does NOT call `assertPermission`: that refuses everything while
 * `must_change_password` is set, which is the whole point of the gate — so the
 * one action that clears the gate has to sit outside it. It still requires a
 * real session, which is what stops it being an open endpoint.
 *
 * The flag is cleared only AFTER Supabase accepts the new password. The other
 * order would let a failed update leave the member unable to sign in with the
 * old password and no longer prompted to set a new one.
 */
export async function changePasswordAction(input: unknown): Promise<ChangePasswordResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { password, confirm } = parsed.data

  if (password !== confirm) return { ok: false, error: 'INVALID' }
  if (password.length < MIN_LENGTH) return { ok: false, error: 'TOO_SHORT' }

  const session = await getUserSession()
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' }

  if (!isSupabaseConfigured()) {
    // Demo mode has no auth provider to change a password with.
    return { ok: false, error: 'FAILED' }
  }

  const supabase = await createAuthClient()
  if (!supabase) return { ok: false, error: 'FAILED' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    /*
     * Supabase refuses a password identical to the current one. Saying so
     * plainly is better than a generic failure: a member who typed the shared
     * initial password again needs to know that is exactly what is not
     * allowed, not that something went wrong.
     */
    const same = /same.*password|should be different/i.test(error.message)
    return { ok: false, error: same ? 'SAME_AS_OLD' : 'FAILED' }
  }

  const { error: flagError } = await getServiceClient()
    .from('users')
    .update({ must_change_password: false })
    .eq('id', session.uid)

  if (flagError) {
    // The password DID change. Reporting failure here would send the member
    // round again with a password that no longer works.
    console.error('[auth] password changed but flag not cleared', flagError.message)
  }

  await withAudit(
    {
      action: 'account.password_change',
      entityType: 'user',
      entityId: session.uid,
    },
    async () => ({ selfService: true }),
  )

  return { ok: true }
}
