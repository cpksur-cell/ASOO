-- ============================================================================
-- ASOO Portal — 0012 · service requests and reviewed reports are PERMANENT
-- ============================================================================
-- SUPERSEDES the earlier draft `0012_service_request_delete.sql`, which was
-- never applied to any environment. That draft resolved the contradiction
-- below by allowing deletes; this one resolves it by forbidding them, which is
-- the correct posture for a government record and was the decision taken.
--
-- ── THE CONTRADICTION ──────────────────────────────────────────────────────
--
-- Two child tables hold append-only history:
--
--   service_request_events  → service_requests   (added in 0011)
--   report_reviews          → report_submissions (added in 0005)
--
-- Each was declared with BOTH:
--   * a foreign key `ON DELETE CASCADE`, and
--   * a rule `on delete ... do instead nothing` to make history append-only.
--
-- Those cannot both hold. Deleting a parent fires the cascade, the rule turns
-- the child delete into a no-op, the foreign key check then fails, and the
-- parent cannot be removed either. The caller gets an opaque 500 with nothing
-- explaining it. A Postgres rule cannot tell a cascade apart from a direct
-- DELETE, so "append-only" and "ON DELETE CASCADE" are simply incompatible on
-- the same table.
--
-- ── THE RESOLUTION ─────────────────────────────────────────────────────────
--
-- Say what we actually mean. A service request that has been answered, and a
-- report submission that has been reviewed, are records of an official act.
-- They are not deletable, and pretending otherwise with a CASCADE that cannot
-- fire was the real defect.
--
--   * The append-only rules STAY on both tables — no_update AND no_delete.
--     History can be neither rewritten nor removed.
--   * The foreign keys become ON DELETE RESTRICT. An attempt to delete a
--     parent that carries history now fails immediately with a named
--     constraint violation that says exactly what is wrong, instead of a 500.
--
-- Nothing in the application deletes either parent; there is no such code
-- path. This makes the database agree with that intent rather than contradict
-- itself.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Counter e-service requests
-- ---------------------------------------------------------------------------
alter table service_request_events
  drop constraint if exists service_request_events_request_id_fkey;

alter table service_request_events
  add constraint service_request_events_request_id_fkey
  foreign key (request_id) references service_requests(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 2. Report review decisions
-- ---------------------------------------------------------------------------
alter table report_reviews
  drop constraint if exists report_reviews_submission_id_fkey;

alter table report_reviews
  add constraint report_reviews_submission_id_fkey
  foreign key (submission_id) references report_submissions(id) on delete restrict;

comment on table service_request_events is
  'Append-only history of a service request. UPDATE and DELETE are both blocked by rule, and the parent FK is RESTRICT: a request that has history is a permanent record.';

comment on table report_reviews is
  'Append-only review decisions. UPDATE and DELETE are both blocked by rule, and the parent FK is RESTRICT: a submission that has been reviewed is a permanent record.';

-- ---------------------------------------------------------------------------
-- 3. One-off: remove the verification row
-- ---------------------------------------------------------------------------
-- Verifying that 0011 had applied correctly inserted one probe row, to prove
-- the request_number sequence and the append-only rule worked. Both did — and
-- the row then could not be removed, which is how the contradiction above was
-- found. It is deleted here under a deliberate, momentary exception: the rule
-- is lifted, the row and its event are removed, and the rule is restored in
-- the same migration.
--
-- Scoped by BOTH the key and the requester so it can never match a real
-- member's request. This is the only row in the database that matches.
drop rule if exists service_request_events_no_delete on service_request_events;

delete from service_request_events
where request_id in (
  select id from service_requests
  where dls_key = 'SELFTEST-0011' and requester_user_id = 'selftest'
);

delete from service_requests
where dls_key = 'SELFTEST-0011' and requester_user_id = 'selftest';

create rule service_request_events_no_delete as
  on delete to service_request_events do instead nothing;

-- ---------------------------------------------------------------------------
-- 4. Hardening: pin the search_path on is_staff()
-- ---------------------------------------------------------------------------
-- `is_staff()` gates three RLS policies (members, orders, report_submissions)
-- and calls `current_user_role()` by unqualified name with no search_path set.
-- It is SECURITY INVOKER and no application role can CREATE in `public`, so
-- there is no way to shadow that call today — this is defence in depth, not a
-- live hole. Pinning it costs nothing and removes the question permanently.
alter function public.is_staff() set search_path = public;

-- The remaining mutable-search_path functions are SECURITY INVOKER helpers
-- with no privilege to borrow (set_updated_at, the number generators). Pinned
-- anyway so the linter is quiet and the rule is uniform.
alter function public.set_updated_at() set search_path = public;
alter function public.next_order_number() set search_path = public;
alter function public.next_approval_number() set search_path = public;
alter function public.next_service_request_number() set search_path = public;
alter function public.generate_verification_code() set search_path = public;
