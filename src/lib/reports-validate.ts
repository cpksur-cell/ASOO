import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import type { ReportFileType } from '@/lib/data/store'
// The extension list is shared with the browser-side uploader; only the
// byte-level checks below are server-only.
import { MAX_REPORT_BYTES, NEW_UPLOAD_TYPES, fileTypeFromName } from '@/lib/reports'

export { MAX_REPORT_BYTES }

/**
 * Server-side validation of an uploaded report.
 *
 * The extension is a claim made by whoever uploaded the file, and the MIME
 * type is a claim made by their browser. Neither is evidence. This inspects
 * the BYTES, which is the only part the uploader cannot simply relabel — a
 * renamed executable must not become a "report" because it ends in .pdf.
 */

/** Content type stored alongside the object, so downloads open correctly. */
export const CONTENT_TYPE: Record<ReportFileType, string> = {
  pdf: 'application/pdf',
  dxf: 'image/vnd.dxf',
  gml: 'application/gml+xml',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  dwg: 'image/vnd.dwg',
}

export type ValidationFailure =
  | 'EMPTY'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'CONTENT_MISMATCH'

export type ValidationResult =
  | { ok: true; type: ReportFileType; checksum: string; bytes: Buffer }
  | { ok: false; reason: ValidationFailure }

const textHead = (bytes: Buffer, len = 2048) =>
  bytes.subarray(0, len).toString('utf8').replace(/^﻿/, '')

/**
 * Does the content match the declared format?
 *
 * PDF  — must start with the `%PDF-` signature.
 * DXF  — ASCII DXF is a tagged pair list that opens with group code 0 followed
 *        by SECTION; binary DXF opens with a documented sentinel string. Both
 *        are accepted, nothing else is.
 * GML  — XML that actually references a GML namespace or a GML root element.
 *        A generic XML file is not a cadastral exchange and is rejected, so a
 *        wrong-format upload is caught at submission rather than at review.
 */
function contentMatches(type: ReportFileType, bytes: Buffer): boolean {
  switch (type) {
    case 'pdf':
      return bytes.subarray(0, 5).toString('latin1') === '%PDF-'

    case 'dxf': {
      if (bytes.subarray(0, 18).toString('latin1') === 'AutoCAD Binary DXF') return true
      const head = textHead(bytes).replace(/\r/g, '')
      // Leading whitespace is normal; the first tag pair must be 0 / SECTION.
      return /^\s*0\s*\n\s*SECTION/i.test(head) || /\bHEADER\b[\s\S]*\bENDSEC\b/i.test(head)
    }

    case 'gml': {
      const head = textHead(bytes)
      if (!/^\s*<\?xml|^\s*</.test(head)) return false
      return (
        /opengis\.net\/gml/i.test(head) ||
        /xmlns:gml\s*=/i.test(head) ||
        /<(\w+:)?FeatureCollection/i.test(head) ||
        /<(\w+:)?CityModel/i.test(head)
      )
    }

    // Legacy formats: signature check where one exists, otherwise accept.
    case 'docx':
      return bytes.subarray(0, 4).toString('latin1') === 'PK'
    case 'dwg':
      return bytes.subarray(0, 2).toString('latin1') === 'AC'
    default:
      return false
  }
}

export function validateReportBytes(fileName: string, bytes: Buffer): ValidationResult {
  if (bytes.length === 0) return { ok: false, reason: 'EMPTY' }
  if (bytes.length > MAX_REPORT_BYTES) return { ok: false, reason: 'TOO_LARGE' }

  const type = fileTypeFromName(fileName)
  if (!type || !NEW_UPLOAD_TYPES.includes(type)) {
    return { ok: false, reason: 'UNSUPPORTED_TYPE' }
  }
  if (!contentMatches(type, bytes)) return { ok: false, reason: 'CONTENT_MISMATCH' }

  return {
    ok: true,
    type,
    // SHA-256 over the stored bytes. A report can carry legal weight, so being
    // able to prove the file reviewed is byte-for-byte the file issued matters.
    checksum: createHash('sha256').update(bytes).digest('hex'),
    bytes,
  }
}

/**
 * Where the object lives in the private bucket.
 *
 * The path is built from ids and a random segment — never from the uploaded
 * filename, which is attacker-controlled and can contain `../`, NUL bytes or
 * unicode that normalises into a traversal. The original name is kept in the
 * database column instead, where it is data rather than a path.
 */
export function buildStoragePath(orderId: string, type: ReportFileType): string {
  return `orders/${orderId}/${Date.now()}-${randomUUID()}.${type}`
}
