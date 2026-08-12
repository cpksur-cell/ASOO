import 'server-only'

import type { LayoutBlockType, LayoutRegion } from './types'
import { DEMO_BLOCKS, DEMO_POSTS, type DemoBlockItem, type DemoNewsItem } from './demo'
import { members as seedMembers } from './seed'
import { DEMO_APPROVALS, DEMO_ORDERS, DEMO_SUBMISSIONS } from './report-demo'

/**
 * IN-MEMORY WRITE STORE — PHASE 2 SCAFFOLD, DELETE IN PHASE 3.
 *
 * The admin CMS needs somewhere to write before Data Connect exists. This is
 * that somewhere, and it is deliberately crude.
 *
 * KNOWN AND ACCEPTED LIMITATIONS:
 *   - Resets on every server restart and on hot reload
 *   - Not shared between instances, so it is wrong the moment the app scales
 *     past one process
 *   - No transactions, so `withAudit` cannot yet make the change and the audit
 *     row atomic — it can only guarantee ordering
 *
 * None of that is acceptable in production, which is why the admin screens
 * show a "demonstration data" banner. Phase 3 replaces every function here
 * with a generated Data Connect operation, and `withAudit` starts receiving a
 * real transaction handle.
 *
 * `globalThis` is used so the data survives Next's dev-mode module reloading;
 * without it every edit would appear to succeed and then vanish.
 */

export interface AuditRow {
  id: string
  actorUserId: string
  actorRole: string
  action: string
  entityType: string
  entityId: string
  before: unknown
  after: unknown
  reason: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface StoredBlock extends DemoBlockItem {
  type: LayoutBlockType | string
  region: LayoutRegion
  isPublished: boolean
}

export type AdminMemberStatus =
  | 'active'
  | 'suspended'
  | 'expired'
  | 'withdrawn'

export interface StoredMember {
  id: string
  licenseNumber: string
  membershipNumber: string
  governorateCode: string
  status: AdminMemberStatus
  fullName: Record<'ar' | 'en', string>
  officeName: Record<'ar' | 'en', string>
  joinedAt: string
}

export type OrderType =
  | 'land_subdivision'
  | 'land_settlement'
  | 'topographic_survey'
  | 'boundary_survey'
  | 'site_plan'
  | 'other'

/**
 * DXF (drawing interchange) and GML (OGC geography markup) are what the
 * Department of Lands and Survey actually exchanges, so both are first-class.
 * `docx` and `dwg` remain because submissions already exist under them.
 */
export type ReportFileType = 'pdf' | 'dxf' | 'gml' | 'docx' | 'dwg'

export type SubmissionStatus =
  | 'uploaded'
  | 'under_review'
  | 'revision_requested'
  | 'approved'
  | 'rejected'
  | 'superseded'

export interface StoredOrder {
  id: string
  orderNumber: string
  ownerUid: string
  type: OrderType
  title: string
  parcelReference: string
  clientName: string
  governorateCode: string
  createdAt: string
}

export interface StoredSubmission {
  id: string
  orderId: string
  submittedByUid: string
  fileType: ReportFileType
  fileName: string
  fileSize: number
  /** Object key in the private bucket. Empty when no bytes were stored. */
  storagePath: string
  /** SHA-256 of the stored bytes, or null for legacy metadata-only rows. */
  checksum: string | null
  version: number
  status: SubmissionStatus
  note: string
  reviewComment: string | null
  createdAt: string
}

export interface StoredApproval {
  approvalNumber: string
  submissionId: string
  orderId: string
  verificationCode: string
  status: 'valid' | 'revoked'
  approvedByUid: string
  issuedAt: string
  /** What the approval certifies. NULL where the reviewer did not record it. */
  dlsReference: string | null
  basin: string | null
  plot: string | null
  surveyMethod: string | null
  notes: string | null
}

interface Store {
  blocks: StoredBlock[]
  posts: DemoNewsItem[]
  members: StoredMember[]
  orders: StoredOrder[]
  submissions: StoredSubmission[]
  approvals: StoredApproval[]
  audit: AuditRow[]
}

const KEY = Symbol.for('asoo.dev.store')

function create(): Store {
  return {
    blocks: DEMO_BLOCKS.map((b) => ({ ...b, isPublished: true }) as StoredBlock),
    posts: DEMO_POSTS.map((p) => ({ ...p })),
    members: seedMembers.map((m) => ({
      id: m.id,
      licenseNumber: m.licenseNumber,
      membershipNumber: m.membershipNumber,
      governorateCode: m.governorateCode,
      status: m.status as AdminMemberStatus,
      fullName: m.fullName,
      officeName: m.officeName,
      joinedAt: m.joinedAt,
    })),
    orders: DEMO_ORDERS.map((o) => ({ ...o })),
    submissions: DEMO_SUBMISSIONS.map((s) => ({ ...s })),
    approvals: DEMO_APPROVALS.map((a) => ({ ...a })),
    audit: [],
  }
}

const globalStore = globalThis as unknown as { [KEY]?: Store }
if (!globalStore[KEY]) globalStore[KEY] = create()
const store = globalStore[KEY]

/* --------------------------------------------------------------- audit log */

/** Append-only. There is deliberately no update or delete. */
export function appendAuditRow(row: AuditRow): void {
  store.audit.push(row)
}

export function listAuditRows(limit = 50): AuditRow[] {
  return [...store.audit].reverse().slice(0, limit)
}

/* ----------------------------------------------------------------- blocks */

export function listStoredBlocks(): StoredBlock[] {
  return [...store.blocks].sort((a, b) => a.position - b.position)
}

export function reorderStoredBlock(id: string, direction: 'up' | 'down'): StoredBlock[] {
  const ordered = listStoredBlocks()
  const index = ordered.findIndex((b) => b.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= ordered.length) return ordered

  // Swap positions rather than reindexing the whole list — positions are
  // gap-numbered by 10 precisely so a move touches two rows, not all of them.
  const a = ordered[index]!
  const b = ordered[target]!
  const tmp = a.position
  a.position = b.position
  b.position = tmp

  return listStoredBlocks()
}

export function setStoredBlockPublished(id: string, isPublished: boolean): StoredBlock | null {
  const block = store.blocks.find((b) => b.id === id)
  if (!block) return null
  block.isPublished = isPublished
  return block
}

export function updateStoredBlockText(
  id: string,
  text: Record<string, unknown>,
): StoredBlock | null {
  const block = store.blocks.find((b) => b.id === id)
  if (!block) return null
  block.text = { ...block.text, ...text }
  return block
}

/** Removing a block UNPUBLISHES it. Editors remove things by accident. */
export function removeStoredBlock(id: string): StoredBlock | null {
  return setStoredBlockPublished(id, false)
}

/* ------------------------------------------------------------------ posts */

export function listStoredPosts(): DemoNewsItem[] {
  return [...store.posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export function getStoredPost(id: string): DemoNewsItem | null {
  return store.posts.find((p) => p.id === id) ?? null
}

export function upsertStoredPost(post: DemoNewsItem): DemoNewsItem {
  const index = store.posts.findIndex((p) => p.id === post.id)
  if (index === -1) store.posts.unshift(post)
  else store.posts[index] = post
  return post
}

/**
 * Archives rather than deletes. Content is never destroyed from the admin UI —
 * `documents`/`posts` carry `deleted_at` in the schema for exactly this reason.
 * docs/03-data-model.md §1 rule 5.
 */
export function archiveStoredPost(id: string): DemoNewsItem | null {
  const post = store.posts.find((p) => p.id === id)
  if (!post) return null
  post.status = 'draft'
  return post
}

/* ---------------------------------------------------------------- members */

export function listStoredMembers(): StoredMember[] {
  return [...store.members]
}

export function getStoredMember(id: string): StoredMember | null {
  return store.members.find((m) => m.id === id) ?? null
}

export function setStoredMemberStatus(
  id: string,
  status: AdminMemberStatus,
): StoredMember | null {
  const member = store.members.find((m) => m.id === id)
  if (!member) return null
  member.status = status
  return member
}

/* --------------------------------------------------- orders & report review */

export function listOrdersForUser(uid: string): StoredOrder[] {
  return store.orders.filter((o) => o.ownerUid === uid)
}

export function getOrderByNumber(orderNumber: string): StoredOrder | null {
  return store.orders.find((o) => o.orderNumber === orderNumber.trim()) ?? null
}

export function getOrder(id: string): StoredOrder | null {
  return store.orders.find((o) => o.id === id) ?? null
}

export function listSubmissionsForOrder(orderId: string): StoredSubmission[] {
  return store.submissions
    .filter((s) => s.orderId === orderId)
    .sort((a, b) => b.version - a.version)
}

export function listSubmissionsForUser(uid: string): StoredSubmission[] {
  return store.submissions
    .filter((s) => s.submittedByUid === uid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getSubmission(id: string): StoredSubmission | null {
  return store.submissions.find((s) => s.id === id) ?? null
}

/** The admin review queue: everything awaiting a decision, oldest first. */
export function listReviewQueue(): StoredSubmission[] {
  return store.submissions
    .filter((s) => s.status === 'uploaded' || s.status === 'under_review')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function listAllSubmissions(): StoredSubmission[] {
  return [...store.submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Record a new submission. A prior open submission for the same order is marked
 * `superseded` and the new one carries the next version — the history survives.
 */
export function addSubmission(input: {
  orderId: string
  submittedByUid: string
  fileType: ReportFileType
  fileName: string
  fileSize: number
  note: string
  storagePath?: string
  checksum?: string | null
}): StoredSubmission {
  const prior = store.submissions.filter((s) => s.orderId === input.orderId)
  for (const p of prior) {
    if (p.status === 'uploaded' || p.status === 'under_review' || p.status === 'revision_requested') {
      p.status = 'superseded'
    }
  }
  const version = prior.reduce((max, p) => Math.max(max, p.version), 0) + 1
  const submission: StoredSubmission = {
    id: `sub-${Date.now()}`,
    orderId: input.orderId,
    submittedByUid: input.submittedByUid,
    fileType: input.fileType,
    fileName: input.fileName,
    fileSize: input.fileSize,
    storagePath: input.storagePath ?? '',
    checksum: input.checksum ?? null,
    version,
    status: 'uploaded',
    note: input.note,
    reviewComment: null,
    createdAt: new Date().toISOString().slice(0, 10),
  }
  store.submissions.unshift(submission)
  return submission
}

export function setSubmissionDecision(
  id: string,
  status: SubmissionStatus,
  comment: string | null,
): StoredSubmission | null {
  const submission = store.submissions.find((s) => s.id === id)
  if (!submission) return null
  submission.status = status
  submission.reviewComment = comment
  return submission
}

export function addApproval(input: {
  submissionId: string
  orderId: string
  approvalNumber: string
  verificationCode: string
  approvedByUid: string
  dlsReference?: string | null
  basin?: string | null
  plot?: string | null
  surveyMethod?: string | null
  notes?: string | null
}): StoredApproval {
  const approval: StoredApproval = {
    ...input,
    status: 'valid',
    issuedAt: new Date().toISOString().slice(0, 10),
    dlsReference: input.dlsReference ?? null,
    basin: input.basin ?? null,
    plot: input.plot ?? null,
    surveyMethod: input.surveyMethod ?? null,
    notes: input.notes ?? null,
  }
  store.approvals.unshift(approval)
  return approval
}

export function getApprovalForSubmission(submissionId: string): StoredApproval | null {
  return store.approvals.find((a) => a.submissionId === submissionId) ?? null
}

/** Public verification reads by code only. Returns null for an unknown code. */
export function getApprovalByCode(code: string): StoredApproval | null {
  return store.approvals.find((a) => a.verificationCode === code) ?? null
}

export function nextApprovalNumber(): string {
  const year = new Date().getFullYear()
  const seq = store.approvals.length + 92
  return `APR-${year}-${String(seq).padStart(6, '0')}`
}
