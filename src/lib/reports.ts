import type { ReportFileType, SubmissionStatus } from '@/lib/data/store'
import type { StatusTone } from '@/components/ui/primitives'

/**
 * Report formats, by extension.
 *
 * CLIENT-SAFE ON PURPOSE. The uploader runs in the browser and needs these to
 * give immediate feedback, so they cannot live in the `server-only` validator.
 * That module imports these and adds what only the server can do: inspecting
 * the actual bytes.
 *
 * An extension is a claim, never proof — `reports-validate.ts` is the boundary.
 */
export const ACCEPTED_EXTENSIONS: Record<ReportFileType, string[]> = {
  pdf: ['.pdf'],
  // The drawing interchange format, and the OGC geography markup a cadastral
  // parcel is exchanged in — what the Department of Lands and Survey deals in.
  dxf: ['.dxf'],
  gml: ['.gml', '.xml'],
  // Retained so existing submissions still resolve; not offered for new ones.
  docx: ['.docx', '.doc'],
  dwg: ['.dwg'],
}

/** Formats accepted for NEW uploads. */
export const NEW_UPLOAD_TYPES: ReportFileType[] = ['pdf', 'dxf', 'gml']

/** What the file input advertises. */
export const ACCEPT_ATTRIBUTE = '.pdf,.dxf,.gml,.xml'

export const MAX_REPORT_BYTES = 25 * 1024 * 1024 // 25 MB

/** Infer the report file type from a filename, or null if unsupported. */
export function fileTypeFromName(name: string): ReportFileType | null {
  const lower = name.toLowerCase()
  for (const [type, exts] of Object.entries(ACCEPTED_EXTENSIONS)) {
    if (exts.some((e) => lower.endsWith(e))) return type as ReportFileType
  }
  return null
}

export const SUBMISSION_TONE: Record<SubmissionStatus, StatusTone> = {
  uploaded: 'pending',
  under_review: 'pending',
  revision_requested: 'warning',
  approved: 'active',
  rejected: 'overdue',
  superseded: 'neutral',
}

export const SUBMISSION_LABEL_KEY: Record<SubmissionStatus, string> = {
  uploaded: 'reports.subUploaded',
  under_review: 'reports.subUnderReview',
  revision_requested: 'reports.subRevision',
  approved: 'reports.subApproved',
  rejected: 'reports.subRejected',
  superseded: 'reports.subSuperseded',
}

/**
 * A verification code for a report approval.
 *
 * Random and NOT derived from any sequential id — a sequential code would let
 * anyone enumerate every approval. docs/08-security.md §8. Grouped for legibility
 * when a human reads it off a printed certificate: ASOO-RPT-XXXX-XXXX-XXXX.
 */
export function generateVerificationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I
  const rand = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `ASOO-RPT-${rand(4)}-${rand(4)}-${rand(4)}`
}

