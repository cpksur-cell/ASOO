'use server'

import { revalidatePath } from 'next/cache'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
import { withAtomicAudit } from '@/lib/audit/atomic'
import {
  addSubmission,
  buildSubmissionOps,
  getOrderByNumber,
  getSubmission,
} from '@/lib/data/reports-source'
import { MAX_REPORT_BYTES, buildStoragePath, validateReportBytes } from '@/lib/reports-validate'
import { isValidDlsKey, normalizeDlsKey } from '@/lib/service-requests'
import {
  createReportDownloadUrl,
  deleteReportFile,
  uploadReportFile,
} from '@/lib/reports-storage'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { can, getUserSession } from '@/lib/auth/server'

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
        | 'FILE_CONTENT'
        | 'DLS_KEY'
        | 'STORAGE'
    }

/**
 * Submit a report against an order — the real bytes, not just a filename.
 *
 * Order of operations matters here:
 *
 *   1. Permission, then OWNERSHIP. A member may hold `reports:submit` and
 *      still have no business attaching anything to someone else's order, so
 *      the order is re-fetched and its owner compared to the caller.
 *   2. The bytes are validated by CONTENT, not by extension or by the MIME
 *      type the browser volunteered. Both of those are supplied by the
 *      uploader and prove nothing.
 *   3. The file is stored, and only then is the row written. If the row fails,
 *      the object is removed again — an orphaned file in a private bucket is
 *      untracked data nobody will ever reconcile.
 *
 * The client validates too, for a fast response. That is a courtesy; this is
 * the boundary.
 */
export async function submitReportAction(formData: FormData): Promise<SubmitResult> {
  const orderNumber = String(formData.get('orderNumber') ?? '').trim()
  const note = String(formData.get('note') ?? '').slice(0, 1000)
  const file = formData.get('file')

  /*
   * The land key the report is about.
   *
   * Normalised with the SAME function the counter e-services use, so a key
   * typed here and the same key typed there fold to one value — Arabic-Indic
   * digits, stray spaces and bidi marks included. Without that, "every report
   * against this parcel" would silently miss rows.
   *
   * Deliberately NOT unique: one parcel produces many reports over its life,
   * which is what the syndicate asked for.
   */
  const dlsKey = normalizeDlsKey(String(formData.get('dlsKey') ?? ''))

  if (!orderNumber || !(file instanceof File)) return { ok: false, error: 'INVALID' }
  if (!isValidDlsKey(dlsKey)) return { ok: false, error: 'DLS_KEY' }
  if (file.size > MAX_REPORT_BYTES) return { ok: false, error: 'FILE_SIZE' }

  try {
    const session = await assertPermission('reports', 'submit')

    const order = await getOrderByNumber(orderNumber)
    if (!order || order.ownerUid !== session.uid) {
      return { ok: false, error: 'ORDER_NOT_FOUND' }
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const checked = validateReportBytes(file.name, bytes)
    if (!checked.ok) {
      return {
        ok: false,
        error:
          checked.reason === 'TOO_LARGE'
            ? 'FILE_SIZE'
            : checked.reason === 'UNSUPPORTED_TYPE'
              ? 'FILE_TYPE'
              : 'FILE_CONTENT',
      }
    }

    let storagePath = ''
    if (isSupabaseConfigured()) {
      storagePath = buildStoragePath(order.id, checked.type)
      try {
        await uploadReportFile(storagePath, checked.bytes, checked.type)
      } catch {
        return { ok: false, error: 'STORAGE' }
      }
    }

    try {
      const ctx = {
        action: 'report.submit',
        entityType: 'report_submission',
        entityId: order.id,
      }
      const args = {
        orderId: order.id,
        submittedByUid: session.uid,
        fileType: checked.type,
        fileName: file.name,
        fileSize: checked.bytes.length,
        note,
        dlsKey,
        storagePath,
        checksum: checked.checksum,
      }

      let submissionId: string
      if (isSupabaseConfigured()) {
        // Superseding the previous submission and inserting the new one now
        // share a transaction with the audit row, so an order cannot be left
        // with two open submissions or with none.
        const { rows } = await withAtomicAudit<{ id: string }>(
          ctx,
          await buildSubmissionOps(args),
        )
        submissionId = rows.at(-1)?.[0]?.id ?? ''
      } else {
        const submission = await withAudit(ctx, async () => addSubmission(args))
        submissionId = submission.id
      }

      revalidatePath('/ar/dashboard/reports')
      revalidatePath('/en/dashboard/reports')
      revalidatePath('/ar/admin/reviews')
      revalidatePath('/en/admin/reviews')
      return { ok: true, submissionId }
    } catch (err) {
      // The row did not land, so the object must not linger.
      await deleteReportFile(storagePath)
      throw err
    }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    return { ok: false, error: 'STORAGE' }
  }
}

export type DownloadResult =
  | { ok: true; url: string }
  | { ok: false; error: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'NO_FILE' }

/**
 * Mint a short-lived link to a stored report.
 *
 * Two ways to be entitled to it, and no third: the member who submitted it, or
 * a reviewer holding `reports:review`. Everyone else is refused — including
 * other members, who must not be able to read each other's professional work
 * by guessing a submission id.
 *
 * The signed URL is generated only AFTER that check, and expires in two
 * minutes, so it is not a durable capability if it leaks.
 */
export async function getReportDownloadUrlAction(
  submissionId: string,
): Promise<DownloadResult> {
  const session = await getUserSession()
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' }

  const submission = await getSubmission(submissionId)
  if (!submission) return { ok: false, error: 'NOT_FOUND' }

  const isOwner = submission.submittedByUid === session.uid
  const isReviewer = await can('reports', 'review')
  if (!isOwner && !isReviewer) return { ok: false, error: 'UNAUTHORIZED' }

  if (!submission.storagePath) return { ok: false, error: 'NO_FILE' }

  const url = await createReportDownloadUrl(submission.storagePath, submission.fileName)
  if (!url) return { ok: false, error: 'NO_FILE' }
  return { ok: true, url }
}
