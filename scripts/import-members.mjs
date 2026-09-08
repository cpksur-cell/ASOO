/**
 * Bulk-import the syndicate's member roster from an .xlsx file.
 *
 *   node scripts/import-members.mjs "<path to .xlsx>" [--dry-run] [--publish]
 *
 * WHAT IT DOES
 *   · Reads column B (Arabic full name) from the first worksheet.
 *   · Drops blanks and exact duplicates, keeping the first occurrence.
 *   · Assigns a sequential syndicate membership number, ASOO-<year>-####.
 *   · Leaves `license_number` NULL. Licence numbers are issued by the
 *     Department of Lands and Survey; inventing one that could later be
 *     mistaken for a real licence is not an acceptable trade for a tidy column.
 *   · Writes an Arabic and a machine-transliterated English name.
 *   · Fills `search_normalized` so Arabic search matches across alef/ta/ya
 *     spelling variants.
 *
 * SAFETY
 *   · Idempotent: keyed on `membership_number`, so re-running updates rather
 *     than duplicates. Run it twice and you still have one row per member.
 *   · `--dry-run` prints exactly what would be written and touches nothing.
 *   · The source spreadsheet holds personal data. `*.xlsx` is git-ignored;
 *     keep it out of the repository.
 *
 * The English names are a machine transliteration and WILL contain mistakes —
 * a person's name in Latin script is theirs to spell. Every imported row is
 * stamped with `import_source` so staff can find and correct them.
 */

import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
// @next/env is CommonJS, so it has no named exports under ESM.
import nextEnv from '@next/env'

import { normalizeArabic, transliterateName } from './lib/translit.mjs'
import { readZip, readSheetRows } from './lib/xlsx.mjs'

/* ----------------------------------------------------------------- import */

async function main() {
  const args = process.argv.slice(2)
  const file = args.find((a) => !a.startsWith('--'))
  const dryRun = args.includes('--dry-run')
  const publish = args.includes('--publish')

  if (!file) {
    console.error('Usage: node scripts/import-members.mjs "<file.xlsx>" [--dry-run] [--publish]')
    process.exit(1)
  }

  const zip = readZip(fs.readFileSync(file))
  const rows = readSheetRows(zip)

  const seen = new Set()
  const members = []
  let blanks = 0
  let duplicates = 0

  for (const { cells } of rows) {
    const name = (cells.B ?? '').trim()
    if (!name) {
      blanks++
      continue
    }
    const key = normalizeArabic(name)
    if (seen.has(key)) {
      duplicates++
      continue
    }
    seen.add(key)
    members.push({ fullNameAr: name, note: cells.C ?? '' })
  }

  const year = new Date().getFullYear()
  const sourceName = path.basename(file)
  const records = members.map((m, i) => ({
    membership_number: `ASOO-${year}-${String(i + 1).padStart(4, '0')}`,
    license_number: null, // issued by DLS — never invented here
    status: 'active',
    is_directory_visible: publish,
    search_normalized: normalizeArabic(m.fullNameAr),
    import_source: sourceName,
    imported_at: new Date().toISOString(),
    _ar: m.fullNameAr,
    _en: transliterateName(m.fullNameAr),
  }))

  console.log('─'.repeat(64))
  console.log(`Source            : ${sourceName}`)
  console.log(`Rows read         : ${rows.length}`)
  console.log(`Blank rows skipped: ${blanks}`)
  console.log(`Duplicates skipped: ${duplicates}`)
  console.log(`Members to import : ${records.length}`)
  console.log(`Directory visible : ${publish ? 'YES — names will be public' : 'no (staff only)'}`)
  console.log(`Licence numbers   : left NULL (DLS-issued)`)
  console.log('─'.repeat(64))
  console.log('Sample:')
  for (const r of records.slice(0, 5)) {
    console.log(`  ${r.membership_number}  ${r._ar}  →  ${r._en}`)
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing was written.')
    return
  }

  nextEnv.loadEnvConfig(process.cwd())
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('\nSupabase is not configured. See docs/11-supabase.md.')
    process.exit(1)
  }
  const supabase = createClient(new URL(url).origin, key, {
    auth: { persistSession: false },
  })

  // Upsert in batches, keyed on the membership number so a re-run updates.
  const BATCH = 100
  let written = 0
  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH)
    const payload = slice.map(({ _ar, _en, ...row }) => row)

    const { data, error } = await supabase
      .from('members')
      .upsert(payload, { onConflict: 'membership_number' })
      .select('id, membership_number')
    if (error) throw error

    const byNumber = new Map(data.map((d) => [d.membership_number, d.id]))
    const translations = slice.flatMap((r) => {
      const id = byNumber.get(r.membership_number)
      if (!id) return []
      return [
        { member_id: id, locale: 'ar', full_name: r._ar },
        { member_id: id, locale: 'en', full_name: r._en },
      ]
    })

    const { error: tErr } = await supabase
      .from('member_translations')
      .upsert(translations, { onConflict: 'member_id,locale' })
    if (tErr) throw tErr

    written += slice.length
    process.stdout.write(`\rImported ${written}/${records.length}…`)
  }

  console.log(`\n\nDone. ${written} members in the directory.`)
  if (publish) {
    console.log('These names are now PUBLIC on the site.')
  }
}

main().catch((err) => {
  console.error('\nImport failed:', err.message)
  process.exit(1)
})
