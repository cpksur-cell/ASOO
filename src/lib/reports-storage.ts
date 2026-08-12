import 'server-only'

import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServiceClient } from '@/lib/supabase/server'
import type { ReportFileType } from '@/lib/data/store'
import { CONTENT_TYPE } from '@/lib/reports-validate'

/**
 * The private bucket holding submitted report files.
 *
 * Everything here runs with the SERVICE role, and the bucket has no policy for
 * anon or authenticated, so there is exactly one way in: through the server,
 * after the application has checked the caller's permission. Files are never
 * served from a public URL — a survey report carries client names and parcel
 * references (docs/08-security.md §6).
 */

export const REPORTS_BUCKET = 'reports'

/** How long a download link stays valid. */
const SIGNED_URL_SECONDS = 120

export async function uploadReportFile(
  path: string,
  bytes: Buffer,
  type: ReportFileType,
): Promise<void> {
  const { error } = await getServiceClient()
    .storage.from(REPORTS_BUCKET)
    .upload(path, bytes, {
      contentType: CONTENT_TYPE[type],
      // Never overwrite. Every submission gets a fresh randomised path, so a
      // collision would mean something is wrong and should fail loudly rather
      // than silently replace a file that is already part of the record.
      upsert: false,
    })
  if (error) throw error
}

/**
 * A short-lived link to one stored report.
 *
 * Deliberately brief: the URL carries its own authorisation, so anyone holding
 * it can fetch the file until it expires. Two minutes is enough to start a
 * download and short enough that a link pasted into a chat is dead on arrival.
 *
 * The CALLER is responsible for having checked permission first — this
 * function is the mechanism, not the boundary.
 */
export async function createReportDownloadUrl(
  path: string,
  downloadName?: string,
): Promise<string | null> {
  if (!isSupabaseConfigured() || !path) return null

  const { data, error } = await getServiceClient()
    .storage.from(REPORTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, {
      // Presents the member's original filename rather than the random storage
      // key, so a reviewer saves something they can recognise.
      download: downloadName ?? true,
    })
  if (error) return null
  return data?.signedUrl ?? null
}

/** Removes a stored object. Used to roll back a failed submission. */
export async function deleteReportFile(path: string): Promise<void> {
  if (!isSupabaseConfigured() || !path) return
  await getServiceClient().storage.from(REPORTS_BUCKET).remove([path])
}
