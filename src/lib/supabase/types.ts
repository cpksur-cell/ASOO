/**
 * Row shapes for the tables the application currently reads from Supabase.
 *
 * These are hand-written and cover ONLY the wired report-workflow + audit
 * tables. Once the Supabase CLI is connected to a project, the full typed
 * schema can be generated with:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 *
 * and these can be replaced by imports from it. Kept minimal on purpose so the
 * types cannot silently drift from what the queries actually use.
 */

export interface OrderRow {
  id: string
  order_number: string
  member_id: string | null
  owner_user_id: string | null
  governorate_id: string | null
  type: string
  status: string
  title: string
  parcel_reference: string | null
  client_name: string | null
  created_at: string
}

export interface SubmissionRow {
  id: string
  order_id: string
  submitted_by: string
  file_type: 'pdf' | 'docx' | 'dwg'
  storage_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  checksum: string | null
  version: number
  status:
    | 'uploaded'
    | 'under_review'
    | 'revision_requested'
    | 'approved'
    | 'rejected'
    | 'superseded'
  note: string | null
  created_at: string
}

export interface ReviewRow {
  id: string
  submission_id: string
  reviewer_id: string
  reviewer_role: string | null
  decision: 'approved' | 'rejected' | 'revision_requested'
  comments: string | null
  created_at: string
}

export interface ApprovalRow {
  id: string
  submission_id: string
  order_id: string
  approval_number: string
  verification_code: string
  storage_path: string | null
  status: 'valid' | 'revoked'
  approved_by: string
  issued_at: string
}

export interface AuditLogInsert {
  actor_user_id: string | null
  actor_role: string | null
  action: string
  entity_type: string
  entity_id: string
  before: unknown
  after: unknown
  reason: string | null
  ip_address: string | null
  user_agent: string | null
}
