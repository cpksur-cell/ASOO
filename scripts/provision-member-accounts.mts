#!/usr/bin/env node
/**
 * Give each member on the roster a login.
 *
 *   MEMBER_INITIAL_PASSWORD='…' node scripts/provision-member-accounts.mts [--dry-run] [--limit N]
 *
 * THE PASSWORD IS NEVER WRITTEN DOWN HERE. It comes from the environment, and
 * this file must not acquire a default. A shared initial credential committed
 * to a repository outlives the rollout, exists in every clone, and stays in the
 * history after it is "removed" — the one place it must not be is the thing
 * that gets cloned.
 *
 * WHAT IT CREATES, per member with a usable mobile:
 *   · a Supabase Auth user, identified by the internal address derived from
 *     their number (src/lib/member-login.ts). That address has no mailbox.
 *   · `users.must_change_password = true`, so the app refuses everything but
 *     the change-password screen until they replace it.
 *   · `members.user_id`, linking the person to the login.
 *
 * The `on_auth_user_created` trigger (migration 0008) already writes the
 * `public.users` row and grants the `member` role, so this does not repeat
 * either. The member's real name is passed as user metadata so the trigger
 * stores that rather than a display name made of phone digits.
 *
 * WHO IS SKIPPED, and why they are reported rather than guessed at:
 *   · a mobile that is not a usable Jordanian number
 *   · a mobile shared with another member — a login identity has to be unique,
 *     and choosing which of two people gets it is the syndicate's call
 *
 * IDEMPOTENT. A member who already has `user_id` is left alone, so the script
 * can be re-run after the syndicate supplies corrected numbers.
 */
import { createClient } from '@supabase/supabase-js'
import nextEnv from '@next/env'

import { memberLoginEmail } from '../src/lib/member-login.ts'

interface MemberRow {
  id: string
  membership_number: string
  phone: string | null
  user_id: string | null
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find((a) => a.startsWith('--limit'))
  const limit = limitArg ? Number(limitArg.split('=')[1] ?? args[args.indexOf(limitArg) + 1]) : Infinity

  const password = process.env.MEMBER_INITIAL_PASSWORD
  if (!password && !dryRun) {
    console.error('✗ MEMBER_INITIAL_PASSWORD is not set.')
    console.error('  Pass it in the environment; it is deliberately not stored in the repository.')
    process.exit(1)
  }
  if (password && password.length < 8) {
    console.error('✗ MEMBER_INITIAL_PASSWORD is shorter than 8 characters; Supabase will reject it.')
    process.exit(1)
  }

  nextEnv.loadEnvConfig(process.cwd())
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    process.exit(1)
  }
  const url = (() => { try { return new URL(rawUrl).origin } catch { return rawUrl } })()
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: members, error } = await sb
    .from('members')
    .select('id, membership_number, phone, user_id')
    .order('membership_number')
  if (error) throw error

  const rows = (members ?? []) as MemberRow[]

  // Names come from the Arabic translation so the account shows a person, not
  // a phone number.
  const { data: names, error: nameErr } = await sb
    .from('member_translations')
    .select('member_id, full_name')
    .eq('locale', 'ar')
  if (nameErr) throw nameErr
  const nameOf = new Map((names ?? []).map((n) => [n.member_id, n.full_name]))

  // A number held by two members cannot identify either of them.
  const timesUsed = new Map<string, number>()
  for (const m of rows) {
    if (!m.phone) continue
    timesUsed.set(m.phone, (timesUsed.get(m.phone) ?? 0) + 1)
  }

  const skippedNoMobile: MemberRow[] = []
  const skippedShared: MemberRow[] = []
  const already: MemberRow[] = []
  const todo: Array<{ member: MemberRow; email: string; name: string }> = []

  for (const m of rows) {
    if (m.user_id) { already.push(m); continue }
    const email = memberLoginEmail(m.phone)
    if (!email) { skippedNoMobile.push(m); continue }
    if ((timesUsed.get(m.phone!) ?? 0) > 1) { skippedShared.push(m); continue }
    todo.push({ member: m, email, name: nameOf.get(m.id) ?? m.membership_number })
  }

  console.log(`Members:            ${rows.length}`)
  console.log(`  already linked:   ${already.length}`)
  console.log(`  to provision:     ${todo.length}`)
  console.log(`  skipped, no usable mobile: ${skippedNoMobile.length}`)
  for (const m of skippedNoMobile) {
    console.log(`     ${m.membership_number}  ${nameOf.get(m.id) ?? ''}  (${m.phone ?? 'none'})`)
  }
  console.log(`  skipped, mobile shared with another member: ${skippedShared.length}`)
  for (const m of skippedShared) {
    console.log(`     ${m.membership_number}  ${nameOf.get(m.id) ?? ''}  (${m.phone})`)
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing created.')
    for (const t of todo.slice(0, 3)) console.log(`   would create ${t.email}  for ${t.name}`)
    return
  }

  let created = 0
  let failed = 0
  for (const t of todo.slice(0, limit)) {
    const { data, error: createErr } = await sb.auth.admin.createUser({
      email: t.email,
      password,
      // No mailbox exists to confirm through, so the address is marked
      // confirmed at creation. It is an identifier, not a contact channel.
      email_confirm: true,
      user_metadata: { display_name: t.name, preferred_locale: 'ar' },
    })

    if (createErr || !data?.user) {
      console.error(`   ✗ ${t.email}: ${createErr?.message ?? 'no user returned'}`)
      failed++
      continue
    }

    const uid = data.user.id

    // The trigger has written users + the member role by now. This is the flag
    // that makes the shared password a one-time credential rather than a
    // permanent one.
    const { error: flagErr } = await sb
      .from('users')
      .update({ must_change_password: true })
      .eq('id', uid)
    if (flagErr) {
      console.error(`   ✗ ${t.email}: account created but must_change_password NOT set — ${flagErr.message}`)
      failed++
      continue
    }

    const { error: linkErr } = await sb
      .from('members')
      .update({ user_id: uid })
      .eq('id', t.member.id)
    if (linkErr) {
      console.error(`   ✗ ${t.email}: account created but not linked to the member — ${linkErr.message}`)
      failed++
      continue
    }

    created++
    if (created % 50 === 0) console.log(`   … ${created}/${todo.length}`)
  }

  console.log(`\n✓ ${created} account(s) created`)
  if (failed) console.log(`✗ ${failed} failed — listed above`)
  console.log(`  Every one must change its password before it can do anything.`)
}

main().catch((err) => {
  console.error('✗ provisioning failed:', err.message)
  process.exitCode = 1
})
