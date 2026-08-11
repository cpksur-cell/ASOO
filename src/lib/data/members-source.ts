import 'server-only'

/**
 * The member-directory data source.
 *
 * Same pattern as reports-source.ts: one async facade over two backends behind
 * the SAME domain shapes. Supabase answers when the app is configured, and the
 * seed repository answers when it is not, so the public directory keeps
 * working on any deployment that has no database yet.
 *
 * Only members who are BOTH `active` and `is_directory_visible` are ever
 * returned. Suspension removes a member from the directory immediately — that
 * is the point of suspension (docs/06-ux-flows.md §9) — and consent is what
 * makes publication lawful, so neither check is optional.
 */

import type { Locale } from '@/i18n/config'
// The one Arabic normaliser in the codebase — the seed repository searches
// through it too, so both backends match spelling variants identically.
import { normalizeArabic } from '@/i18n/format'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServiceClient } from '@/lib/supabase/server'

import { getRepository } from './index'
import type { DirectoryMember, DirectoryQuery, Governorate, Paginated } from './types'

interface MemberRow {
  id: string
  license_number: string | null
  membership_number: string
  status: string
  category_id: string | null
  directory_phone: string | null
  directory_email: string | null
  directory_address: string | null
  joined_at: string | null
  governorates?: { id: string; code: string; name_ar: string; name_en: string } | null
  member_categories?: { name_ar: string; name_en: string } | null
  member_translations?: Array<{ locale: string; full_name: string; office_name: string | null }>
}

const SELECT =
  '*, governorates(id, code, name_ar, name_en), member_categories(name_ar, name_en), member_translations(locale, full_name, office_name)'

function mapMember(row: MemberRow, locale: Locale): DirectoryMember {
  const tr =
    row.member_translations?.find((t) => t.locale === locale) ??
    row.member_translations?.[0] ??
    null

  const gov = row.governorates
    ? {
        id: row.governorates.id,
        code: row.governorates.code,
        name: locale === 'ar' ? row.governorates.name_ar : row.governorates.name_en,
      }
    : null

  const category = row.member_categories
    ? locale === 'ar'
      ? row.member_categories.name_ar
      : row.member_categories.name_en
    : null

  return {
    id: row.id,
    // A roster member has no licence yet, so the membership number carries the
    // URL. Both are unique, so the address is stable either way.
    slug: row.license_number ?? row.membership_number,
    licenseNumber: row.license_number,
    membershipNumber: row.membership_number,
    status: row.status as DirectoryMember['status'],
    governorate: gov,
    category,
    fullName: tr?.full_name ?? row.membership_number,
    officeName: tr?.office_name ?? null,
    specializations: [],
    directoryPhone: row.directory_phone,
    directoryEmail: row.directory_email,
    directoryAddress: row.directory_address,
    joinedAt: row.joined_at ?? '',
  }
}

export async function searchDirectory(
  query: DirectoryQuery,
  locale: Locale,
): Promise<Paginated<DirectoryMember>> {
  if (!isSupabaseConfigured()) {
    return getRepository().searchDirectory(query, locale)
  }

  const { q, governorate, page = 1, perPage = 12 } = query
  const from = (page - 1) * perPage

  let builder = getServiceClient()
    .from('members')
    .select(SELECT, { count: 'exact' })
    .eq('status', 'active')
    .eq('is_directory_visible', true)

  if (governorate && governorate !== 'all') {
    // Filter through the joined table rather than resolving the id first.
    builder = builder.eq('governorates.code', governorate).not('governorate_id', 'is', null)
  }

  if (q?.trim()) {
    // `search_normalized` is written on import with the same normalisation
    // applied here, so alef/ya spelling variants match.
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
    items: (data as unknown as MemberRow[]).map((r) => mapMember(r, locale)),
    total: count ?? 0,
    page,
    perPage,
  }
}

/**
 * Look a member up by the identifier in the URL — licence number for a fully
 * recorded member, membership number for one loaded from the roster.
 */
export async function getMemberBySlug(
  slug: string,
  locale: Locale,
): Promise<DirectoryMember | null> {
  if (!isSupabaseConfigured()) {
    return getRepository().getMemberByLicense(slug, locale)
  }

  const { data, error } = await getServiceClient()
    .from('members')
    .select(SELECT)
    .eq('status', 'active')
    .eq('is_directory_visible', true)
    .or(`license_number.eq.${slug},membership_number.eq.${slug}`)
    .limit(1)
    .maybeSingle()
  if (error) throw error

  return data ? mapMember(data as unknown as MemberRow, locale) : null
}

export async function listGovernorates(locale: Locale): Promise<Governorate[]> {
  if (!isSupabaseConfigured()) return getRepository().listGovernorates(locale)

  const { data, error } = await getServiceClient()
    .from('governorates')
    .select('id, code, name_ar, name_en')
    .order('position', { ascending: true })
  if (error) throw error

  return data.map((g) => ({
    id: g.id as string,
    code: g.code as string,
    name: (locale === 'ar' ? g.name_ar : g.name_en) as string,
  }))
}
