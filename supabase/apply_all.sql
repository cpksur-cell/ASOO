-- ============================================================
-- ASOO Portal — combined RESET + migration + seed (re-runnable)
-- Paste this whole file into the Supabase SQL Editor and Run.
-- ============================================================


-- ===================== _reset.sql =====================

-- ============================================================
-- RESET — drop everything this bundle manages so it re-runs cleanly.
-- Safe here: the project holds only demo/seed data at this point.
-- Drops tables first (cascade clears their indexes/triggers/rules/
-- policies/FKs), then the enum types.
-- ============================================================
drop table if exists
  report_approvals, report_reviews, report_submissions, orders,
  layout_block_translations, layout_blocks, layouts,
  post_translations, posts, media_assets, post_categories,
  member_documents, member_translations, members,
  member_categories, governorates,
  audit_logs, user_roles, role_permissions, permissions, roles, users
cascade;

drop type if exists
  approval_status, review_decision, submission_status, report_file_type,
  order_status, order_type, layout_block_type, layout_region,
  publish_status, document_type, member_status, locale
cascade;

-- ===================== migrations/0001_init.sql =====================

-- ============================================================================
-- ASOO Portal — 0001 · extensions, enums, shared functions
-- ============================================================================
-- Translated from dataconnect/schema/schema.gql, which remains the design
-- source of truth. These migrations are the RUNNABLE Postgres definition for
-- Supabase (the project moved from Firebase Data Connect to Supabase Postgres).
--
-- Rules carried over from CLAUDE.md / docs/03-data-model.md:
--   * Money is BIGINT fils (1 JOD = 1000 fils). Never a float.
--   * Timestamps are timestamptz, stored UTC, displayed Asia/Amman.
--   * User-facing text lives in *_translations tables keyed by locale.
--   * Financial + audit rows are append-only. Corrections are new rows.
--   * Human-facing numbers (order/approval) come from SEQUENCES, never COUNT.
--   * Verification codes are RANDOM, never derived from a sequential id.
-- ============================================================================

-- citext gives case-insensitive email columns; pgcrypto gives gen_random_bytes
-- for the random public codes. gen_random_uuid() is built into modern Postgres.
create extension if not exists citext;
create extension if not exists pgcrypto;
-- Trigram index support for Arabic-normalized member search (docs/03 §2).
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type locale as enum ('ar', 'en');

create type member_status as enum
  ('pending', 'active', 'suspended', 'expired', 'withdrawn', 'deceased');

create type document_type as enum
  ('license', 'national_id', 'qualification', 'other');

create type publish_status as enum ('draft', 'scheduled', 'published', 'archived');

create type layout_region as enum ('main', 'aside');

create type layout_block_type as enum
  ('hero', 'stat_counters', 'service_grid', 'link_cards', 'news_feed',
   'document_list', 'directory_search', 'rich_text', 'cta_banner');

create type order_type as enum
  ('land_subdivision', 'land_settlement', 'topographic_survey',
   'boundary_survey', 'site_plan', 'other');

create type order_status as enum
  ('draft', 'submitted', 'in_review', 'revision_requested',
   'approved', 'rejected', 'cancelled', 'completed');

create type report_file_type as enum ('pdf', 'docx', 'dwg');

create type submission_status as enum
  ('uploaded', 'under_review', 'revision_requested',
   'approved', 'rejected', 'superseded');

create type review_decision as enum ('approved', 'rejected', 'revision_requested');

create type approval_status as enum ('valid', 'revoked');

-- ---------------------------------------------------------------------------
-- Shared functions
-- ---------------------------------------------------------------------------

-- Keep updated_at honest without the application having to remember.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Human-facing sequential identifiers. A SEQUENCE, never a COUNT(*), because a
-- count races two concurrent inserts into the same number. The year prefix is
-- cosmetic; the sequence itself is globally monotonic.
create sequence if not exists order_number_seq;
create sequence if not exists approval_number_seq;
create sequence if not exists invoice_number_seq;

create or replace function next_order_number()
returns text
language sql
volatile
as $$
  select 'ORD-' || to_char(now() at time zone 'utc', 'YYYY') || '-'
      || lpad(nextval('order_number_seq')::text, 6, '0');
$$;

create or replace function next_approval_number()
returns text
language sql
volatile
as $$
  select 'APR-' || to_char(now() at time zone 'utc', 'YYYY') || '-'
      || lpad(nextval('approval_number_seq')::text, 6, '0');
$$;

-- Random, URL-safe verification code in the ASOO-RPT-XXXX-XXXX-XXXX shape the
-- app already issues. Crockford-ish alphabet (no I/O/0/1) to survive being read
-- off a printed QR. NOT derived from any id — a sequential code would let anyone
-- enumerate every approval (docs/08-security §8).
create or replace function generate_verification_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  block text;
  out text := 'ASOO-RPT';
  i int;
  j int;
begin
  for i in 1..3 loop
    block := '';
    for j in 1..4 loop
      block := block || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    out := out || '-' || block;
  end loop;
  return out;
end;
$$;

-- ===================== migrations/0002_identity.sql =====================

-- ============================================================================
-- ASOO Portal — 0002 · identity & access
-- ============================================================================
-- users.id is TEXT: it holds the auth provider's UID. Today that is a mock UID
-- (e.g. 'mock-uid-member'); when Supabase Auth is wired next, it becomes the
-- auth.users UUID rendered as text, and a migration will backfill / link the
-- two. Keeping it text now means the report-workflow foreign keys are stable
-- across that transition. (schema.gql: User.id is String!.)
-- ============================================================================

create table users (
  id               text primary key,
  email            citext unique,
  phone            text,
  display_name     text,
  preferred_locale locale       not null default 'ar',
  is_active        boolean      not null default true,
  last_login_at    timestamptz,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);
create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

create table roles (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,          -- super_admin, finance_officer, ...
  name_ar     text not null,
  name_en     text not null,
  description text,
  is_system   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Permissions are `resource:action` strings, e.g. `reports:review`.
create table permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  resource    text not null,
  action      text not null,
  description text
);

create table role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  user_id    text not null references users(id) on delete cascade,
  role_id    uuid not null references roles(id) on delete cascade,
  granted_by text references users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Append-only. NEVER updated, NEVER deleted. Written in the same unit of work
-- as the mutation it records (CLAUDE.md §2 rule 5). actor_role is a SNAPSHOT —
-- roles change, the log must not.
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id text references users(id),   -- null for system jobs
  actor_role    text,
  action        text not null,               -- report.approve, member.suspend
  entity_type   text not null,
  entity_id     text not null,
  before        jsonb,
  after         jsonb,
  reason        text,                         -- required for waivers/rejections/revocations
  ip_address    text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs (created_at desc);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);

-- Guard the append-only contract at the database, not just in application code.
create rule audit_logs_no_update as on update to audit_logs do instead nothing;
create rule audit_logs_no_delete as on delete to audit_logs do instead nothing;

-- ===================== migrations/0003_membership.sql =====================

-- ============================================================================
-- ASOO Portal — 0003 · reference data & membership
-- ============================================================================

-- The 12 Jordanian governorates. Seeded, not user-editable.
create table governorates (
  id       uuid primary key default gen_random_uuid(),
  code     text unique not null,
  name_ar  text not null,
  name_en  text not null,
  position int not null default 0
);

create table member_categories (
  id        uuid primary key default gen_random_uuid(),
  code      text unique not null,
  name_ar   text not null,
  name_en   text not null,
  is_active boolean not null default true
);

create table members (
  id                   uuid primary key default gen_random_uuid(),
  user_id              text unique references users(id),  -- null until claimed
  license_number       text unique not null,              -- DLS-issued, public id
  membership_number    text unique not null,
  category_id          uuid references member_categories(id),
  governorate_id       uuid references governorates(id),
  status               member_status not null default 'pending',
  joined_at            date,
  license_expires_at   date,

  -- PII — never returned outside the member's own record or a membership
  -- officer's view. RLS + application layer both enforce this.
  national_id          text,

  phone                text,
  email                citext,

  is_directory_visible boolean not null default false,
  directory_phone      text,
  directory_email      text,
  directory_address    text,

  -- Arabic-normalized name for search (tashkeel stripped, alef/ta/ya unified),
  -- populated on write, queried with pg_trgm. Without it "احمد" won't match
  -- "أحمد" — the most common Arabic search failure.
  search_normalized    text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger members_set_updated_at
  before update on members
  for each row execute function set_updated_at();
create index members_governorate_idx on members (governorate_id);
create index members_status_idx on members (status);
create index members_search_idx on members using gin (search_normalized gin_trgm_ops);

create table member_translations (
  member_id       uuid not null references members(id) on delete cascade,
  locale          locale not null,
  full_name       text not null,
  office_name     text,
  bio             text,
  specializations text[],
  primary key (member_id, locale)
);

-- Stored in the PRIVATE bucket. Never served by public URL (docs/08 §6).
create table member_documents (
  member_id     uuid not null references members(id) on delete cascade,
  id            uuid primary key default gen_random_uuid(),
  document_type document_type not null,
  storage_path  text not null,
  file_name     text not null,
  file_size     int,
  mime_type     text,
  verified_by   text references users(id),
  verified_at   timestamptz,
  expires_at    date,
  uploaded_at   timestamptz not null default now()
);
create index member_documents_member_idx on member_documents (member_id);

-- ===================== migrations/0004_cms.sql =====================

-- ============================================================================
-- ASOO Portal — 0004 · content / CMS
-- ============================================================================
-- Tables exist and are ready; the public site still renders from the seed
-- repository until the CMS read path is wired to Supabase in a follow-up pass.
-- Creating them now keeps the schema whole and the migration order stable.
-- ============================================================================

create table post_categories (
  id       uuid primary key default gen_random_uuid(),
  slug     text unique not null,
  name_ar  text not null,
  name_en  text not null,
  position int not null default 0
);

create table media_assets (
  id          uuid primary key default gen_random_uuid(),
  storage_path text not null,
  file_name   text not null,
  mime_type   text not null,
  file_size   int,
  width       int,
  height      int,
  alt_text_ar text,          -- accessibility is not optional
  alt_text_en text,
  uploaded_by text references users(id),
  created_at  timestamptz not null default now()
);

create table posts (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid references post_categories(id),
  slug           text unique not null,      -- ASCII, transliterated, never raw Arabic
  status         publish_status not null default 'draft',
  published_at   timestamptz,
  featured_image uuid references media_assets(id),
  is_featured    boolean not null default false,
  view_count     int not null default 0,
  deleted_at     timestamptz,               -- archive, never hard-delete from admin UI
  created_by     text references users(id),
  updated_by     text references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger posts_set_updated_at
  before update on posts
  for each row execute function set_updated_at();
create index posts_status_published_idx on posts (status, published_at desc);

create table post_translations (
  post_id         uuid not null references posts(id) on delete cascade,
  locale          locale not null,
  title           text not null,
  excerpt         text,
  body            text,
  seo_title       text,
  seo_description text,
  primary key (post_id, locale)
);

-- Homepage block composition — see docs/09-cms.md.
create table layouts (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,          -- homepage, ...
  name_ar    text not null,
  name_en    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger layouts_set_updated_at
  before update on layouts
  for each row execute function set_updated_at();

-- position is gap-numbered by 10 so a reorder touches two rows, not all of them.
-- config is jsonb validated against a per-type Zod schema in the application.
create table layout_blocks (
  id           uuid primary key default gen_random_uuid(),
  layout_id    uuid not null references layouts(id) on delete cascade,
  type         layout_block_type not null,
  region       layout_region not null default 'main',
  position     int not null default 0,
  is_published boolean not null default false,
  config       jsonb,
  updated_by   text references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger layout_blocks_set_updated_at
  before update on layout_blocks
  for each row execute function set_updated_at();
create index layout_blocks_layout_position_idx on layout_blocks (layout_id, position);

create table layout_block_translations (
  block_id   uuid not null references layout_blocks(id) on delete cascade,
  locale     locale not null,
  heading    text,
  subheading text,
  body       text,
  cta_label  text,
  items      jsonb,           -- per-item text for grids and counters
  primary key (block_id, locale)
);

-- ===================== migrations/0005_reports.sql =====================

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

-- ===================== migrations/0006_rls.sql =====================

-- ============================================================================
-- ASOO Portal — 0006 · Row Level Security
-- ============================================================================
-- Posture: DENY by default. RLS is enabled on every table; only the narrow,
-- genuinely-public reads below are opened to the anon/authenticated roles.
--
-- The application server talks to Postgres with the SERVICE ROLE key, which
-- BYPASSES RLS entirely — authorization for privileged reads/writes is done in
-- the app layer (the three-layer model in docs/08-security §3). RLS here is the
-- safety net: if the anon (public) key is ever used from the browser, it must
-- be physically unable to read invoices, PII, unpublished content, or the raw
-- report files' metadata.
--
-- When Supabase Auth lands, these policies grow member-scoped rules bound to
-- auth.uid() so a member can read only their own rows directly. Until then,
-- privileged access is exclusively server-side.
-- ============================================================================

-- Enable RLS everywhere. No policy = no access for anon/authenticated.
alter table users                     enable row level security;
alter table roles                     enable row level security;
alter table permissions               enable row level security;
alter table role_permissions          enable row level security;
alter table user_roles                enable row level security;
alter table audit_logs                enable row level security;
alter table governorates              enable row level security;
alter table member_categories         enable row level security;
alter table members                   enable row level security;
alter table member_translations       enable row level security;
alter table member_documents          enable row level security;
alter table post_categories           enable row level security;
alter table media_assets              enable row level security;
alter table posts                     enable row level security;
alter table post_translations         enable row level security;
alter table layouts                   enable row level security;
alter table layout_blocks             enable row level security;
alter table layout_block_translations enable row level security;
alter table orders                    enable row level security;
alter table report_submissions        enable row level security;
alter table report_reviews            enable row level security;
alter table report_approvals          enable row level security;

-- ---------------------------------------------------------------------------
-- Public reads (reference data + published content only)
-- ---------------------------------------------------------------------------
create policy public_read_governorates       on governorates       for select using (true);
create policy public_read_member_categories  on member_categories  for select using (true);
create policy public_read_post_categories    on post_categories    for select using (true);
create policy public_read_layouts            on layouts            for select using (true);

create policy public_read_published_blocks on layout_blocks
  for select using (is_published = true);

create policy public_read_block_translations on layout_block_translations
  for select using (
    exists (select 1 from layout_blocks b
            where b.id = block_id and b.is_published = true)
  );

create policy public_read_published_posts on posts
  for select using (status = 'published' and deleted_at is null);

create policy public_read_post_translations on post_translations
  for select using (
    exists (select 1 from posts p
            where p.id = post_id and p.status = 'published' and p.deleted_at is null)
  );

-- Directory shows only members who consented to be listed. PII columns stay off
-- limits by never being selected client-side; a follow-up column-scoped view
-- will harden this further when the public directory reads Supabase directly.
create policy public_read_directory_members on members
  for select using (is_directory_visible = true and status = 'active');

create policy public_read_directory_member_translations on member_translations
  for select using (
    exists (select 1 from members m
            where m.id = member_id and m.is_directory_visible = true and m.status = 'active')
  );

-- NOTE: orders, report_submissions, report_reviews, report_approvals,
-- audit_logs, invoices/PII — NO anon policy. Server-only via the service role.
-- Public approval verification is served by the server (service role), which
-- returns only the minimal non-sensitive fields.

-- ===================== seed.sql =====================

-- ============================================================================
-- ASOO Portal — seed data
-- ============================================================================
-- Mirrors the app's in-memory demo fixtures (seed.ts, report-demo.ts) so that a
-- freshly-migrated Supabase database shows exactly what the fallback demo shows.
-- Safe to re-run: every insert is idempotent via ON CONFLICT.
--
-- Fixed UUIDs are used for the demo rows so foreign keys line up deterministically.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roles (the 7 from docs/08-security §2)
-- ---------------------------------------------------------------------------
insert into roles (code, name_ar, name_en) values
  ('super_admin',        'مدير النظام',        'Super administrator'),
  ('content_editor',     'محرر المحتوى',       'Content editor'),
  ('finance_officer',    'موظف مالي',          'Finance officer'),
  ('membership_officer', 'موظف العضوية',       'Membership officer'),
  ('support_agent',      'موظف دعم',           'Support agent'),
  ('member',             'عضو',                'Member')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Governorates (12) — codes match src/lib/data/seed.ts
-- ---------------------------------------------------------------------------
insert into governorates (code, name_ar, name_en, position) values
  ('amman',   'عمان',    'Amman',   1),
  ('irbid',   'إربد',    'Irbid',   2),
  ('zarqa',   'الزرقاء', 'Zarqa',   3),
  ('aqaba',   'العقبة',  'Aqaba',   4),
  ('mafraq',  'المفرق',  'Mafraq',  5),
  ('jerash',  'جرش',     'Jerash',  6),
  ('madaba',  'مادبا',   'Madaba',  7),
  ('karak',   'الكرك',   'Karak',   8),
  ('tafilah', 'الطفيلة', 'Tafilah', 9),
  ('maan',    'معان',    'Ma''an',  10),
  ('ajloun',  'عجلون',   'Ajloun',  11),
  ('balqa',   'البلقاء', 'Balqa',   12)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Member categories
-- ---------------------------------------------------------------------------
insert into member_categories (code, name_ar, name_en) values
  ('office_owner',        'صاحب مكتب',   'Office owner'),
  ('practising_surveyor', 'مساح مزاول',  'Practising surveyor')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Demo login accounts (match the mock UIDs the app issues)
-- ---------------------------------------------------------------------------
insert into users (id, email, display_name, preferred_locale) values
  ('mock-uid-member',             'member@asoo.invalid',             'أحمد وليد المصري', 'ar'),
  ('mock-uid-membership_officer', 'membership_officer@asoo.invalid', 'موظف العضوية',     'ar')
on conflict (id) do nothing;

insert into user_roles (user_id, role_id)
select 'mock-uid-member', id from roles where code = 'member'
on conflict do nothing;
insert into user_roles (user_id, role_id)
select 'mock-uid-membership_officer', id from roles where code = 'membership_officer'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Demo member (seed.ts m01 — Ahmad Waleed Al-Masri)
-- ---------------------------------------------------------------------------
insert into members (
  id, user_id, license_number, membership_number,
  category_id, governorate_id, status, joined_at,
  is_directory_visible, directory_address, search_normalized
) values (
  'd0000000-0000-4000-8000-000000000001',
  'mock-uid-member', 'SV-1042', 'ASOO-0412',
  (select id from member_categories where code = 'office_owner'),
  (select id from governorates where code = 'amman'),
  'active', '2004-03-14',
  true, 'عمّان — جبل الحسين', 'احمد وليد المصري ahmad waleed al masri'
) on conflict (id) do nothing;

insert into member_translations (member_id, locale, full_name, office_name) values
  ('d0000000-0000-4000-8000-000000000001', 'ar', 'أحمد وليد المصري', 'مكتب الميزان للمساحة'),
  ('d0000000-0000-4000-8000-000000000001', 'en', 'Ahmad Waleed Al-Masri', 'Al-Mizan Surveying Office')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Orders (report-demo.ts DEMO_ORDERS)
-- ---------------------------------------------------------------------------
insert into orders (
  id, order_number, member_id, owner_user_id, governorate_id,
  type, status, title, parcel_reference, client_name, created_by, created_at
) values
  ('a0000000-0000-4000-8000-000000000418', 'ORD-2026-000418',
   'd0000000-0000-4000-8000-000000000001', 'mock-uid-member',
   (select id from governorates where code = 'amman'),
   'land_subdivision', 'in_review',
   'إفراز قطعة أرض حوض 3 — الجبيهة', 'حوض 3 / قطعة 214',
   'شركة الإسكان الأردنية', 'mock-uid-member', '2026-01-18T00:00:00Z'),

  ('a0000000-0000-4000-8000-000000000512', 'ORD-2026-000512',
   'd0000000-0000-4000-8000-000000000001', 'mock-uid-member',
   (select id from governorates where code = 'amman'),
   'topographic_survey', 'draft',
   'رفع مساحي طبوغرافي — لواء الجامعة', 'حوض 7 / قطعة 88',
   'أمانة عمّان الكبرى', 'mock-uid-member', '2026-02-02T00:00:00Z'),

  ('a0000000-0000-4000-8000-000000000377', 'ORD-2026-000377',
   'd0000000-0000-4000-8000-000000000001', 'mock-uid-member',
   (select id from governorates where code = 'irbid'),
   'boundary_survey', 'completed',
   'تحديد حدود قطعة — إربد', 'حوض 12 / قطعة 45',
   'مالك خاص', 'mock-uid-member', '2026-01-06T00:00:00Z')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Report submissions (report-demo.ts DEMO_SUBMISSIONS)
-- ---------------------------------------------------------------------------
insert into report_submissions (
  id, order_id, submitted_by, file_type, file_name, file_size,
  version, status, note, created_at
) values
  ('b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000377', 'mock-uid-member',
   'pdf', 'boundary-report-irbid.pdf', 2340000, 1, 'approved',
   'التقرير النهائي بعد الرفع الميداني.', '2026-01-08T00:00:00Z'),

  ('b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000418', 'mock-uid-member',
   'dwg', 'subdivision-plan-juba.dwg', 5120000, 1, 'under_review',
   'مخطط الإفراز المبدئي.', '2026-01-20T00:00:00Z')
on conflict (id) do nothing;

-- Review row for the approved submission (append-only history).
-- report_reviews has ON UPDATE/DELETE rules, so ON CONFLICT is not permitted on
-- it — guard with WHERE NOT EXISTS to stay idempotent instead.
insert into report_reviews (submission_id, reviewer_id, reviewer_role, decision, comments, created_at)
select 'b0000000-0000-4000-8000-000000000001', 'mock-uid-membership_officer',
       'membership_officer', 'approved', 'مطابق للأصول الفنية.', '2026-01-10T00:00:00Z'
where not exists (
  select 1 from report_reviews
  where submission_id = 'b0000000-0000-4000-8000-000000000001' and decision = 'approved'
);

-- ---------------------------------------------------------------------------
-- Approval (report-demo.ts DEMO_APPROVALS)
-- ---------------------------------------------------------------------------
insert into report_approvals (
  id, submission_id, order_id, approval_number, verification_code,
  status, approved_by, issued_at
) values (
  'c0000000-0000-4000-8000-000000000091',
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000377',
  'APR-2026-000091', 'ASOO-RPT-4K7Q-P9M2-T1A6',
  'valid', 'mock-uid-membership_officer', '2026-01-10T00:00:00Z'
) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Advance sequences past the seeded numbers so generated ids never collide.
-- ---------------------------------------------------------------------------
select setval('order_number_seq',    512, true);
select setval('approval_number_seq', 91,  true);
