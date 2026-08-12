'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
import {
  addApproval,
  getApprovalForSubmission,
  getSubmission,
  setSubmissionDecision,
} from '@/lib/data/reports-source'

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
  /*
   * What the approval actually certifies.
   *
   * A syndicate approval on a survey report is not a bare yes — the paper
   * form it replaces records the land reference the work relates to and how
   * the survey was performed. Optional at this layer because a reviewer may
   * legitimately approve before every field is to hand, but captured on the
   * approval record and shown on the public verification page when present.
   */
  dlsReference: z.string().trim().max(64).optional(),
  basin: z.string().trim().max(64).optional(),
  plot: z.string().trim().max(64).optional(),
  surveyMethod: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(2000).optional(),
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
  const { submissionId, decision, comment, ...details } = parsed.data

  if ((decision === 'rejected' || decision === 'revision_requested') && !comment) {
    return { ok: false, error: 'COMMENT_REQUIRED' }
  }

  try {
    await assertPermission('reports', decision === 'approved' ? 'approve' : 'review')

    const submission = await getSubmission(submissionId)
    if (!submission) return { ok: false, error: 'NOT_FOUND' }

    if (decision === 'approved') {
      // Idempotent-ish: if already approved, return the existing code.
      const existing = await getApprovalForSubmission(submissionId)
      if (existing) return { ok: true, verificationCode: existing.verificationCode }

      const result = await withAudit(
        {
          action: 'report.approve',
          entityType: 'report_submission',
          entityId: submissionId,
          before: { status: submission.status },
        },
        async () => {
          await setSubmissionDecision(submissionId, 'approved', comment || null)
          const session = await assertPermission('reports', 'approve')
          // The data source (DB or fallback) owns the approval number and the
          // random verification code and returns both — a client never sets them.
          const approval = await addApproval({
            submissionId,
            orderId: submission.orderId,
            approvedByUid: session.uid,
            ...details,
          })
          return { verificationCode: approval.verificationCode }
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
