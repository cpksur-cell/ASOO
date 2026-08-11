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

export async function updateMember(id: string, patch: MemberPatch): Promise<AdminMember | null> {
  const supabase = getServiceClient()

  const row: Record<string, unknown> = {}
  if (patch.licenseNumber !== undefined) {
    // Empty means "still not recorded", which is NULL — not an empty string,
    // which would collide with every other blank under the unique index.
    row.license_number = patch.licenseNumber?.trim() ? patch.licenseNumber.trim() : null
  }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.isDirectoryVisible !== undefined) row.is_directory_visible = patch.isDirectoryVisible

  const govId = await resolveId('governorates', patch.governorateCode)
  if (govId !== undefined) row.governorate_id = govId
  const catId = await resolveId('member_categories', patch.categoryCode)
  if (catId !== undefined) row.category_id = catId

  // Keep the Arabic search key in step with the Arabic name.
  if (patch.fullNameAr !== undefined) row.search_normalized = normalizeArabic(patch.fullNameAr)

  if (Object.keys(row).length > 0) {
    const { error } = await supabase.from('members').update(row).eq('id', id)
    if (error) throw error
  }

  const translations: Array<Record<string, unknown>> = []
  if (patch.fullNameAr !== undefined || patch.officeNameAr !== undefined) {
    translations.push({
      member_id: id,
      locale: 'ar',
      full_name: patch.fullNameAr ?? '',
      office_name: patch.officeNameAr ?? null,
    })
  }
  if (patch.fullNameEn !== undefined || patch.officeNameEn !== undefined) {
    translations.push({
      member_id: id,
      locale: 'en',
      full_name: patch.fullNameEn ?? '',
      office_name: patch.officeNameEn ?? null,
    })
  }
  if (translations.length > 0) {
    const { error } = await supabase
      .from('member_translations')
      .upsert(translations, { onConflict: 'member_id,locale' })
    if (error) throw error
  }

  return getAdminMember(id)
}

/**
 * Apply the same change to many members at once — the point of the screen,
 * since the roster arrived with several hundred rows missing the same fields.
 */
export async function bulkUpdateMembers(
  ids: string[],
  patch: Pick<MemberPatch, 'governorateCode' | 'categoryCode' | 'status' | 'isDirectoryVisible'>,
): Promise<number> {
  if (ids.length === 0) return 0

  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.isDirectoryVisible !== undefined) row.is_directory_visible = patch.isDirectoryVisible

  const govId = await resolveId('governorates', patch.governorateCode)
  if (govId !== undefined) row.governorate_id = govId
  const catId = await resolveId('member_categories', patch.categoryCode)
  if (catId !== undefined) row.category_id = catId

  if (Object.keys(row).length === 0) return 0

  const { error } = await getServiceClient().from('members').update(row).in('id', ids)
  if (error) throw error
  return ids.length
}
