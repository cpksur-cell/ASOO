#!/usr/bin/env node
/**
 * Import the syndicate's membership roster: name · file number · mobile.
 *
 *   node scripts/import-roster.mjs "<roster.xlsx>" [--dry-run] [--replace]
 *
 * SUPERSEDES `import-members.mjs`, which read the name column only. That
 * earlier roster recorded three-part names ("عاطف صالح حلاوة") where this one
 * records four ("عاطف صالح محمد حلاوة"), so the two cannot be matched by name
 * — only 11 of 387 line up. `--replace` therefore removes the rows the older
 * import created and rebuilds from this file, which is the more complete
 * record. It touches nothing it did not import: rows with a different
 * `import_source` (the demo member, anything staff added by hand) are left
 * alone, and so is everything that references them.
 *
 * COLUMNS, by position — the sheet has no header row:
 *   A  sequence number, ignored
 *   B  full name in Arabic
 *   C  syndicate FILE number (رقم ملف)
 *   D  mobile, without the national leading zero
 *
 * WHAT THE FILE NUMBER IS NOT. It is not a DLS licence number: in the supplied
 * roster 51 values repeat, 21 are placeholders ("لا يوجد رقم ملف", "غ/م") and
 * 14 are blank. It lands in `members.file_number`; `license_number` stays NULL
 * until the Department of Lands and Survey issues real ones. Placeholders are
 * imported as NULL rather than as text, because "لا يوجد رقم ملف" is a
 * statement that there is no number, not a number.
 *
 * MOBILES are stored E.164 (+9627XXXXXXXX). The sheet holds nine digits with
 * the leading zero dropped by the spreadsheet; anything that is not a
 * recognisable Jordanian mobile is imported as NULL and reported, never
 * guessed at.
 *
 * The English names are a machine transliteration and WILL contain mistakes —
 * a person's name in Latin script is theirs to spell. Every row is stamped
 * with `import_source` so staff can find and correct them.
 */
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import nextEnv from '@next/env'

import { normalizeArabic, transliterateName } from './lib/translit.mjs'
import { readZip, readSheetRows } from './lib/xlsx.mjs'
// One rule for what a usable mobile is, shared with the login form and the
// provisioning script — see the note in that file.
import { normalizeJordanMobile } from '../src/lib/member-login.ts'

/* ------------------------------------------------------------------- read */

function parseRoster(file) {
  const zip = readZip(fs.readFileSync(file))
  const rows = readSheetRows(zip)

  const out = []
  for (const { row, cells } of rows) {
    const name = (cells.B ?? '').replace(/\s+/g, ' ').trim()
    if (!name) continue

    const rawFile = (cells.C ?? '').trim()
    // A statement that no number exists is not a number.
    const fileNumber = /^\d+$/.test(rawFile) ? rawFile : null

    out.push({
      row,
      name,
      fileNumber,
      rawFile,
      mobile: normalizeJordanMobile(cells.D),
      rawMobile: (cells.D ?? '').trim(),
    })
  }
  return out
}

/* ----------------------------------------------------------------- import */

async function main() {
  const args = process.argv.slice(2)
  const file = args.find((a) => !a.startsWith('--'))
  const dryRun = args.includes('--dry-run')
  const replace = args.includes('--replace')

  if (!file) {
    console.error('Usage: node scripts/import-roster.mjs "<roster.xlsx>" [--dry-run] [--replace]')
    process.exit(1)
  }

  nextEnv.loadEnvConfig(process.cwd())
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    process.exit(1)
  }
  // The dashboard offers the REST endpoint; supabase-js appends /rest/v1 itself.
  const url = (() => { try { return new URL(rawUrl).origin } catch { return rawUrl } })()
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const source = path.basename(file)
  const roster = parseRoster(file)

  const noMobile = roster.filter((r) => !r.mobile)
  const seen = new Map()
  for (const r of roster) {
    if (!r.mobile) continue
    seen.set(r.mobile, (seen.get(r.mobile) ?? 0) + 1)
  }
  const shared = [...seen.entries()].filter(([, n]) => n > 1).map(([m]) => m)

  console.log(`Roster: ${roster.length} rows from ${source}`)
  console.log(`  file numbers:   ${roster.filter((r) => r.fileNumber).length} usable, ` +
              `${roster.filter((r) => !r.fileNumber).length} blank or placeholder`)
  console.log(`  mobiles:        ${roster.length - noMobile.length} valid, ${noMobile.length} unusable`)
  console.log(`  shared mobiles: ${shared.length} number(s) used by more than one member`)
  for (const r of noMobile) console.log(`     unusable mobile row ${r.row}: "${r.rawMobile}" — ${r.name}`)
  for (const m of shared) {
    console.log(`     shared ${m}: ${roster.filter((r) => r.mobile === m).map((r) => r.name).join('  |  ')}`)
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing written.')
    console.log('First three rows as they would be stored:')
    for (const r of roster.slice(0, 3)) {
      console.log('  ', JSON.stringify({
        name: r.name, file_number: r.fileNumber, phone: r.mobile,
        name_en: transliterateName(r.name),
      }, null, 0))
    }
    return
  }

  if (replace) {
    // Only ever the rows a roster import created. Anything with a different
    // provenance — the demo member, a hand-added record, and every order that
    // points at one — is none of this script's business.
    const { data: old, error: findErr } = await sb
      .from('members')
      .select('id, import_source')
      .not('import_source', 'is', null)
    if (findErr) throw findErr

    const ids = (old ?? []).filter((m) => m.import_source !== source).map((m) => m.id)
    if (ids.length) {
      console.log(`\nReplacing ${ids.length} rows from earlier imports…`)
      // Translations go with the member via ON DELETE CASCADE.
      for (let i = 0; i < ids.length; i += 100) {
        const { error } = await sb.from('members').delete().in('id', ids.slice(i, i + 100))
        if (error) throw error
      }
    }
  }

  const year = new Date().getFullYear()
  let written = 0
  for (const [i, r] of roster.entries()) {
    const membershipNumber = `ASOO-${year}-${String(i + 1).padStart(4, '0')}`
    const { data: member, error } = await sb
      .from('members')
      .upsert(
        {
          membership_number: membershipNumber,
          file_number: r.fileNumber,
          phone: r.mobile,
          status: 'active',
          is_directory_visible: true,
          search_normalized: normalizeArabic(r.name),
          import_source: source,
          imported_at: new Date().toISOString(),
        },
        { onConflict: 'membership_number' },
      )
      .select('id')
      .single()
    if (error) throw error

    const rows = [
      { member_id: member.id, locale: 'ar', full_name: r.name },
      { member_id: member.id, locale: 'en', full_name: transliterateName(r.name) },
    ]
    const { error: tErr } = await sb
      .from('member_translations')
      .upsert(rows, { onConflict: 'member_id,locale' })
    if (tErr) throw tErr

    written++
    if (written % 50 === 0) console.log(`  … ${written}/${roster.length}`)
  }

  console.log(`\n✓ ${written} members written from ${source}`)
  console.log('  license_number left NULL throughout — DLS issues those, not this script.')
}

main().catch((err) => {
  console.error('✗ import failed:', err.message)
  process.exitCode = 1
})
