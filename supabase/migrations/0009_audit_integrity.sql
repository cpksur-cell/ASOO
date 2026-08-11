-- ============================================================================
-- ASOO Portal — 0009 · the audit log must never be blocked from recording
-- ============================================================================
-- `audit_logs.actor_user_id` carried a foreign key to `users`. That is wrong
-- for an audit trail, and it failed in practice: a mutation succeeded, the
-- audit insert was then rejected for referential reasons, and the result was
-- exactly the outcome CLAUDE.md §2 rule 5 forbids — a change with no record.
--
-- An audit row is a HISTORICAL FACT, not a live relationship. It states who
-- acted at a moment in time. Two consequences follow:
--
--   1. It must record even when the actor is not a row in `users` — a system
--      job, a deleted account, a development identity.
--   2. It must not be the reason a user cannot be deleted later. With the FK
--      in place, the audit trail silently became a retention lock.
--
-- `actor_role` was already stored as a snapshot string for the same reason.
-- This makes `actor_user_id` consistent with it.
-- ============================================================================

alter table audit_logs drop constraint if exists audit_logs_actor_user_id_fkey;

comment on column audit_logs.actor_user_id is
  'Snapshot of the acting identity at the time of the action. Deliberately NOT a foreign key: an audit row must always be writable and must survive the deletion of the account it names.';

-- The log is queried by "what happened to this entity" and "what did this
-- person do"; the second had no index.
create index if not exists audit_logs_actor_idx on audit_logs (actor_user_id, created_at desc);
