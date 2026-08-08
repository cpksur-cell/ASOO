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
