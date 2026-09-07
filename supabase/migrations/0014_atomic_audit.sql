-- ============================================================================
-- ASOO Portal — 0014 · make the audit trail atomic
-- ============================================================================
-- CLAUDE.md §2 #5 requires that every admin mutation writes an audit row. Until
-- now the wrapper could not keep that promise: supabase-js issues each
-- statement over its own HTTP request, so `run()` had already COMMITTED by the
-- time the audit insert ran. A failure there left the change applied and
-- unrecorded — the exact outcome a government audit trail exists to prevent.
-- It was hit for real when a foreign key rejected an audit row (fixed in 0009)
-- after the member update had already gone through.
--
-- THE FIX RESTS ON ONE PROPERTY: PostgREST runs a single RPC call inside a
-- single transaction. So a function that performs the mutation AND writes the
-- audit row in its own body gets atomicity from Postgres itself, not from
-- application discipline. Either both land or neither does.
--
-- Rather than fifteen bespoke functions — one per mutation, each a place for
-- the audit insert to be forgotten — this is ONE function taking an ordered
-- list of operations. The wrapper cannot write to these tables any other way,
-- so "mutation without audit row" stops being expressible.
--
-- SAFETY OF THE DYNAMIC SQL
--
-- Building SQL from client input deserves suspicion, so nothing here is
-- interpolated on trust:
--   * The table must appear in a hard-coded allowlist. Anything else raises.
--   * Every column is checked against the catalog for that specific table
--     before it is used, then emitted through `format('%I')`, which quotes it.
--     A column that does not exist raises rather than being ignored.
--   * Values are NEVER interpolated. They reach the statement through
--     `jsonb_populate_record(null::<table>, $1)`, which also casts each field
--     to the column's real type — so a text "2026-01-15" lands in a timestamptz
--     as a timestamp, and a value of the wrong type raises instead of being
--     coerced into something surprising.
--   * SECURITY INVOKER (the default), deliberately. The function runs with the
--     caller's rights, so the server's service role can use it and an anon
--     caller gets nothing — RLS still denies them every table it touches.
--     EXECUTE is revoked from anon and authenticated below regardless.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Column validation
-- ---------------------------------------------------------------------------
-- Returns the object's keys, having proved every one is a real column of the
-- table. Raising on an unknown key matters: silently dropping it would apply a
-- PARTIAL mutation and then record the full intent in the audit row, which is
-- a worse lie than no audit row at all.
create or replace function audited_assert_columns(p_table text, p_obj jsonb)
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_keys text[];
  v_bad  text;
begin
  if p_obj is null or jsonb_typeof(p_obj) <> 'object' then
    return array[]::text[];
  end if;

  select array_agg(k) into v_keys from jsonb_object_keys(p_obj) k;
  if v_keys is null then
    return array[]::text[];
  end if;

  select k into v_bad
  from unnest(v_keys) k
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = p_table
      and c.column_name = k
  )
  limit 1;

  if v_bad is not null then
    raise exception 'audited_write: "%" is not a column of %', v_bad, p_table
      using errcode = 'undefined_column';
  end if;

  return v_keys;
end;
$$;

-- ---------------------------------------------------------------------------
-- The atomic wrapper
-- ---------------------------------------------------------------------------
-- p_ops is an ordered array. Each entry:
--   { "kind": "insert" | "update" | "upsert" | "delete",
--     "table": "<allowlisted table>",
--     "match":  { column: value, ... },   -- update / upsert / delete
--     "values": { column: value, ... } }  -- insert / update / upsert
--
-- Returns { "rows": [[...], ...], "before": [[...], ...] } — one entry per op,
-- in order, so the caller can read back values the DATABASE generated
-- (request_number, approval_number, verification_code) without a second trip
-- and without ever being able to supply them itself.
create or replace function audited_write(p_audit jsonb, p_ops jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  -- Tables a mutation may touch through this wrapper. audit_logs is absent on
  -- purpose: nothing may write the trail except this function's own final
  -- insert, or the trail becomes forgeable by the same path it protects.
  ALLOWED constant text[] := array[
    'members', 'member_translations', 'member_documents',
    'posts', 'post_translations', 'post_categories',
    'layouts', 'layout_blocks', 'layout_block_translations',
    'orders', 'report_submissions', 'report_reviews', 'report_approvals',
    'service_requests', 'service_request_events',
    'users', 'user_roles'
  ];

  v_op      jsonb;
  v_kind    text;
  v_table   text;
  v_match   jsonb;
  v_values  jsonb;
  v_set     text;
  v_where   text;
  v_cols    text;
  v_sel     text;
  v_sql     text;
  v_before  jsonb;
  v_after   jsonb;
  v_all_before jsonb := '[]'::jsonb;
  v_all_after  jsonb := '[]'::jsonb;
begin
  -- Validate the audit context BEFORE touching data. audit_logs requires all
  -- three, and discovering that from a NOT NULL violation at the end — after
  -- the mutations have run and are about to be thrown away — hides a caller
  -- bug behind a constraint error. Fail here, where the message names the
  -- field.
  if coalesce(p_audit->>'action', '') = '' then
    raise exception 'audited_write: audit.action is required'
      using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(p_audit->>'entity_type', '') = '' then
    raise exception 'audited_write: audit.entity_type is required'
      using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(p_audit->>'entity_id', '') = '' then
    raise exception 'audited_write: audit.entity_id is required'
      using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then
    raise exception 'audited_write: at least one operation is required';
  end if;

  for v_op in select value from jsonb_array_elements(p_ops) loop
    v_kind  := v_op->>'kind';
    v_table := v_op->>'table';
    v_match := coalesce(v_op->'match', '{}'::jsonb);
    v_values:= coalesce(v_op->'values', '{}'::jsonb);

    if v_table is null or not (v_table = any(ALLOWED)) then
      raise exception 'audited_write: table "%" may not be written here', v_table
        using errcode = 'insufficient_privilege';
    end if;

    perform audited_assert_columns(v_table, v_match);
    perform audited_assert_columns(v_table, v_values);

    -- Match on identity only. `is not distinct from` rather than `=` so a
    -- deliberate NULL matches, and so a NULL never silently widens the target
    -- to every row the way `= NULL` would.
    v_where := (
      select string_agg(format('t.%I is not distinct from m.%I', k, k), ' and ')
      from jsonb_object_keys(v_match) k
    );

    if v_kind in ('update', 'upsert', 'delete') and coalesce(v_where, '') = '' then
      raise exception 'audited_write: % on % requires a match', v_kind, v_table
        using errcode = 'invalid_parameter_value';
    end if;

    -- Capture the prior state before touching anything.
    v_before := '[]'::jsonb;
    if v_kind in ('update', 'upsert', 'delete') then
      v_sql := format(
        'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)
           from %I t, jsonb_populate_record(null::%I, $1) m
          where %s',
        v_table, v_table, v_where);
      execute v_sql into v_before using v_match;
    end if;

    v_after := '[]'::jsonb;

    if v_kind = 'insert' or (v_kind = 'upsert' and jsonb_array_length(v_before) = 0) then
      -- Name only the supplied columns. `insert ... select *` would write NULL
      -- over every column the caller omitted and defeat the DB-side defaults
      -- that generate request_number, approval_number and verification_code —
      -- the values a client must never be able to choose.
      declare
        v_ins jsonb := case when v_kind = 'upsert' then v_match || v_values else v_values end;
      begin
        perform audited_assert_columns(v_table, v_ins);
        select string_agg(format('%I', k), ', '), string_agg(format('v.%I', k), ', ')
          into v_cols, v_sel
          from jsonb_object_keys(v_ins) k;

        if coalesce(v_cols, '') = '' then
          raise exception 'audited_write: insert into % has no values', v_table
            using errcode = 'invalid_parameter_value';
        end if;

        v_sql := format(
          'with ins as (
             insert into %I (%s)
             select %s from jsonb_populate_record(null::%I, $1) v
             returning to_jsonb(%I) as row
           ) select coalesce(jsonb_agg(row), ''[]''::jsonb) from ins',
          v_table, v_cols, v_sel, v_table, v_table);
        execute v_sql into v_after using v_ins;
      end;

    elsif v_kind in ('update', 'upsert') then
      v_set := (
        select string_agg(format('%I = v.%I', k, k), ', ')
        from jsonb_object_keys(v_values) k
      );
      if coalesce(v_set, '') = '' then
        raise exception 'audited_write: update of % has no values', v_table
          using errcode = 'invalid_parameter_value';
      end if;

      v_sql := format(
        'with upd as (
           update %I t set %s
             from jsonb_populate_record(null::%I, $1) v,
                  jsonb_populate_record(null::%I, $2) m
            where %s
           returning to_jsonb(t) as row
         ) select coalesce(jsonb_agg(row), ''[]''::jsonb) from upd',
        v_table, v_set, v_table, v_table, v_where);
      execute v_sql into v_after using v_values, v_match;

    elsif v_kind = 'delete' then
      v_sql := format(
        'with del as (
           delete from %I t
            using jsonb_populate_record(null::%I, $1) m
            where %s
           returning to_jsonb(t) as row
         ) select coalesce(jsonb_agg(row), ''[]''::jsonb) from del',
        v_table, v_table, v_where);
      execute v_sql into v_after using v_match;

    else
      raise exception 'audited_write: unknown operation "%"', v_kind
        using errcode = 'invalid_parameter_value';
    end if;

    v_all_before := v_all_before || jsonb_build_array(v_before);
    v_all_after  := v_all_after  || jsonb_build_array(v_after);
  end loop;

  -- The audit row, in the SAME transaction as everything above. If this raises,
  -- every mutation in this call is rolled back with it. That is the guarantee
  -- the whole migration exists for.
  --
  -- before/after are captured HERE from what actually changed, not passed in by
  -- the caller. An audit trail that records what the application believed it
  -- did is worth much less than one recording what the database actually did.
  insert into audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id,
    before, after, reason, ip_address, user_agent
  ) values (
    nullif(p_audit->>'actor_user_id', ''),
    nullif(p_audit->>'actor_role', ''),
    p_audit->>'action',
    nullif(p_audit->>'entity_type', ''),
    nullif(p_audit->>'entity_id', ''),
    case when v_all_before = '[]'::jsonb then null else v_all_before end,
    case when v_all_after  = '[]'::jsonb then null else v_all_after  end,
    nullif(p_audit->>'reason', ''),
    nullif(p_audit->>'ip_address', ''),
    nullif(p_audit->>'user_agent', '')
  );

  return jsonb_build_object('rows', v_all_after, 'before', v_all_before);
end;
$$;

comment on function audited_write(jsonb, jsonb) is
  'Performs an ordered list of writes and records the audit row in the SAME transaction. A single PostgREST RPC call is one transaction, so either every mutation and its audit row commit together, or none of them do.';

-- ---------------------------------------------------------------------------
-- Reachability
-- ---------------------------------------------------------------------------
-- The server calls this with the service role. No browser-facing role has any
-- business invoking it, and neither is used in an RLS policy, so revoking is
-- safe here (unlike current_user_role(), which policies depend on).
revoke execute on function audited_write(jsonb, jsonb) from anon, authenticated;
revoke execute on function audited_assert_columns(text, jsonb) from anon, authenticated;
