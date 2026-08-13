-- ============================================================================
-- ASOO Portal — 0011 · counter e-services (electronic plate / change statement)
-- ============================================================================
-- Two counter services the syndicate performs on behalf of a member against the
-- Department of Lands and Survey:
--
--   electronic_plate  · طلب لوحة إلكترونية        — the electronic plan sheet
--   change_statement  · طلب بيان تغيّر غير مؤرشف  — an unarchived change statement
--
-- The member supplies ONE thing: the DLS key (رقم المفتاح). Everything else is
-- produced by staff, so the request row is deliberately thin on the way in and
-- grows a response on the way out.
--
-- Design rules carried from the report workflow:
--   * request_number comes from a SEQUENCE, never a COUNT — a count races.
--   * service_request_events is APPEND-ONLY history: a second look is a second
--     row. Who answered, when, and what they said survives audit.
--   * RLS on, no anon/authenticated policy. A DLS key is a pointer into a
--     citizen's land record; it is server-only, like the report tables.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_request_type') then
    create type service_request_type as enum ('electronic_plate', 'change_statement');
  end if;
  if not exists (select 1 from pg_type where typname = 'service_request_status') then
    -- submitted  → sitting in the staff queue
    -- in_progress→ a member of staff has taken it to the department
    -- fulfilled  → the data was returned to the requester
    -- rejected   → cannot be served (bad key, not found, not entitled)
    create type service_request_status as enum
      ('submitted', 'in_progress', 'fulfilled', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'service_request_action') then
    create type service_request_action as enum
      ('created', 'taken', 'fulfilled', 'rejected', 'note');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Human-facing number
-- ---------------------------------------------------------------------------
create sequence if not exists service_request_number_seq;

create or replace function next_service_request_number()
returns text
language sql
volatile
as $$
  select 'SR-' || to_char(now() at time zone 'utc', 'YYYY') || '-'
      || lpad(nextval('service_request_number_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------------
-- 3. The request
-- ---------------------------------------------------------------------------
create table if not exists service_requests (
  id               uuid primary key default gen_random_uuid(),
  request_number   text unique not null default next_service_request_number(),
  type             service_request_type not null,
  status           service_request_status not null default 'submitted',

  -- The ONLY field the requester supplies. Stored exactly as the application
  -- normalized it (Western digits, upper case, no spaces) so two people typing
  -- the same key in different scripts land on the same string.
  dls_key          text not null,
  note             text,

  -- No FK on purpose. 0009 removed the equivalent FK from audit_logs after it
  -- silently rejected writes for identities that had no `users` row yet; a
  -- request must record who asked even if the mirror row is late.
  requester_user_id text not null,
  requester_name    text,
  requester_email   text,

  -- What staff hand back. Free-form because the department's answer differs by
  -- service and by parcel — structuring it now would be guessing.
  response_data    text,
  response_note    text,
  responded_by     text,
  responded_at     timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists service_requests_set_updated_at on service_requests;
create trigger service_requests_set_updated_at
  before update on service_requests
  for each row execute function set_updated_at();

create index if not exists service_requests_requester_idx
  on service_requests (requester_user_id, created_at desc);
create index if not exists service_requests_status_idx
  on service_requests (status, created_at);
create index if not exists service_requests_key_idx
  on service_requests (dls_key);

comment on column service_requests.dls_key is
  'Department of Lands and Survey key (رقم المفتاح) — normalized to Western digits, upper case, no separators stripped beyond whitespace.';

-- ---------------------------------------------------------------------------
-- 4. Append-only history
-- ---------------------------------------------------------------------------
create table if not exists service_request_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references service_requests(id) on delete cascade,
  actor_id    text not null,
  actor_role  text,                    -- snapshot at the time; roles change
  action      service_request_action not null,
  message     text,
  created_at  timestamptz not null default now()
);
create index if not exists service_request_events_request_idx
  on service_request_events (request_id, created_at desc);

drop rule if exists service_request_events_no_update on service_request_events;
drop rule if exists service_request_events_no_delete on service_request_events;
create rule service_request_events_no_update as
  on update to service_request_events do instead nothing;
create rule service_request_events_no_delete as
  on delete to service_request_events do instead nothing;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
-- Deny by default, exactly as 0006 does for the report tables: RLS on and NO
-- policy, so anon and authenticated cannot read or write these at all. Every
-- access goes through the server with the service role, after the application
-- has checked the caller's permission.
alter table service_requests       enable row level security;
alter table service_request_events enable row level security;
