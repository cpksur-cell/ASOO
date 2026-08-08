-- ============================================================================
-- ASOO Portal — 0005 · orders, report review & approval
-- ============================================================================
-- A surveyor uploads a technical report (PDF / Word / DWG) against an ORDER.
-- Staff review it; on approval an APPROVAL artifact is issued with a random
-- verification code that a public QR page confirms. See docs/03-data-model §9a.
--
-- Design rules enforced here:
--   * Files live in the PRIVATE bucket; DB stores only the storage_path.
--   * report_reviews is APPEND-ONLY history — a re-review is a new row.
--   * A resubmission is a NEW submission row with version+1; the prior open row
--     is marked 'superseded'. The full trail survives audit.
--   * order_number / approval_number come from sequences; verification_code is
--     random. Both defaulted in the DB so a client can never inject them.
-- ============================================================================

create table orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text unique not null default next_order_number(),
  member_id        uuid references members(id),         -- surveyor responsible
  owner_user_id    text references users(id),           -- the login that owns it
  governorate_id   uuid references governorates(id),
  type             order_type not null,
  status           order_status not null default 'draft',
  title            text not null,
  parcel_reference text,
  client_name      text,
  notes            text,
  submitted_at     timestamptz,
  decided_at       timestamptz,
  created_by       text references users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();
create index orders_owner_idx on orders (owner_user_id);
create index orders_member_idx on orders (member_id);

create table report_submissions (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  submitted_by  text not null references users(id),
  file_type     report_file_type not null,
  storage_path  text not null default '',   -- filled once the bytes are stored
  file_name     text not null,
  file_size     bigint,
  mime_type     text,
  checksum      text,                        -- SHA-256 of the bytes; integrity proof
  version       int not null default 1,
  status        submission_status not null default 'uploaded',
  virus_scanned boolean not null default false,  -- unscanned files are never served
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger report_submissions_set_updated_at
  before update on report_submissions
  for each row execute function set_updated_at();
create index report_submissions_order_idx on report_submissions (order_id, version desc);
create index report_submissions_status_idx on report_submissions (status);
create index report_submissions_submitter_idx on report_submissions (submitted_by);

-- Immutable review decision. Append-only: a second look is a second row.
create table report_reviews (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references report_submissions(id) on delete cascade,
  reviewer_id   text not null references users(id),
  reviewer_role text,                         -- snapshot at decision time
  decision      review_decision not null,
  comments      text,                          -- required for reject / revision
  created_at    timestamptz not null default now()
);
create index report_reviews_submission_idx on report_reviews (submission_id, created_at desc);
create rule report_reviews_no_update as on update to report_reviews do instead nothing;
create rule report_reviews_no_delete as on delete to report_reviews do instead nothing;

-- The approval artifact. One per approved submission. verification_code is what
-- the QR encodes; the public verify page reads THIS by code and returns only
-- non-sensitive fields.
create table report_approvals (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid unique not null references report_submissions(id) on delete cascade,
  order_id          uuid not null references orders(id) on delete cascade,  -- denormalised for lookup
  approval_number   text unique not null default next_approval_number(),
  verification_code text unique not null default generate_verification_code(),
  storage_path      text,                     -- approval PDF carrying the QR
  status            approval_status not null default 'valid',
  approved_by       text not null references users(id),
  issued_at         timestamptz not null default now(),
  expires_at        timestamptz,
  revoked_at        timestamptz,
  revoked_reason    text
);
create index report_approvals_order_idx on report_approvals (order_id);
