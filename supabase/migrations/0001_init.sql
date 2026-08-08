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
