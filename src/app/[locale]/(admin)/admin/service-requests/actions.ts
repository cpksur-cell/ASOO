'use server'

import { revalidatePath } from 'next/cache'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
import { answerServiceRequest, getServiceRequest } from '@/lib/data/service-requests'
import { MAX_NOTE_LENGTH } from '@/lib/service-requests'

export type AnswerResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'UNAUTHENTICATED'
        | 'UNAUTHORIZED'
        | 'NOT_FOUND'
        | 'DATA_REQUIRED'
        | 'REASON_REQUIRED'
        | 'FAILED'
    }

/** Paths that show a request's state, refreshed after every transition. */
function revalidateAll() {
  for (const locale of ['ar', 'en']) {
    revalidatePath(`/${locale}/admin/service-requests`)
    revalidatePath(`/${locale}/dashboard/service-requests`)
  }
}

/**
 * Take a request off the queue: it moves to `in_progress` so two officers do
 * not both walk it to the department. Not a lock — it is advisory, and the
 * event row records who took it.
 */
export async function takeServiceRequestAction(id: string): Promise<AnswerResult> {
  try {
    await assertPermission('requests', 'fulfill')

    const request = await getServiceRequest(id)
    if (!request) return { ok: false, error: 'NOT_FOUND' }

    await withAudit(
      {
        action: 'servicerequest.take',
        entityType: 'service_request',
        entityId: request.requestNumber,
        before: { status: request.status },
      },
      async () => {
        const updated = await answerServiceRequest({ id, status: 'in_progress' })
        return updated ? { requestNumber: updated.requestNumber, status: updated.status } : null
      },
    )

    revalidateAll()
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    console.error('[servicerequest] take failed', err)
    return { ok: false, error: 'FAILED' }
  }
}

/**
 * Answer a request — hand back the data, or decline with a reason.
 *
 * Both branches demand text, for the same reason: a "completed" with nothing
 * in it and a "declined" with no reason are each a dead end for the member,
 * who then has to phone the syndicate to learn what happened. The decline
 * reason is additionally required by the audit wrapper
 * (`servicerequest.reject` is in REASON_REQUIRED), so it is enforced twice.
 */
export async function answerServiceRequestAction(input: {
  id: string
  decision: 'fulfilled' | 'rejected'
  responseData?: string
  responseNote?: string
}): Promise<AnswerResult> {
  const responseData = String(input.responseData ?? '').trim().slice(0, 20_000)
  const responseNote = String(input.responseNote ?? '').trim().slice(0, MAX_NOTE_LENGTH)

  if (input.decision === 'fulfilled' && !responseData) {
    return { ok: false, error: 'DATA_REQUIRED' }
  }
  if (input.decision === 'rejected' && !responseNote) {
    return { ok: false, error: 'REASON_REQUIRED' }
  }

  try {
    await assertPermission('requests', 'fulfill')

    const request = await getServiceRequest(input.id)
    if (!request) return { ok: false, error: 'NOT_FOUND' }

    await withAudit(
      {
        action:
          input.decision === 'fulfilled' ? 'servicerequest.fulfil' : 'servicerequest.reject',
        entityType: 'service_request',
        entityId: request.requestNumber,
        before: { status: request.status },
        reason: responseNote || undefined,
      },
      // The closure returns a SUMMARY, not the updated row. `withAudit` writes
      // whatever it gets back into `audit_logs.after`, and the parcel data
      // belongs to the member — recording that it was returned is the audit's
      // job; keeping a second copy of it is not.
      async () => {
        const updated = await answerServiceRequest({
          id: input.id,
          status: input.decision,
          responseData: input.decision === 'fulfilled' ? responseData : undefined,
          responseNote,
        })
        return updated
          ? {
              requestNumber: updated.requestNumber,
              status: updated.status,
              respondedAt: updated.respondedAt,
              dataLength: responseData.length,
            }
          : null
      },
    )

    revalidateAll()
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    console.error('[servicerequest] answer failed', err)
    return { ok: false, error: 'FAILED' }
  }
}
