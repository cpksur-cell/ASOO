#!/usr/bin/env node
/**
 * Keeps the `permissions` / `role_permissions` tables in step with the code.
 *
 * WHY THIS EXISTS. Those two tables were empty while `PERMISSIONS` in
 * `src/lib/auth/roles.ts` did all the real work. That is worse than it sounds:
 * the tables are named exactly what someone would look for when asking "who
 * may do what", so editing them looks like it should change behaviour, and it
 * changes nothing. Seeding them fixes the misdirection but creates the
 * opposite hazard — two descriptions of the same policy, free to drift.
 *
 * So the code matrix stays the ONE source of truth, the migration is
 * GENERATED from it, and this script also runs as an audit that fails when
 * the two disagree. The audit reads the migration file, not the database, so
 * it works offline and belongs in `npm run verify`.
 *
 *   node scripts/permissions-seed.mjs           # audit: exit 1 on drift
 *   node scripts/permissions-seed.mjs --write   # regenerate the migration
 *
 * Change `PERMISSIONS`, run `--write`, apply the migration. Never hand-edit
 * the generated SQL: the audit will reject it, which is the point.
 *
 * NOTE ON AUTHORITY. Even seeded, these tables are REFERENCE DATA. Nothing
 * reads them at runtime — `can()` and `assertPermission()` consult the code
 * matrix, which is shared with edge middleware where a database round trip is
 * not available. Anyone planning to make the tables authoritative has to move
 * that decision first; until then they document the policy, they do not
 * enforce it.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROLES_TS = join(root, 'src/lib/auth/roles.ts')
const MIGRATION = join(root, 'supabase/migrations/0016_permissions_seed.sql')

const write = process.argv.includes('--write')

/* ------------------------------------------------------- the code matrix */

const ts = readFileSync(ROLES_TS, 'utf8')

const block = ts.match(/export const PERMISSIONS[^=]*=\s*\{([\s\S]*?)\n\}/)
if (!block) {
  console.error('✗ could not find PERMISSIONS in src/lib/auth/roles.ts')
  process.exit(1)
}

// Strip comments before parsing so a commented-out permission is not counted.
const body = block[1]
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')

const matrix = new Map()
for (const m of body.matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)) {
  const codes = [...m[2].matchAll(/'([^']+)'/g)].map((c) => c[1])
  matrix.set(m[1], codes)
}

if (matrix.size === 0) {
  console.error('✗ parsed PERMISSIONS but found no roles')
  process.exit(1)
}

const perms = new Set()
const links = []
for (const [role, codes] of matrix) {
  for (const code of codes) {
    if (!/^[a-z_*]+:[a-z_*]+$/.test(code)) {
      console.error(`✗ malformed permission code "${code}" on role ${role}`)
      process.exit(1)
    }
    perms.add(code)
    links.push([role, code])
  }
}

const permList = [...perms].sort()
const linkList = links.slice().sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]))

/* --------------------------------------------------------------- emit SQL */

const q = (s) => `'${s.replace(/'/g, "''")}'`
const permValues = permList
  .map((c) => `  (${q(c)}, ${q(c.split(':')[0])}, ${q(c.split(':')[1])})`)
  .join(',\n')
const linkValues = linkList.map(([r, c]) => `    (${q(r)}, ${q(c)})`).join(',\n')

const sql = `-- ============================================================================
-- ASOO Portal — 0016 · seed the permission matrix into the database
-- ============================================================================
-- GENERATED FILE. Do not hand-edit.
--
--   source:    src/lib/auth/roles.ts  (PERMISSIONS)
--   regenerate: node scripts/permissions-seed.mjs --write
--   audit:      node scripts/permissions-seed.mjs   (runs in npm run verify)
--
-- \`permissions\` and \`role_permissions\` were created in 0002 and then left
-- empty, while the matrix in code did all the work. An empty table named
-- \`role_permissions\` is a trap: it is the first place someone looks to change
-- who may do what, and editing it would have changed nothing at all.
--
-- These rows are REFERENCE DATA, not the enforcement point. \`can()\` and
-- \`assertPermission()\` read the code matrix, which is shared with the edge
-- middleware where a database round trip is not available. Making these tables
-- authoritative is a real change, not a configuration one.
--
-- \`description\` is left NULL rather than filled with invented prose. The
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
${permValues}
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
${linkValues};

-- Joining on the CODES rather than hard-coded uuids keeps this portable: a
-- fresh database generates its own ids for roles and permissions and this
-- still lands correctly. It also means a role missing from \`roles\` silently
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
-- A role named in the matrix but absent from \`roles\` would otherwise drop its
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
  if v_links <> ${linkList.length} then
    raise exception '0016: expected ${linkList.length} role_permissions rows, found %', v_links;
  end if;
end
$seed$;

drop table _perm_matrix_stage;
`

/* ------------------------------------------------------------------ run */

if (write) {
  writeFileSync(MIGRATION, sql)
  console.log(
    `✓ wrote supabase/migrations/0016_permissions_seed.sql — ` +
      `${permList.length} permissions, ${linkList.length} grants across ${matrix.size} roles`,
  )
  process.exit(0)
}

// Audit. Compare what the migration actually contains against the code, so a
// hand-edit to either one is caught.
let existing
try {
  existing = readFileSync(MIGRATION, 'utf8')
} catch {
  console.error('✗ supabase/migrations/0016_permissions_seed.sql is missing')
  console.error('   run: node scripts/permissions-seed.mjs --write')
  process.exit(1)
}

const insertBlock = existing.match(/insert into permissions \(code, resource, action\) values\n([\s\S]*?)\non conflict/)
const sqlPerms = insertBlock ? [...insertBlock[1].matchAll(/\('([^']+)', '([^']+)', '([^']+)'\)/g)].map((m) => m[1]) : []
const valuesBlock = existing.match(
  /insert into _perm_matrix_stage \(role_code, perm_code\) values\n([\s\S]*?);\n/,
)
const sqlLinks = valuesBlock ? [...valuesBlock[1].matchAll(/\('([^']+)', '([^']+)'\)/g)].map((m) => `${m[1]}|${m[2]}`) : []

const wantPerms = permList
const wantLinks = linkList.map(([r, c]) => `${r}|${c}`)

const problems = []
const diff = (label, want, got) => {
  const missing = want.filter((x) => !got.includes(x))
  const extra = got.filter((x) => !want.includes(x))
  for (const m of missing) problems.push(`${label} in code but not in the migration: ${m}`)
  for (const e of extra) problems.push(`${label} in the migration but not in code: ${e}`)
}
diff('permission', wantPerms, sqlPerms)
diff('grant', wantLinks, sqlLinks)

console.log(
  `Permission matrix: ${wantPerms.length} permissions, ${wantLinks.length} grants across ${matrix.size} roles`,
)
if (problems.length) {
  console.error('\n✗ code and migration disagree:')
  for (const p of problems) console.error('   ' + p)
  console.error('\n   regenerate with: node scripts/permissions-seed.mjs --write')
  process.exit(1)
}
console.log('✓ permissions: migration matches src/lib/auth/roles.ts')
