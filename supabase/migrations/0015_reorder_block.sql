-- ============================================================================
-- ASOO Portal — 0015 · close the layout reorder race
-- ============================================================================
-- 0014 made the reorder WRITE atomic, but not the reorder. `buildReorderOps()`
-- read the current order over one HTTP request, worked out which two blocks to
-- swap in application memory, then sent the swap as a second request. The
-- decision was therefore made against a snapshot that could already be stale by
-- the time it was acted on.
--
-- Two editors moving blocks in the same layout at the same moment interleave
-- like this:
--
--   A reads  [hero(10), news(20), map(30)]      A decides: swap news <-> map
--   B reads  [hero(10), news(20), map(30)]      B decides: swap hero <-> news
--   A writes news=30, map=20                    -> [hero(10), map(20), news(30)]
--   B writes hero=20, news=10                   -> [news(10), map(20), hero(20)]
--
-- B's write lands on a layout that no longer looks the way B measured. The
-- result is not "one of the two reorders won" — it is an order neither editor
-- asked for, with two blocks sharing position 20 and their relative order left
-- to the sort's tie-breaking. On the syndicate homepage that is a visible
-- defect neither editor can explain from what they clicked.
--
-- THE FIX: the decision moves into the transaction that acts on it. The caller
-- no longer says "swap these two rows" — it says "move THIS block up", and the
-- database works out the neighbour from the order as it stands at that instant,
-- under a lock.
--
-- WHY LOCK THE LAYOUT ROW, not the blocks. `select ... for update` over the
-- sibling blocks would lock the right rows, but two concurrent reorders could
-- acquire them in different orders and deadlock. The parent `layouts` row is a
-- single row that every reorder of that layout must take first, so they
-- serialize with no deadlock possible. Reorders are rare and human-paced; the
-- contention cost is nil.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The move, decided and applied under one lock
-- ---------------------------------------------------------------------------
-- Returns { "before": [...], "after": [...] } — the two rows as they were and
-- as they now are. A move with no neighbour in that direction is a legal no-op
-- and returns empty arrays rather than raising: the block is already at the
-- edge of its region, which is not an error, and the caller could not have
-- known it without taking this lock itself.
create or replace function audited_reorder_block(p_block_id uuid, p_direction text)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v_layout          uuid;
  v_region          layout_region;
  v_position        int;
  v_target          uuid;
  v_target_position int;
  v_before          jsonb;
  v_after           jsonb;
begin
  if p_direction is null or p_direction not in ('up', 'down') then
    raise exception 'audited_reorder_block: direction must be up or down, got "%"', p_direction
      using errcode = 'invalid_parameter_value';
  end if;

  select layout_id into v_layout from layout_blocks where id = p_block_id;
  if v_layout is null then
    -- Nothing to move — deleted between the click and the call, most likely.
    return jsonb_build_object('before', '[]'::jsonb, 'after', '[]'::jsonb);
  end if;

  -- The gate. Everything below reads an order that cannot shift underneath it.
  perform 1 from layouts where id = v_layout for update;

  -- Re-read AFTER the lock — the whole point of the exercise. A reorder that
  -- committed while we waited here is now visible, so the neighbour is chosen
  -- from the order as it actually stands, not as the caller last saw it.
  select region, position into v_region, v_position
    from layout_blocks where id = p_block_id;

  -- Only within the same region: moving a `main` block above an `aside` one
  -- would be meaningless.
  --
  -- `position` carries no unique constraint, so ties are possible; ordering by
  -- id as well makes the neighbour deterministic instead of leaving it to the
  -- plan. Without that, a layout with duplicate positions could move a block
  -- up and down and not end up where it started.
  if p_direction = 'up' then
    select id, position into v_target, v_target_position
      from layout_blocks
     where layout_id = v_layout
       and region = v_region
       and (position, id) < (v_position, p_block_id)
     order by position desc, id desc
     limit 1;
  else
    select id, position into v_target, v_target_position
      from layout_blocks
     where layout_id = v_layout
       and region = v_region
       and (position, id) > (v_position, p_block_id)
     order by position asc, id asc
     limit 1;
  end if;

  if v_target is null then
    -- Already at the edge of its region. Recorded as an attempt that moved
    -- nothing, which is the honest entry.
    return jsonb_build_object('before', '[]'::jsonb, 'after', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.position), '[]'::jsonb)
    into v_before
    from layout_blocks b
   where b.id in (p_block_id, v_target);

  if v_target_position = v_position then
    -- The two are TIED, and swapping equal numbers would move nothing — the
    -- block would sit there refusing to budge no matter how often it was
    -- clicked. Not hypothetical: `position` defaults to 0, so any two blocks
    -- inserted without an explicit one start tied.
    --
    -- Step outside the tie instead. That may land on a number a third block
    -- already holds, which is harmless: the ordering is (position, id), and
    -- the move that was asked for — this block now sorts before/after that
    -- one — has happened either way.
    update layout_blocks
       set position = case when p_direction = 'up' then v_position - 1 else v_position + 1 end
     where id = p_block_id;
  else
    -- Straight swap, no scratch value. The old code stepped through a negative
    -- placeholder so a concurrent reader would never see two blocks sharing a
    -- position; inside one transaction that cannot happen anyway, because MVCC
    -- shows other sessions either the whole swap or none of it.
    update layout_blocks set position = v_target_position where id = p_block_id;
    update layout_blocks set position = v_position        where id = v_target;
  end if;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.position), '[]'::jsonb)
    into v_after
    from layout_blocks b
   where b.id in (p_block_id, v_target);

  return jsonb_build_object('before', v_before, 'after', v_after);
end;
$$;

comment on function audited_reorder_block(uuid, text) is
  'Moves a layout block one place within its region, choosing the neighbour under a lock on the parent layout row so a concurrent reorder cannot interleave. Called only through audited_write.';

-- ---------------------------------------------------------------------------
-- Wire it into the atomic wrapper as a named operation
-- ---------------------------------------------------------------------------
-- A new op kind rather than a second RPC: it has to share a transaction with
-- the audit row, and PostgREST gives one transaction per call. It is a NAMED,
-- fully typed operation — it takes a row id and a direction, and no SQL is
-- built from either — so it adds nothing to the dynamic-SQL surface 0014
-- reasons about.
--
--   { "kind": "reorder_block", "table": "layout_blocks",
--     "match": { "id": "<uuid>" }, "direction": "up" | "down" }
--
-- The rest of this function is unchanged from 0014.
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
  v_res     jsonb;
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

    -- Dispatched before the column checks below: its parameters are a row id
    -- and a direction, and neither is a column of anything.
    if v_kind = 'reorder_block' then
      if v_table <> 'layout_blocks' then
        raise exception 'audited_write: reorder_block applies to layout_blocks, not %', v_table
          using errcode = 'invalid_parameter_value';
      end if;
      if coalesce(v_match->>'id', '') = '' then
        raise exception 'audited_write: reorder_block requires match.id'
          using errcode = 'invalid_parameter_value';
      end if;

      v_res := audited_reorder_block((v_match->>'id')::uuid, v_op->>'direction');
      v_all_before := v_all_before || jsonb_build_array(v_res->'before');
      v_all_after  := v_all_after  || jsonb_build_array(v_res->'after');
      continue;
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

-- ---------------------------------------------------------------------------
-- Reachability
-- ---------------------------------------------------------------------------
-- `create or replace` resets the grants on audited_write, so the revoke from
-- 0014 has to be repeated here or the browser-facing roles quietly regain it.
revoke execute on function audited_write(jsonb, jsonb) from anon, authenticated;
revoke execute on function audited_reorder_block(uuid, text) from anon, authenticated;
