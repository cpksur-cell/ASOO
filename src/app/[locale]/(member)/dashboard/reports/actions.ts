'use server'

import { z } from 'zod'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
import { addSubmission, getOrderByNumber } from '@/lib/data/store'
import { ALLOWED_FILE_TYPES, MAX_REPORT_BYTES, fileTypeFromName } from '@/lib/reports'

export type SubmitResult =
  | { ok: true; submissionId: string }
  | {
      ok: false
      error:
        | 'UNAUTHENTICATED'
        | 'UNAUTHORIZED'
        | 'INVALID'
        | 'ORDER_NOT_FOUND'
        | 'FILE_TYPE'
        | 'FILE_SIZE'
    }

const schema = z.object({
  orderNumber: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  fileSize: z.number().int().nonnegative(),
  note: z.string().max(1000).optional().default(''),
})

/**
 * Record a report upload against an order.
 *
 * PHASE 2 SCAFFOLD. The bytes are not stored yet — the action captures the
 * file's name/size/type and records the submission. Phase 3 uploads the bytes
 * to the PRIVATE bucket via a signed URL, records the checksum, and queues a
 * virus scan before the file is servable (docs/08-security.md §6).
 *
 * Two ownership guards: the permission check, and confirming the order belongs
 * to the caller. A member cannot attach a report to someone else's order.
 */
export async function submitReportAction(input: unknown): Promise<SubmitResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { orderNumber, fileName, fileSize, note } = parsed.data

  try {
    const session = await assertPermission('reports', 'submit')

    const order = getOrderByNumber(orderNumber)
    if (!order || order.ownerUid !== session.uid) {
      return { ok: false, error: 'ORDER_NOT_FOUND' }
    }

    const fileType = fileTypeFromName(fileName)
    if (!fileType || !ALLOWED_FILE_TYPES[fileType]) {
      return { ok: false, error: 'FILE_TYPE' }
    }
    if (fileSize > MAX_REPORT_BYTES) {
      return { ok: false, error: 'FILE_SIZE' }
    }

    const submission = await withAudit(
      {
        action: 'report.submit',
        entityType: 'report_submission',
        entityId: order.id,
      },
      async () =>
        addSubmission({
          orderId: order.id,
          submittedByUid: session.uid,
          fileType,
          fileName,
          fileSize,
          note,
        }),
    )

    return { ok: true, submissionId: submission.id }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    throw err
  }
}
