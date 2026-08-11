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
import zlib from 'node:zlib'

import { createClient } from '@supabase/supabase-js'
// @next/env is CommonJS, so it has no named exports under ESM.
import nextEnv from '@next/env'

import { normalizeArabic, transliterateName } from './lib/translit.mjs'

/* ------------------------------------------------------------ xlsx reader */

/** Reads a zip container without pulling in a dependency. */
function readZip(buf) {
  const files = {}
  let end = buf.length - 22
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw new Error('Not a valid .xlsx (no zip end-of-central-directory)')

  const count = buf.readUInt16LE(end + 10)
  let off = buf.readUInt32LE(end + 16)

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const compSize = buf.readUInt32LE(off + 20)
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8')

    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const method = buf.readUInt16LE(localOff + 8)
    const start = localOff + 30 + lNameLen + lExtraLen
    const raw = buf.slice(start, start + compSize)

    files[name] = method === 0 ? raw : zlib.inflateRawSync(raw)
    off += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const unescapeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

function readSheetRows(zip) {
  const shared = []
  const ssXml = zip['xl/sharedStrings.xml']?.toString('utf8') ?? ''
  for (const si of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = ''
    for (const t of si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += t[1]
    shared.push(unescapeXml(text))
  }

  const sheetXml = zip['xl/worksheets/sheet1.xml'].toString('utf8')
  const rows = []
  for (const row of sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {}
    for (const c of row[2].matchAll(
      /<c r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>([\s\S]*?)<\/c>/g,
    )) {
      const col = c[1]
      const type = c[2]
      const inline = c[3].match(/<t[^>]*>([\s\S]*?)<\/t>/)
      const value = c[3].match(/<v>([\s\S]*?)<\/v>/)
      let out = inline ? inline[1] : value ? value[1] : ''
      if (type === 's') out = shared[Number(out)] ?? ''
      cells[col] = unescapeXml(String(out)).trim()
    }
    rows.push({ row: Number(row[1]), cells })
  }
  return rows
}

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
