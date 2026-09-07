'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertPermission, AuthError, getUserSession } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
import { withAtomicAudit } from '@/lib/audit/atomic'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import {
  addApproval,
  buildDecisionOps,
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
 * Every path is audited ATOMICALLY when Supabase is configured: the review
 * row, the status change and (on approval) the approval artifact commit in one
 * transaction with the audit record, or none of them do.
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

      const session = await assertPermission('reports', 'approve')
      const ctx = {
        action: 'report.approve',
        entityType: 'report_submission',
        entityId: submissionId,
      }

      let verificationCode: string
      if (isSupabaseConfigured()) {
        /*
         * Three writes in one transaction: the immutable review row, the
         * submission's new status, and the approval artifact. Previously these
         * were separate requests, so a failure between them could leave a
         * submission marked approved with no approval issued — a report the
         * member is told is approved but which no QR code will ever verify.
         *
         * The approval number and verification code come from column defaults,
         * so neither this code nor a client can choose them; they are read back
         * off the inserted row.
         */
        const { rows } = await withAtomicAudit<{ verification_code: string }>(
          ctx,
          buildDecisionOps({
            submissionId,
            orderId: submission.orderId,
            status: 'approved',
            comment: comment || null,
            reviewerId: session.uid,
            reviewerRole: session.role,
            approval: { ...details, approvedByUid: session.uid },
          }),
        )
        // The approval insert is the last op.
        verificationCode = rows.at(-1)?.[0]?.verification_code ?? ''
      } else {
        const result = await withAudit(
          { ...ctx, before: { status: submission.status } },
          async () => {
            await setSubmissionDecision(submissionId, 'approved', comment || null)
            const approval = await addApproval({
              submissionId,
              orderId: submission.orderId,
              approvedByUid: session.uid,
              ...details,
            })
            return { verificationCode: approval.verificationCode }
          },
        )
        verificationCode = result.verificationCode
      }

      revalidatePath('/ar/admin/reviews')
      revalidatePath('/en/admin/reviews')
      return { ok: true, verificationCode }
    }

    const action = decision === 'rejected' ? 'report.reject' : 'report.revision'
    const nextStatus = decision === 'rejected' ? 'rejected' : 'revision_requested'
    const ctx = {
      action,
      entityType: 'report_submission',
      entityId: submissionId,
      reason: comment,
    }

    if (isSupabaseConfigured()) {
      const session = await getUserSession()
      await withAtomicAudit(
        ctx,
        buildDecisionOps({
          submissionId,
          orderId: submission.orderId,
          status: nextStatus,
          comment,
          reviewerId: session?.uid ?? 'system',
          reviewerRole: session?.role ?? null,
        }),
      )
    } else {
      await withAudit(
        { ...ctx, before: { status: submission.status } },
        async () => setSubmissionDecision(submissionId, nextStatus, comment),
      )
    }
    revalidatePath('/ar/admin/reviews')
    revalidatePath('/en/admin/reviews')
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    throw err
  }
}
