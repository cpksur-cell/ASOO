import 'server-only'

/**
 * Admin-side member queries and mutations.
 *
 * Distinct from members-source.ts, which serves the PUBLIC directory and
 * therefore only ever returns active, consented members. Staff need the
 * opposite: every member regardless of status or directory visibility,
 * including the ones whose records are incomplete — those are precisely the
 * rows this screen exists to fix.
 *
 * Reads use the service client because the caller's permission has already
 * been checked at the page and again in the action. Writes go through
 * `withAudit`, never directly, so no change to a member reaches the database
 * without a row saying who made it and why.
 */

import { normalizeArabic } from '@/i18n/format'
import type { Locale } from '@/i18n/config'
import type { AuditedOp } from '@/lib/audit/atomic'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServiceClient } from '@/lib/supabase/server'

export interface AdminMember {
  id: string
  membershipNumber: string
  licenseNumber: string | null
  status: string
  isDirectoryVisible: boolean
  governorateCode: string | null
  categoryCode: string | null
  officeName: string | null
  fullNameAr: string
  fullNameEn: string
  importSource: string | null
  /** True when a field the directory needs is still missing. */
  incomplete: boolean
}

export interface AdminMemberQuery {
  q?: string
  status?: string
  governorate?: string
  /** Restrict to records still missing directory-critical fields. */
  incompleteOnly?: boolean
  page?: number
  perPage?: number
}

const SELECT =
  'id, membership_number, license_number, status, is_directory_visible, import_source,' +
  ' governorates(code), member_categories(code),' +
  ' member_translations(locale, full_name, office_name)'

interface Row {
  id: string
  membership_number: string
  license_number: string | null
  status: string
  is_directory_visible: boolean
  import_source: string | null
  governorates?: { code: string } | null
  member_categories?: { code: string } | null
  member_translations?: Array<{ locale: string; full_name: string; office_name: string | null }>
}

function mapRow(row: Row): AdminMember {
  const ar = row.member_translations?.find((t) => t.locale === 'ar')
  const en = row.member_translations?.find((t) => t.locale === 'en')
  const governorateCode = row.governorates?.code ?? null

  return {
    id: row.id,
    membershipNumber: row.membership_number,
    licenseNumber: row.license_number,
    status: row.status,
    isDirectoryVisible: row.is_directory_visible,
    governorateCode,
    categoryCode: row.member_categories?.code ?? null,
    officeName: ar?.office_name ?? en?.office_name ?? null,
    fullNameAr: ar?.full_name ?? '',
    fullNameEn: en?.full_name ?? '',
    importSource: row.import_source,
    // What the public directory needs to be genuinely useful: a governorate to
    // filter by and a licence number to identify the member by.
    incomplete: !governorateCode || !row.license_number,
  }
}

export async function listAdminMembers(query: AdminMemberQuery): Promise<{
  items: AdminMember[]
  total: number
  page: number
  perPage: number
}> {
  const { q, status, governorate, incompleteOnly, page = 1, perPage = 25 } = query
  const empty = { items: [], total: 0, page, perPage }
  if (!isSupabaseConfigured()) return empty

  const from = (page - 1) * perPage
  let builder = getServiceClient().from('members').select(SELECT, { count: 'exact' })

  if (status && status !== 'all') builder = builder.eq('status', status)
  if (governorate && governorate !== 'all') {
    builder = builder.eq('governorates.code', governorate).not('governorate_id', 'is', null)
  }
  // "Incomplete" means no licence OR no governorate; the licence half can be
  // expressed in the query, and the governorate half is filtered after mapping
  // because it lives behind a join.
  if (incompleteOnly) builder = builder.is('license_number', null)

  if (q?.trim()) {
    const needle = normalizeArabic(q)
    builder = builder.or(
      `search_normalized.ilike.%${needle}%,membership_number.ilike.%${q.trim()}%,license_number.ilike.%${q.trim()}%`,
    )
  }

  const { data, error, count } = await builder
    .order('membership_number', { ascending: true })
    .range(from, from + perPage - 1)
  if (error) throw error

  return {
    items: (data as unknown as Row[]).map(mapRow),
    total: count ?? 0,
    page,
    perPage,
  }
}

/** Reference data for the edit form's selects. */
export async function listMemberCategories(
  locale: Locale,
): Promise<Array<{ code: string; name: string }>> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await getServiceClient()
    .from('member_categories')
    .select('code, name_ar, name_en')
    .eq('is_active', true)
  if (error) throw error
  return data.map((c) => ({
    code: c.code as string,
    name: (locale === 'ar' ? c.name_ar : c.name_en) as string,
  }))
}

/* ---------------------------------------------------------------- mutations */

export interface MemberPatch {
  licenseNumber?: string | null
  governorateCode?: string | null
  categoryCode?: string | null
  status?: string
  isDirectoryVisible?: boolean
  fullNameAr?: string
  fullNameEn?: string
  officeNameAr?: string | null
  officeNameEn?: string | null
}

/** Resolves a governorate/category code to its id, or null to clear it. */
async function resolveId(
  table: 'governorates' | 'member_categories',
  code: string | null | undefined,
): Promise<string | null | undefined> {
  if (code === undefined) return undefined
  if (code === null || code === '') return null
  const { data, error } = await getServiceClient()
    .from(table)
    .select('id')
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  return (data?.id as string | undefined) ?? null
}

/** The member row as it was, for the audit trail's `before` snapshot. */
export async function getAdminMember(id: string): Promise<AdminMember | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await getServiceClient()
    .from('members')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data as unknown as Row) : null
}

/** The `members` columns a patch touches, with codes already resolved to ids. */
async function memberRow(patch: MemberPatch): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = {}
  if (patch.licenseNumber !== undefined) {
    // Empty means "still not recorded", which is NULL — not an empty string,
    // which would collide with every other blank under the unique index.
    row.license_number = patch.licenseNumber?.trim() ? patch.licenseNumber.trim() : null
  }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.isDirectoryVisible !== undefined) row.is_directory_visible = patch.isDirectoryVisible

  // Reference lookups, not writes — safe to resolve before the transaction.
  const govId = await resolveId('governorates', patch.governorateCode)
  if (govId !== undefined) row.governorate_id = govId
  const catId = await resolveId('member_categories', patch.categoryCode)
  if (catId !== undefined) row.category_id = catId

  // Keep the Arabic search key in step with the Arabic name.
  if (patch.fullNameAr !== undefined) row.search_normalized = normalizeArabic(patch.fullNameAr)

  return row
}

/**
 * Describe a single member correction as operations, for `withAtomicAudit`.
 *
 * These are BUILT, not executed. The caller hands them to `audited_write`,
 * which applies them and records the audit row in one transaction — so a
 * correction to a membership record can never land without its trail.
 *
 * Only fields the caller actually sent are included. That is not tidiness: the
 * previous version wrote `full_name: patch.fullNameAr ?? ''` whenever EITHER
 * the name or the office was present, so a call carrying only an office name
 * blanked the member's Arabic name. The admin form always sends both, so it
 * was unreachable there — but a server action is a public HTTP endpoint, and
 * `{ id, officeNameAr }` was enough to erase a real person's name.
 */
export async function buildMemberUpdateOps(
  id: string,
  patch: MemberPatch,
): Promise<AuditedOp[]> {
  const ops: AuditedOp[] = []

  const row = await memberRow(patch)
  if (Object.keys(row).length > 0) {
    ops.push({ kind: 'update', table: 'members', match: { id }, values: row })
  }

  for (const [locale, name, office] of [
    ['ar', patch.fullNameAr, patch.officeNameAr],
    ['en', patch.fullNameEn, patch.officeNameEn],
  ] as const) {
    if (name === undefined && office === undefined) continue

    const values: Record<string, unknown> = {}
    if (name !== undefined) values.full_name = name
    if (office !== undefined) values.office_name = office === '' ? null : office

    // `full_name` is NOT NULL, so a row that does not exist yet cannot be
    // created from an office name alone. Update it if it is there; only insert
    // when we actually have the name the column requires.
    ops.push({
      kind: name === undefined ? 'update' : 'upsert',
      table: 'member_translations',
      match: { member_id: id, locale },
      values,
    })
  }

  return ops
}

/**
 * Describe the same change applied to many members.
 *
 * One operation per member rather than a single `IN` update. It costs more
 * statements inside the one transaction, and buys a per-member before/after
 * snapshot in the audit row — so after a 400-row bulk edit you can see exactly
 * what each record used to say, not just which ids were in the batch.
 */
export async function buildBulkMemberOps(
  ids: string[],
  patch: Pick<MemberPatch, 'governorateCode' | 'categoryCode' | 'status' | 'isDirectoryVisible'>,
): Promise<AuditedOp[]> {
  if (ids.length === 0) return []
  const row = await memberRow(patch)
  if (Object.keys(row).length === 0) return []
  return ids.map((id) => ({
    kind: 'update' as const,
    table: 'members',
    match: { id },
    values: row,
  }))
}
