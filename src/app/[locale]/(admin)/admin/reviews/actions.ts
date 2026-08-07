'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
import {
  addApproval,
  getApprovalForSubmission,
  getSubmission,
  nextApprovalNumber,
  setSubmissionDecision,
} from '@/lib/data/store'
import { generateVerificationCode } from '@/lib/reports'

export type ReviewResult =
  | { ok: true; verificationCode?: string }
  | {
      ok: false
      error: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'INVALID' | 'NOT_FOUND' | 'COMMENT_REQUIRED'
    }

const schema = z.object({
  submissionId: z.string().min(1),
  decision: z.enum(['approved', 'rejected', 'revision_requested']),
  comment: z.string().trim().max(2000).optional().default(''),
})

/**
 * Record a review decision on a report submission.
 *
 * On APPROVE, a `ReportApproval` is issued carrying a random verification code,
 * and the QR on the approval certificate encodes that code. On REJECT or
 * REVISION, a comment is mandatory — the audit wrapper independently refuses
 * `report.reject` / `report.revision` without a reason, and the member needs
 * to know what to fix.
 *
 * Every path is audited. The decision and the submission-status change happen
 * together; Phase 3 makes them one transaction.
 */
export async function reviewReportAction(input: unknown): Promise<ReviewResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { submissionId, decision, comment } = parsed.data

  if ((decision === 'rejected' || decision === 'revision_requested') && !comment) {
    return { ok: false, error: 'COMMENT_REQUIRED' }
  }

  try {
    await assertPermission('reports', decision === 'approved' ? 'approve' : 'review')

    const submission = getSubmission(submissionId)
    if (!submission) return { ok: false, error: 'NOT_FOUND' }

    if (decision === 'approved') {
      // Idempotent-ish: if already approved, return the existing code.
      const existing = getApprovalForSubmission(submissionId)
      if (existing) return { ok: true, verificationCode: existing.verificationCode }

      const code = generateVerificationCode()
      const result = await withAudit(
        {
          action: 'report.approve',
          entityType: 'report_submission',
          entityId: submissionId,
          before: { status: submission.status },
        },
        async () => {
          setSubmissionDecision(submissionId, 'approved', comment || null)
          const session = await assertPermission('reports', 'approve')
          addApproval({
            submissionId,
            orderId: submission.orderId,
            approvalNumber: nextApprovalNumber(),
            verificationCode: code,
            approvedByUid: session.uid,
          })
          return { verificationCode: code }
        },
      )
      revalidatePath('/ar/admin/reviews')
      revalidatePath('/en/admin/reviews')
      return { ok: true, verificationCode: result.verificationCode }
    }

    const action = decision === 'rejected' ? 'report.reject' : 'report.revision'
    const nextStatus = decision === 'rejected' ? 'rejected' : 'revision_requested'
    await withAudit(
      {
        action,
        entityType: 'report_submission',
        entityId: submissionId,
        reason: comment,
        before: { status: submission.status },
      },
      async () => setSubmissionDecision(submissionId, nextStatus, comment),
    )
    revalidatePath('/ar/admin/reviews')
    revalidatePath('/en/admin/reviews')
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    throw err
  }
}
