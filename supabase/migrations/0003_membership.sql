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
