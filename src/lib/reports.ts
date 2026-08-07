import type { ReportFileType, SubmissionStatus } from '@/lib/data/store'
import type { StatusTone } from '@/components/ui/primitives'

/**
 * Allowed report uploads. PDF and Word are documents; DWG is the AutoCAD
 * binary drawing surveyors produce. The extension list and MIME list are both
 * checked — a renamed `.exe` must not slip through on extension alone.
 */
export const ALLOWED_FILE_TYPES: Record<
  ReportFileType,
  { ext: string[]; mime: string[] }
> = {
  pdf: { ext: ['.pdf'], mime: ['application/pdf'] },
  docx: {
    ext: ['.docx', '.doc'],
    mime: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
  },
  // DWG has no single registered MIME; browsers often send octet-stream, so
  // the extension is authoritative here and the server re-checks magic bytes
  // in Phase 3.
  dwg: { ext: ['.dwg'], mime: ['application/acad', 'image/vnd.dwg', 'application/octet-stream', ''] },
}

export const MAX_REPORT_BYTES = 25 * 1024 * 1024 // 25 MB

/** Infer the report file type from a filename, or null if unsupported. */
export function fileTypeFromName(name: string): ReportFileType | null {
  const lower = name.toLowerCase()
  for (const [type, spec] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (spec.ext.some((e) => lower.endsWith(e))) return type as ReportFileType
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

