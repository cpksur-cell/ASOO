-- ============================================================================
-- ASOO Portal — 0010 · report file types, approval details, private storage
-- ============================================================================
-- Three things a real report workflow needs and the scaffold did not have:
-- the file formats surveyors actually deliver, somewhere to keep the bytes,
-- and room to record WHAT was approved rather than only THAT it was.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The formats surveyors actually submit
-- ---------------------------------------------------------------------------
-- DXF is the interchange drawing format (the neutral cousin of DWG) and GML is
-- the OGC geography markup a cadastral parcel is exchanged in. Both are what
-- the Department of Lands and Survey deals in, so both must be first-class.
--
-- `docx` and `dwg` are deliberately KEPT: submissions already exist under them,
-- and an enum value that rows still reference cannot be removed without
-- rewriting history.
--
-- IF NOT EXISTS makes this safe to re-run.
alter type report_file_type add value if not exists 'dxf';
alter type report_file_type add value if not exists 'gml';

-- ---------------------------------------------------------------------------
-- 2. What the approval actually says
-- ---------------------------------------------------------------------------
-- A syndicate approval on a survey report is not a bare yes. It records the
-- land reference the work relates to, how the survey was performed, and how
-- long the approval stands. Those belong in columns — they are searched,
-- printed on the certificate, and shown on the public verification page.
alter table report_approvals
  add column if not exists dls_reference text,
  add column if not exists basin text,
  add column if not exists plot text,
  add column if not exists survey_method text,
  add column if not exists notes text;

comment on column report_approvals.dls_reference is
  'Department of Lands and Survey transaction/reference number the approval relates to.';
comment on column report_approvals.survey_method is
  'How the survey was performed — e.g. GPS-RTK, total station.';

-- The public verification page looks approvals up by code; make that an index
-- rather than a scan now that the table will grow.
create index if not exists report_approvals_code_idx
  on report_approvals (verification_code);

-- ---------------------------------------------------------------------------
-- 3. Private storage for the uploaded files
-- ---------------------------------------------------------------------------
-- PRIVATE (public = false). Survey reports carry client names, parcel
-- references and professional work product; they are served only through
-- short-lived signed URLs minted server-side after a permission check, never
-- from a public URL. docs/08-security.md §6.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  false,
  26214400, -- 25 MB, matching MAX_REPORT_BYTES in the application
  array[
    'application/pdf',
    'image/vnd.dxf', 'application/dxf', 'application/octet-stream',
    'application/gml+xml', 'application/xml', 'text/xml', 'text/plain'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage policies are created on purpose.
--
-- With RLS enabled and no policy, the anon and authenticated roles cannot
-- touch this bucket at all. Every read and write goes through the server using
-- the service role, which happens only after the application has checked the
-- caller's permission. That keeps one enforcement path instead of two that can
-- disagree, and means a leaked anon key grants nothing here.
