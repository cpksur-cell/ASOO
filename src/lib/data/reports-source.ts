import 'server-only'

/**
 * The report-workflow data source.
 *
 * One async facade over two backends behind the SAME domain shapes
 * (StoredOrder / StoredSubmission / StoredApproval):
 *
 *   • Supabase (Postgres) — used whenever the app is configured with Supabase
 *     credentials. This is the real database.
 *   • The in-memory demo store — the fallback when Supabase is NOT configured,
 *     so the deployed site keeps working until the keys are set.
 *
 * Call sites `await` these and never learn which backend answered. This is the
 * seam the project migrates across: today most tables still read from the seed
 * store; the report workflow reads from Postgres the moment Supabase is wired.
 */

import { getUserSession } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServiceClient } from '@/lib/supabase/server'
import type { ApprovalRow, OrderRow, ReviewRow, SubmissionRow } from '@/lib/supabase/types'

import {
  addApproval as memAddApproval,
  addSubmission as memAddSubmission,
  getApprovalByCode as memGetApprovalByCode,
  getApprovalForSubmission as memGetApprovalForSubmission,
  getOrder as memGetOrder,
  getOrderByNumber as memGetOrderByNumber,
  getSubmission as memGetSubmission,
  listOrdersForUser as memListOrdersForUser,
  listReviewQueue as memListReviewQueue,
  listSubmissionsForOrder as memListSubmissionsForOrder,
  nextApprovalNumber,
  setSubmissionDecision as memSetSubmissionDecision,
  type ReportFileType,
  type StoredApproval,
  type StoredOrder,
  type StoredSubmission,
  type SubmissionStatus,
} from './store'
import { generateVerificationCode } from '@/lib/reports'

/* ----------------------------------------------------------------- mappers */

type OrderRowWithGov = OrderRow & { governorates?: { code: string } | null }
type SubmissionRowWithReviews = SubmissionRow & {
  report_reviews?: Array<{ comments: string | null; created_at: string }> | null
}

const day = (iso: string): string => iso.slice(0, 10)

function mapOrder(row: OrderRowWithGov): StoredOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    ownerUid: row.owner_user_id ?? '',
    type: row.type as StoredOrder['type'],
    title: row.title,
    parcelReference: row.parcel_reference ?? '',
    clientName: row.client_name ?? '',
    governorateCode: row.governorates?.code ?? '',
    createdAt: day(row.created_at),
  }
}

function latestReviewComment(
  reviews: SubmissionRowWithReviews['report_reviews'],
): string | null {
  if (!reviews || reviews.length === 0) return null
  const latest = [...reviews].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  return latest?.comments ?? null
}

function mapSubmission(row: SubmissionRowWithReviews): StoredSubmission {
  return {
    id: row.id,
    orderId: row.order_id,
    submittedByUid: row.submitted_by,
    fileType: row.file_type as ReportFileType,
    fileName: row.file_name,
    fileSize: row.file_size ?? 0,
    version: row.version,
    status: row.status as SubmissionStatus,
    note: row.note ?? '',
    reviewComment: latestReviewComment(row.report_reviews),
    createdAt: day(row.created_at),
  }
}

function mapApproval(row: ApprovalRow): StoredApproval {
  return {
    approvalNumber: row.approval_number,
    submissionId: row.submission_id,
    orderId: row.order_id,
    verificationCode: row.verification_code,
    status: row.status,
    approvedByUid: row.approved_by,
    issuedAt: day(row.issued_at),
  }
}

const ORDER_SELECT = '*, governorates(code)'
const SUBMISSION_SELECT = '*, report_reviews(comments, created_at)'
/** Statuses that count as an "open" submission a resubmission supersedes. */
const OPEN_STATUSES: SubmissionStatus[] = ['uploaded', 'under_review', 'revision_requested']

/* ------------------------------------------------------------------ reads */

export async function listOrdersForUser(uid: string): Promise<StoredOrder[]> {
  if (!isSupabaseConfigured()) return memListOrdersForUser(uid)
  const { data, error } = await getServiceClient()
    .from('orders')
    .select(ORDER_SELECT)
    .eq('owner_user_id', uid)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as OrderRowWithGov[]).map(mapOrder)
}

export async function getOrderByNumber(orderNumber: string): Promise<StoredOrder | null> {
  if (!isSupabaseConfigured()) return memGetOrderByNumber(orderNumber)
  const { data, error } = await getServiceClient()
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_number', orderNumber.trim())
    .maybeSingle()
  if (error) throw error
  return data ? mapOrder(data as OrderRowWithGov) : null
}

export async function getOrder(id: string): Promise<StoredOrder | null> {
  if (!isSupabaseConfigured()) return memGetOrder(id)
  const { data, error } = await getServiceClient()
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapOrder(data as OrderRowWithGov) : null
}

export async function listSubmissionsForOrder(orderId: string): Promise<StoredSubmission[]> {
  if (!isSupabaseConfigured()) return memListSubmissionsForOrder(orderId)
  const { data, error } = await getServiceClient()
    .from('report_submissions')
    .select(SUBMISSION_SELECT)
    .eq('order_id', orderId)
    .order('version', { ascending: false })
  if (error) throw error
  return (data as SubmissionRowWithReviews[]).map(mapSubmission)
}

export async function getSubmission(id: string): Promise<StoredSubmission | null> {
  if (!isSupabaseConfigured()) return memGetSubmission(id)
  const { data, error } = await getServiceClient()
    .from('report_submissions')
    .select(SUBMISSION_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapSubmission(data as SubmissionRowWithReviews) : null
}

export async function listReviewQueue(): Promise<StoredSubmission[]> {
  if (!isSupabaseConfigured()) return memListReviewQueue()
  const { data, error } = await getServiceClient()
    .from('report_submissions')
    .select(SUBMISSION_SELECT)
    .in('status', ['uploaded', 'under_review'])
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as SubmissionRowWithReviews[]).map(mapSubmission)
}

export async function getApprovalForSubmission(
  submissionId: string,
): Promise<StoredApproval | null> {
  if (!isSupabaseConfigured()) return memGetApprovalForSubmission(submissionId)
  const { data, error } = await getServiceClient()
    .from('report_approvals')
    .select('*')
    .eq('submission_id', submissionId)
    .maybeSingle()
  if (error) throw error
  return data ? mapApproval(data as ApprovalRow) : null
}

export async function getApprovalByCode(code: string): Promise<StoredApproval | null> {
  if (!isSupabaseConfigured()) return memGetApprovalByCode(code)
  const { data, error } = await getServiceClient()
    .from('report_approvals')
    .select('*')
    .eq('verification_code', code)
    .maybeSingle()
  if (error) throw error
  return data ? mapApproval(data as ApprovalRow) : null
}

/* ----------------------------------------------------------------- writes */

export async function addSubmission(input: {
  orderId: string
  submittedByUid: string
  fileType: ReportFileType
  fileName: string
  fileSize: number
  note: string
}): Promise<StoredSubmission> {
  if (!isSupabaseConfigured()) return memAddSubmission(input)

  const supabase = getServiceClient()

  // Supersede any open submission on this order, then compute the next version.
  const { data: priors, error: priorErr } = await supabase
    .from('report_submissions')
    .select('id, version, status')
    .eq('order_id', input.orderId)
  if (priorErr) throw priorErr

  const openIds = (priors ?? [])
    .filter((p) => OPEN_STATUSES.includes(p.status as SubmissionStatus))
    .map((p) => p.id as string)
  if (openIds.length > 0) {
    const { error } = await supabase
      .from('report_submissions')
      .update({ status: 'superseded' })
      .in('id', openIds)
    if (error) throw error
  }
  const version =
    (priors ?? []).reduce((max, p) => Math.max(max, p.version as number), 0) + 1

  const { data, error } = await supabase
    .from('report_submissions')
    .insert({
      order_id: input.orderId,
      submitted_by: input.submittedByUid,
      file_type: input.fileType,
      file_name: input.fileName,
      file_size: input.fileSize,
      version,
      status: 'uploaded',
      note: input.note,
    })
    .select(SUBMISSION_SELECT)
    .single()
  if (error) throw error
  return mapSubmission(data as SubmissionRowWithReviews)
}

const DECISION_FOR: Record<string, ReviewRow['decision']> = {
  approved: 'approved',
  rejected: 'rejected',
  revision_requested: 'revision_requested',
}

/**
 * Record a review decision: append an immutable review row AND move the
 * submission's status, mirroring the DB's append-only reviews table. The
 * comment lives on the review row; the member page reads it back as the
 * submission's latest review comment.
 */
export async function setSubmissionDecision(
  id: string,
  status: SubmissionStatus,
  comment: string | null,
): Promise<StoredSubmission | null> {
  if (!isSupabaseConfigured()) return memSetSubmissionDecision(id, status, comment)

  const supabase = getServiceClient()
  const decision = DECISION_FOR[status]
  if (decision) {
    const session = await getUserSession()
    const { error: reviewErr } = await supabase.from('report_reviews').insert({
      submission_id: id,
      reviewer_id: session?.uid ?? 'system',
      reviewer_role: session?.role ?? null,
      decision,
      comments: comment,
    })
    if (reviewErr) throw reviewErr
  }

  const { data, error } = await supabase
    .from('report_submissions')
    .update({ status })
    .eq('id', id)
    .select(SUBMISSION_SELECT)
    .maybeSingle()
  if (error) throw error
  return data ? mapSubmission(data as SubmissionRowWithReviews) : null
}

/**
 * Issue an approval. The database owns the approval number (a sequence) and the
 * verification code (random), so a client can never inject either; both come
 * back on the insert. In the fallback path the store generates them instead.
 */
export async function addApproval(input: {
  submissionId: string
  orderId: string
  approvedByUid: string
}): Promise<StoredApproval> {
  if (!isSupabaseConfigured()) {
    return memAddApproval({
      submissionId: input.submissionId,
      orderId: input.orderId,
      approvalNumber: nextApprovalNumber(),
      verificationCode: generateVerificationCode(),
      approvedByUid: input.approvedByUid,
    })
  }

  const { data, error } = await getServiceClient()
    .from('report_approvals')
    .insert({
      submission_id: input.submissionId,
      order_id: input.orderId,
      approved_by: input.approvedByUid,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapApproval(data as ApprovalRow)
}
