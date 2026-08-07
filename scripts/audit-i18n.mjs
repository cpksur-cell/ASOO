#!/usr/bin/env node
/**
 * Standards audit: finds hardcoded user-facing strings in components.
 *
 * CLAUDE.md §2, non-negotiable #2: "No hardcoded user-facing strings — ever.
 * A literal Arabic or English string in a component is a bug."
 *
 * Catches Arabic literals anywhere in .tsx, which is the unambiguous signal.
 * English literals are harder to distinguish from class names and prop values,
 * so this reports Arabic only — in an Arabic-first codebase that is where the
 * violations actually land.
 *
 * Exits non-zero when violations exist, so it can gate CI.
 */

import { readFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'src')
const ARABIC = /[؀-ۿ]/

/**
 * Where Arabic characters are legitimate:
 *  - messages/    the dictionaries themselves
 *  - seed.ts      seeded CONTENT (news, documents), which lives in the
 *                 database in Phase 2 — content translations are rows, not
 *                 UI strings. CLAUDE.md §9.
 *  - demo.ts      throwaway demonstration fixtures, deleted in Phase 2
 *  - format.ts    Arabic character classes in the search normaliser and the
 *                 currency symbol. These are the formatter's data, and this
 *                 file IS the single place formatting is allowed to live.
 */
const ALLOW = [
  join('src', 'messages'),
  join('src', 'lib', 'data', 'seed.ts'),
  join('src', 'lib', 'data', 'demo.ts'),
  join('src', 'lib', 'data', 'member-demo.ts'),
  join('src', 'lib', 'data', 'report-demo.ts'),
  join('src', 'i18n', 'format.ts'),
  //  - config.ts    the locale registry. `localeNames` lists each language in
  //                 its OWN script ("العربية", "English") — that is the point
  //                 of a language switcher and cannot come from a dictionary.
  join('src', 'i18n', 'config.ts'),
]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full)
  }
  return out
}

const violations = []

for (const file of walk(SRC)) {
  const rel = relative(root, file)
  if (ALLOW.some((a) => rel.startsWith(a))) continue

  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (!ARABIC.test(line)) return
    const trimmed = line.trim()
    // Comments explaining Arabic behaviour are legitimate.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    violations.push({ file: rel.split(sep).join('/'), line: i + 1, text: trimmed })
  })
}

if (violations.length === 0) {
  console.log('✓ i18n: no hardcoded Arabic strings in components')
  process.exit(0)
}

const byFile = new Map()
for (const v of violations) {
  if (!byFile.has(v.file)) byFile.set(v.file, [])
  byFile.get(v.file).push(v)
}

console.error(`\n✗ i18n: ${violations.length} hardcoded Arabic string(s) — CLAUDE.md §2 forbids these.\n`)
for (const [file, items] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  ${file}  (${items.length})`)
  for (const item of items.slice(0, 6)) {
    console.error(`     ${item.line}: ${item.text.slice(0, 90)}`)
  }
  if (items.length > 6) console.error(`     … ${items.length - 6} more`)
}
console.error('\nMove them into src/messages/*.json and read via the translator.\n')
process.exit(1)
