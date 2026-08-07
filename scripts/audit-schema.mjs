#!/usr/bin/env node
/**
 * Deep structural check of the Data Connect schema.
 *
 * Not a substitute for the Data Connect compiler, but it catches the mistakes
 * that compile fine yet are wrong for THIS system: a money field typed as a
 * float, a table with no key, a translation table missing its composite key, a
 * dangling foreign-key type, an enum value used but never defined, a financial
 * table that looks mutable. Run before committing schema changes.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'dataconnect/schema/schema.gql'), 'utf8')

const problems = []
const warnings = []
const scalars = new Set(['String', 'Int', 'Int64', 'Float', 'Boolean', 'UUID', 'Timestamp', 'Date', 'Any'])

// Parse enums
const enums = new Map()
for (const m of src.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) {
  enums.set(m[1], m[2].trim().split(/\s+/).filter(Boolean))
}

// Parse types with their bodies
const types = []
for (const m of src.matchAll(/type\s+(\w+)\s+@table\(([^)]*)\)\s*\{([\s\S]*?)\n\}/g)) {
  types.push({ name: m[1], tableArgs: m[2], body: m[3] })
}

const typeNames = new Set(types.map((t) => t.name))
const known = new Set([...scalars, ...enums.keys(), ...typeNames])

for (const t of types) {
  const fields = [...t.body.matchAll(/^\s*(\w+):\s*(\[?)(\w+)(\]?)(!?)/gm)].map((m) => ({
    name: m[1],
    list: m[2] === '[',
    type: m[3],
    required: m[5] === '!',
    line: m[0].trim(),
  }))

  // 1. Every table needs a key: an explicit key:[...] or an `id` field.
  const hasKeyArg = /key:\s*\[/.test(t.tableArgs)
  const hasId = fields.some((f) => f.name === 'id')
  if (!hasKeyArg && !hasId) {
    problems.push(`${t.name}: no primary key (no id field and no key:[...])`)
  }

  // 2. Junction / translation tables must declare a composite key.
  if (/Translation$/.test(t.name) && !hasKeyArg) {
    problems.push(`${t.name}: translation table without an explicit composite key`)
  }

  // 3. Field types must resolve.
  for (const f of fields) {
    if (!known.has(f.type)) {
      problems.push(`${t.name}.${f.name}: unknown type "${f.type}"`)
    }
  }

  // 4. Money must be Int64, never Float/Int. Heuristic: fields ending in Fils.
  for (const f of fields) {
    if (/Fils$/.test(f.name) && f.type !== 'Int64') {
      problems.push(`${t.name}.${f.name}: money must be Int64 fils, got "${f.type}"`)
    }
    if (f.type === 'Float') {
      warnings.push(`${t.name}.${f.name}: Float — never use for money or identifiers`)
    }
  }

  // 5. A table should carry SOME creation timestamp. Reference/seed tables,
  //    pure junctions, and translation children are exempt — they inherit
  //    their lifetime from a parent or are static. Alternate names like
  //    issuedAt / receivedAt / uploadedAt / grantedAt count.
  const exemptFromTimestamp =
    /Translation$/.test(t.name) ||
    ['Permission', 'RolePermission', 'UserRole', 'Governorate', 'MemberCategory',
     'PostCategory', 'DocumentCategory', 'LinkGroup', 'CertificateType', 'InvoiceLine',
    ].includes(t.name)
  const hasAnyTimestamp = fields.some((f) => f.type === 'Timestamp' && /At$/.test(f.name))
  if (!hasAnyTimestamp && !exemptFromTimestamp) {
    warnings.push(`${t.name}: no creation timestamp (createdAt / issuedAt / ...)`)
  }

  // 6. Enum defaults must be valid members.
  for (const d of t.body.matchAll(/(\w+):\s*(\w+)![^\n]*@default\(value:\s*(\w+)\)/g)) {
    const ftype = d[2]
    const val = d[3]
    if (enums.has(ftype) && !enums.get(ftype).includes(val)) {
      problems.push(`${t.name}.${d[1]}: default "${val}" not a member of enum ${ftype}`)
    }
  }
}

// 7. Financial / audit tables must not be described as updatable — flag any
//    UPDATE-looking mutation later; here just confirm append-only tables exist.
const appendOnly = ['audit_logs', 'payment_webhooks', 'payments', 'report_reviews']
for (const tbl of appendOnly) {
  const found = new RegExp(`@table\\(name:\\s*"${tbl}"`).test(src)
  if (!found) warnings.push(`expected append-only table "${tbl}" not found`)
}

// 8. Table names should be snake_case.
for (const m of src.matchAll(/@table\(name:\s*"(\w+)"/g)) {
  if (!/^[a-z][a-z0-9_]*$/.test(m[1])) problems.push(`table name "${m[1]}" is not snake_case`)
}

// 9. Every enum defined should be referenced somewhere (dead enum check).
for (const e of enums.keys()) {
  const uses = new RegExp(`:\\s*${e}!?`).test(src) || new RegExp(`\\[${e}\\]`).test(src)
  if (!uses) warnings.push(`enum ${e} is defined but never used`)
}

console.log(`Schema deep-check: ${types.length} tables, ${enums.size} enums\n`)
if (problems.length) {
  console.error('✗ PROBLEMS:')
  for (const p of problems) console.error('   ' + p)
}
if (warnings.length) {
  console.log((problems.length ? '\n' : '') + '⚠ warnings:')
  for (const w of warnings) console.log('   ' + w)
}
if (!problems.length) console.log('\n✓ No structural problems.')
process.exit(problems.length ? 1 : 0)
