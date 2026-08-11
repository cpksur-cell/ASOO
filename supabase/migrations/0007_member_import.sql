-- ============================================================================
-- ASOO Portal — 0007 · allow members without a DLS licence number yet
-- ============================================================================
-- The syndicate's own roster identifies members by NAME and by the syndicate's
-- membership number. The licence number is issued by the Department of Lands
-- and Survey, and for an existing member it is not necessarily to hand at the
-- moment the roster is loaded.
--
-- Modelling it as NOT NULL forced a choice between inventing an identifier —
-- which could later be mistaken for a genuine DLS licence — and not recording
-- the member at all. Both are worse than an honestly empty column, so the
-- column becomes nullable.
--
-- The UNIQUE constraint stays: Postgres does not treat NULLs as equal, so any
-- number of members may have no licence recorded while every licence number
-- that IS recorded remains unique.
-- ============================================================================

alter table members alter column license_number drop not null;

-- Provenance. When a record came from a bulk roster rather than an individual
-- application, the audit trail should say so — a membership officer looking at
-- an incomplete profile needs to know why it is incomplete.
alter table members add column if not exists import_source text;
alter table members add column if not exists imported_at timestamptz;

comment on column members.license_number is
  'DLS-issued licence number. NULL until the real number is recorded — never invent one.';
comment on column members.import_source is
  'Provenance for bulk-loaded rows, e.g. the roster file name. NULL for records created in-app.';

-- The directory lists by governorate and status; the roster import lands a few
-- hundred rows at once, so make sure that path is indexed.
create index if not exists members_directory_idx
  on members (is_directory_visible, status);
