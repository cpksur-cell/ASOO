-- ============================================================================
-- ASOO Portal — 0016 · seed the permission matrix into the database
-- ============================================================================
-- GENERATED FILE. Do not hand-edit.
--
--   source:    src/lib/auth/roles.ts  (PERMISSIONS)
--   regenerate: node scripts/permissions-seed.mjs --write
--   audit:      node scripts/permissions-seed.mjs   (runs in npm run verify)
--
-- `permissions` and `role_permissions` were created in 0002 and then left
-- empty, while the matrix in code did all the work. An empty table named
-- `role_permissions` is a trap: it is the first place someone looks to change
-- who may do what, and editing it would have changed nothing at all.
--
-- These rows are REFERENCE DATA, not the enforcement point. `can()` and
-- `assertPermission()` read the code matrix, which is shared with the edge
-- middleware where a database round trip is not available. Making these tables
-- authoritative is a real change, not a configuration one.
--
-- `description` is left NULL rather than filled with invented prose. The
-- syndicate's signed-off wording lives in docs/08-security.md §4; duplicating
-- a paraphrase here would be a third description of the same policy.
--
-- Reconciling, not merely additive: rows no longer in the matrix are removed,
-- so applying this twice, or after a permission is retired, converges. Safe to
-- re-run — these are reference tables, not financial history.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The permissions themselves
-- ---------------------------------------------------------------------------
insert into permissions (code, resource, action) values
  ('*:*', '*', '*'),
  ('applications:read', 'applications', 'read'),
  ('applications:review', 'applications', 'review'),
  ('certificates:issue', 'certificates', 'issue'),
  ('certificates:request', 'certificates', 'request'),
  ('certificates:revoke', 'certificates', 'revoke'),
  ('certificates:verify', 'certificates', 'verify'),
  ('complaints:file', 'complaints', 'file'),
  ('complaints:manage', 'complaints', 'manage'),
  ('complaints:read', 'complaints', 'read'),
  ('documents:write', 'documents', 'write'),
  ('feeplans:manage', 'feeplans', 'manage'),
  ('feeplans:read', 'feeplans', 'read'),
  ('invoices:bulk_issue', 'invoices', 'bulk_issue'),
  ('invoices:issue', 'invoices', 'issue'),
  ('invoices:read', 'invoices', 'read'),
  ('invoices:waive', 'invoices', 'waive'),
  ('layout:manage', 'layout', 'manage'),
  ('links:manage', 'links', 'manage'),
  ('media:upload', 'media', 'upload'),
  ('members:create', 'members', 'create'),
  ('members:export', 'members', 'export'),
  ('members:read', 'members', 'read'),
  ('members:suspend', 'members', 'suspend'),
  ('members:update', 'members', 'update'),
  ('notifications:campaign', 'notifications', 'campaign'),
  ('notifications:templates', 'notifications', 'templates'),
  ('pages:write', 'pages', 'write'),
  ('payments:pay', 'payments', 'pay'),
  ('payments:read', 'payments', 'read'),
  ('payments:record_manual', 'payments', 'record_manual'),
  ('payments:refund', 'payments', 'refund'),
  ('posts:publish', 'posts', 'publish'),
  ('posts:read', 'posts', 'read'),
  ('posts:write', 'posts', 'write'),
  ('profile:read', 'profile', 'read'),
  ('profile:update', 'profile', 'update'),
  ('renewals:read', 'renewals', 'read'),
  ('renewals:review', 'renewals', 'review'),
  ('renewals:submit', 'renewals', 'submit'),
  ('reports:approve', 'reports', 'approve'),
  ('reports:financial', 'reports', 'financial'),
  ('reports:review', 'reports', 'review'),
  ('reports:submit', 'reports', 'submit'),
  ('reports:verify', 'reports', 'verify'),
  ('requests:fulfill', 'requests', 'fulfill'),
  ('requests:read', 'requests', 'read'),
  ('requests:submit', 'requests', 'submit')
on conflict (code) do update
  set resource = excluded.resource,
      action   = excluded.action;

-- ---------------------------------------------------------------------------
-- The grants, staged once
-- ---------------------------------------------------------------------------
-- Staged in a table rather than repeated as an inline VALUES list in each of
-- the three statements below. Three copies of the same 68 rows is three
-- chances for them to disagree after an edit, and the disagreement would be
-- silent: the insert would grant what the prune then removes.
create table if not exists _perm_matrix_stage (role_code text, perm_code text);
truncate _perm_matrix_stage;
insert into _perm_matrix_stage (role_code, perm_code) values
    ('content_editor', 'certificates:verify'),
    ('content_editor', 'documents:write'),
    ('content_editor', 'layout:manage'),
    ('content_editor', 'links:manage'),
    ('content_editor', 'media:upload'),
    ('content_editor', 'notifications:campaign'),
    ('content_editor', 'notifications:templates'),
    ('content_editor', 'pages:write'),
    ('content_editor', 'posts:publish'),
    ('content_editor', 'posts:read'),
    ('content_editor', 'posts:write'),
    ('finance_officer', 'certificates:verify'),
    ('finance_officer', 'feeplans:manage'),
    ('finance_officer', 'feeplans:read'),
    ('finance_officer', 'invoices:bulk_issue'),
    ('finance_officer', 'invoices:issue'),
    ('finance_officer', 'invoices:read'),
    ('finance_officer', 'invoices:waive'),
    ('finance_officer', 'members:read'),
    ('finance_officer', 'notifications:campaign'),
    ('finance_officer', 'payments:read'),
    ('finance_officer', 'payments:record_manual'),
    ('finance_officer', 'payments:refund'),
    ('finance_officer', 'renewals:read'),
    ('finance_officer', 'reports:financial'),
    ('member', 'certificates:request'),
    ('member', 'certificates:verify'),
    ('member', 'complaints:file'),
    ('member', 'complaints:read'),
    ('member', 'invoices:read'),
    ('member', 'payments:pay'),
    ('member', 'profile:read'),
    ('member', 'profile:update'),
    ('member', 'renewals:submit'),
    ('member', 'reports:submit'),
    ('member', 'reports:verify'),
    ('member', 'requests:read'),
    ('member', 'requests:submit'),
    ('membership_officer', 'applications:read'),
    ('membership_officer', 'applications:review'),
    ('membership_officer', 'certificates:issue'),
    ('membership_officer', 'certificates:revoke'),
    ('membership_officer', 'certificates:verify'),
    ('membership_officer', 'complaints:manage'),
    ('membership_officer', 'complaints:read'),
    ('membership_officer', 'media:upload'),
    ('membership_officer', 'members:create'),
    ('membership_officer', 'members:export'),
    ('membership_officer', 'members:read'),
    ('membership_officer', 'members:suspend'),
    ('membership_officer', 'members:update'),
    ('membership_officer', 'notifications:campaign'),
    ('membership_officer', 'renewals:read'),
    ('membership_officer', 'renewals:review'),
    ('membership_officer', 'reports:approve'),
    ('membership_officer', 'reports:review'),
    ('membership_officer', 'reports:verify'),
    ('membership_officer', 'requests:fulfill'),
    ('membership_officer', 'requests:read'),
    ('super_admin', '*:*'),
    ('support_agent', 'certificates:verify'),
    ('support_agent', 'complaints:manage'),
    ('support_agent', 'complaints:read'),
    ('support_agent', 'media:upload'),
    ('support_agent', 'members:read'),
    ('support_agent', 'posts:read'),
    ('support_agent', 'requests:fulfill'),
    ('support_agent', 'requests:read');

-- Joining on the CODES rather than hard-coded uuids keeps this portable: a
-- fresh database generates its own ids for roles and permissions and this
-- still lands correctly. It also means a role missing from `roles` silently
-- contributes no links rather than failing — checked at the end.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from _perm_matrix_stage m
join roles       r on r.code = m.role_code
join permissions p on p.code = m.perm_code
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Prune whatever the matrix no longer grants
-- ---------------------------------------------------------------------------
delete from role_permissions rp
where not exists (
  select 1
  from _perm_matrix_stage m
  join roles       r on r.code = m.role_code
  join permissions p on p.code = m.perm_code
  where r.id = rp.role_id and p.id = rp.permission_id
);

delete from permissions
where code not in (select perm_code from _perm_matrix_stage);

-- ---------------------------------------------------------------------------
-- Refuse to finish quietly if the seed did not fully land
-- ---------------------------------------------------------------------------
-- A role named in the matrix but absent from `roles` would otherwise drop its
-- permissions with no error at all — the join simply matches nothing.
do $seed$
declare
  v_missing text;
  v_links   int;
begin
  select string_agg(distinct m.role_code, ', ')
    into v_missing
  from _perm_matrix_stage m
  where not exists (select 1 from roles r where r.code = m.role_code);

  if v_missing is not null then
    raise exception '0016: matrix names role(s) missing from roles: %', v_missing;
  end if;

  select count(*) into v_links from role_permissions;
  if v_links <> 68 then
    raise exception '0016: expected 68 role_permissions rows, found %', v_links;
  end if;
end
$seed$;

drop table _perm_matrix_stage;
