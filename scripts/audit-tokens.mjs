#!/usr/bin/env node
/**
 * Verifies every semantic token referenced in a component actually exists.
 *
 * This exists because `bg-surface-muted` shipped across eight files while no
 * such token was ever defined. Tailwind emits nothing for an unknown utility,
 * so the background silently rendered transparent — no error, no warning, and
 * nothing in review to catch it.
 *
 * Scans for the semantic namespaces components are supposed to consume, then
 * checks each against the generated CSS.
 *
 * Exits non-zero on any unknown token, so it can gate CI.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CSS = join(root, 'src/app/tokens.generated.css')
const SRC = join(root, 'src')

const css = readFileSync(CSS, 'utf8')
const defined = new Set(
  [...css.matchAll(/^\s*(--color-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
)

/**
 * Utility prefix -> token namespace. Only the semantic layer is checked;
 * primitive ramps (bg-primary-700) are legitimate in a few places.
 */
const NAMESPACES = [
  { util: 'surface', token: 'surface' },
  { util: 'text', token: 'text' },
  { util: 'border', token: 'border' },
  { util: 'status', token: 'status' },
]

const PATTERN = new RegExp(
  `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|shadow)-` +
    `(${NAMESPACES.map((n) => n.util).join('|')})-([a-z0-9-]+)`,
  'g',
)

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx$/.test(entry)) out.push(full)
  }
  return out
}

const unknown = new Map()

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8')
  const rel = relative(root, file).split(sep).join('/')

  for (const match of text.matchAll(PATTERN)) {
    const [full, ns, rest] = match
    // Strip a Tailwind opacity modifier: bg-surface-sunken/20
    const name = `--color-${ns}-${rest.split('/')[0]}`
    if (defined.has(name)) continue

    // `text-text-*` and friends collide with real utilities like `text-sm`;
    // only flag when the namespace is genuinely one of ours.
    if (!defined.has(`--color-${ns}-primary`) && !defined.has(`--color-${ns}-default`)) continue

    if (!unknown.has(full)) unknown.set(full, new Set())
    unknown.get(full).add(rel)
  }
}

if (unknown.size === 0) {
  console.log(`✓ Tokens: every semantic token used in components is defined (${defined.size} available)`)
  process.exit(0)
}

console.error(`\n✗ Tokens: ${unknown.size} undefined semantic token(s) used in components.\n`)
for (const [util, files] of unknown) {
  console.error(`  ${util}`)
  for (const f of files) console.error(`     ${f}`)
}
console.error('\nTailwind emits nothing for these — they render as no style at all.')
console.error('Define them in design/tokens.json or use an existing semantic token.\n')
process.exit(1)
