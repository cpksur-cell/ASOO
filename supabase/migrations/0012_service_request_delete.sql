-- ============================================================================
-- ASOO Portal — 0012 · make service_requests deletable, and clean a test row
-- ============================================================================
-- TWO THINGS, both consequences of one mistake in 0011.
--
-- 1. THE DEFECT
--
-- 0011 gave service_request_events a foreign key declared ON DELETE CASCADE,
-- and then a rule `on delete ... do instead nothing` to make the history
-- append-only. Those two cannot both hold. Deleting a service_request fires
-- the cascade, the rule turns the child delete into a no-op, and the foreign
-- key check then fails — so the parent row cannot be removed either, and the
-- caller gets an opaque 500.
--
-- A rule cannot tell a cascade apart from a direct DELETE, so "append-only"
-- and "ON DELETE CASCADE" are simply incompatible on the same table. The
-- honest fix is to pick one. We keep the guarantee that actually matters —
-- history can never be REWRITTEN — and let a parent delete cascade:
--
--   * `no_update` STAYS. An event, once written, cannot be altered. That is
--     the property an audit depends on.
--   * `no_delete` GOES. Nothing in the application deletes a service request;
--     there is no code path for it. The rule was defending against something
--     that does not happen while breaking something that does, and it hid the
--     breakage behind a 500.
--
-- 2. THE CLEANUP
--
-- Verifying 0011 against the live database inserted one row to prove the
-- request_number sequence and the append-only rule worked. It did — and then
-- could not be removed, because of the defect above. It is deleted here.
-- Scoped by BOTH its key and its requester so this can never match a real
-- member's request.
-- ============================================================================

drop rule if exists service_request_events_no_delete on service_request_events;

comment on table service_request_events is
  'Append-only history of a service request. UPDATE is blocked by rule; DELETE is permitted only so a parent service_request can cascade. The application never deletes either.';

delete from service_requests
where dls_key = 'SELFTEST-0011'
  and requester_user_id = 'selftest';
