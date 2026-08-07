import 'server-only'

import type { Locale } from '@/i18n/config'
import { normalizeArabic } from '@/i18n/format'
import * as seed from './seed'
import type {
  ContentRepository,
  DirectoryMember,
  DirectoryQuery,
  DocumentCategory,
  ExternalLink,
  Governorate,
  LayoutBlock,
  Paginated,
  Post,
  PostCategory,
  SyndicateDocument,
  BlockText,
} from './types'

/**
 * Phase 1 implementation, backed by in-memory seed data.
 *
 * Phase 2 replaces this file with a Data Connect implementation of the same
 * `ContentRepository` interface. No page component changes.
 */

type L = Record<Locale, string>
const pick = (v: L, locale: Locale) => v[locale]

/* ------------------------------------------------------------------ helpers */

function toGovernorate(g: (typeof seed.governorates)[number], locale: Locale): Governorate {
  return { id: g.id, code: g.code, name: pick(g.name, locale) }
}

function toMember(m: (typeof seed.members)[number], locale: Locale): DirectoryMember {
  const gov = seed.governorates.find((g) => g.code === m.governorateCode)!
  return {
    id: m.id,
    licenseNumber: m.licenseNumber,
    membershipNumber: m.membershipNumber,
    status: m.status,
    governorate: toGovernorate(gov, locale),
    category: pick(m.category, locale),
    fullName: pick(m.fullName, locale),
    officeName: pick(m.officeName, locale),
    specializations: m.specializations[locale],
    directoryPhone: m.phone,
    directoryEmail: m.email,
    directoryAddress: pick(m.address, locale),
    joinedAt: m.joinedAt,
  }
}

/** Resolve a block's per-locale text bundle down to a single locale. */
function resolveBlockText(
  text: Record<string, unknown> | undefined,
  locale: Locale,
): BlockText {
  if (!text) return {}
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(text)) {
    if (key === 'items' && Array.isArray(value)) {
      out.items = value.map((item) => {
        const resolved: Record<string, string> = {}
        for (const [k, v] of Object.entries(item as Record<string, L>)) {
          resolved[k] = pick(v, locale)
        }
        return resolved
      })
    } else if (value && typeof value === 'object') {
      out[key] = pick(value as L, locale)
    }
  }

  return out as BlockText
}

/* --------------------------------------------------------------- repository */

export const seedRepository: ContentRepository = {
  async getLayoutBlocks(layoutCode, locale): Promise<LayoutBlock[]> {
    if (layoutCode !== 'homepage') return []
    return seed.homepageBlocks
      .map((b) => ({
        id: b.id,
        type: b.type,
        region: b.region,
        position: b.position,
        config: b.config,
        text: resolveBlockText(b.text as Record<string, unknown>, locale),
      }))
      .sort((a, b) => a.position - b.position)
  },

  async listPosts(locale, opts): Promise<Post[]> {
    let items = [...seed.posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    if (opts?.categorySlug) items = items.filter((p) => p.categorySlug === opts.categorySlug)
    if (opts?.limit) items = items.slice(0, opts.limit)
    return items.map((p) => toPost(p, locale))
  },

  async getPost(slug, locale): Promise<Post | null> {
    const p = seed.posts.find((x) => x.slug === slug)
    return p ? toPost(p, locale) : null
  },

  async listPostCategories(locale): Promise<PostCategory[]> {
    return seed.postCategories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: pick(c.name, locale),
    }))
  },

  async listDocuments(locale, categorySlug): Promise<SyndicateDocument[]> {
    const cats = await this.listDocumentCategories(locale)
    return seed.documents
      .filter((d) => !categorySlug || d.categorySlug === categorySlug)
      .map((d) => ({
        id: d.id,
        slug: d.slug,
        category: cats.find((c) => c.slug === d.categorySlug)!,
        title: pick(d.title, locale),
        description: pick(d.description, locale),
        officialReference: d.officialReference,
        fileUrl: d.fileUrl,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        externalUrl: d.externalUrl,
      }))
  },

  async listDocumentCategories(locale): Promise<DocumentCategory[]> {
    return seed.documentCategories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: pick(c.name, locale),
    }))
  },

  async listExternalLinks(groupCode, locale): Promise<ExternalLink[]> {
    return seed.externalLinks
      .filter((l) => l.groupCode === groupCode)
      .map((l) => ({
        id: l.id,
        groupCode: l.groupCode,
        url: l.url,
        icon: l.icon,
        title: pick(l.title, locale),
        description: pick(l.description, locale),
      }))
  },

  async listGovernorates(locale): Promise<Governorate[]> {
    return seed.governorates.map((g) => toGovernorate(g, locale))
  },

  async searchDirectory(query: DirectoryQuery, locale): Promise<Paginated<DirectoryMember>> {
    const { q, governorate, page = 1, perPage = 12 } = query

    // Only active members with directory consent are ever public.
    // Suspension removes a member from the directory immediately — that is
    // the point of suspension. docs/06-ux-flows.md §9.
    let rows = seed.members.filter((m) => m.status === 'active')

    if (governorate && governorate !== 'all') {
      rows = rows.filter((m) => m.governorateCode === governorate)
    }

    if (q?.trim()) {
      // Normalise BOTH sides. Without this "احمد" does not match "أحمد".
      const needle = normalizeArabic(q)
      rows = rows.filter((m) => {
        const haystack = [
          m.fullName.ar, m.fullName.en,
          m.officeName.ar, m.officeName.en,
          m.licenseNumber, m.membershipNumber,
        ]
          .map(normalizeArabic)
          .join(' ')
        return haystack.includes(needle)
      })
    }

    const total = rows.length
    const start = (page - 1) * perPage
    return {
      items: rows.slice(start, start + perPage).map((m) => toMember(m, locale)),
      total,
      page,
      perPage,
    }
  },

  async getMemberByLicense(licenseNumber, locale): Promise<DirectoryMember | null> {
    const m = seed.members.find(
      (x) => x.licenseNumber.toLowerCase() === licenseNumber.toLowerCase(),
    )
    if (!m || m.status !== 'active') return null
    return toMember(m, locale)
  },

  async getPage(slug, locale) {
    const p = seed.pages[slug]
    return p ? { title: pick(p.title, locale), body: pick(p.body, locale) } : null
  },
}

function toPost(p: (typeof seed.posts)[number], locale: Locale): Post {
  const cat = seed.postCategories.find((c) => c.slug === p.categorySlug)
  return {
    id: p.id,
    slug: p.slug,
    publishedAt: p.publishedAt,
    category: cat ? { id: cat.id, slug: cat.slug, name: pick(cat.name, locale) } : null,
    title: pick(p.title, locale),
    excerpt: pick(p.excerpt, locale),
    body: p.body,
    featuredImage: p.featuredImage,
    isFallback: false,
    fallbackLocale: null,
  }
}
