-- ============================================================================
-- ASOO Portal — 0017 · roster file numbers, member accounts, report DLS keys
-- ============================================================================
-- Three changes the syndicate asked for, all additive.
--
-- 1. `members.file_number` — the syndicate's own file number (رقم ملف), which
--    is what the roster spreadsheet actually carries. It is NOT a DLS licence
--    number: in the supplied roster 51 values repeat, 21 are placeholders and
--    14 are blank. `license_number` is UNIQUE and reserved for numbers the
--    Department of Lands and Survey issues, so storing this there would both
--    fail the constraint and conflate two different identifiers.
--
-- 2. `users.must_change_password` — members are provisioned with a shared
--    initial password, so the system has to know who has not yet replaced it.
--    Held in the DATABASE rather than in a JWT claim or a cookie for the same
--    reason roles are: the client must not be able to say it has already
--    changed its password.
--
-- 3. `report_submissions.dls_key` — the land reference a report relates to.
--    DELIBERATELY NOT UNIQUE: one parcel legitimately produces many reports
--    over time (revisions, re-surveys, different orders), and the syndicate
--    asked for exactly that. The index is there to make "every report against
--    this key" a fast question, which is the question the counter asks.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Syndicate file number
-- ---------------------------------------------------------------------------
alter table members
  add column if not exists file_number text;

comment on column members.file_number is
  'Syndicate file number (رقم ملف) from the membership roster. Not unique and not a DLS licence number — see license_number for that.';

create index if not exists members_file_number_idx
  on members (file_number)
  where file_number is not null;

-- ---------------------------------------------------------------------------
-- 2. Forced password change
-- ---------------------------------------------------------------------------
alter table users
  add column if not exists must_change_password boolean not null default false;

comment on column users.must_change_password is
  'True while the account still holds the password it was provisioned with. The app refuses to serve anything but the change-password screen until it is cleared.';

-- ---------------------------------------------------------------------------
-- 3. DLS key on a report submission
-- ---------------------------------------------------------------------------
alter table report_submissions
  add column if not exists dls_key text;

comment on column report_submissions.dls_key is
  'Normalised DLS land key the report relates to. NOT unique: the same parcel may be the subject of many reports.';

create index if not exists report_submissions_dls_key_idx
  on report_submissions (dls_key)
  where dls_key is not null;
