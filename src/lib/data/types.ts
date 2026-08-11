import type { Locale } from '@/i18n/config'

/**
 * Read models for the public site.
 *
 * These mirror `dataconnect/schema/schema.gql` but are shaped for rendering:
 * translations are already resolved to a single locale, so a page component
 * never handles a translations array.
 *
 * Phase 1 is served by the seed repository. Phase 2 swaps in the generated
 * Data Connect SDK behind the same interface — page code does not change.
 */

export type LocalizedText = Record<Locale, string>

export interface Governorate {
  id: string
  code: string
  name: string
}

export type MemberStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'withdrawn'

export interface DirectoryMember {
  id: string
  /**
   * The identifier this member is addressed by in the URL.
   *
   * Normally the DLS licence number. For a member loaded from the syndicate's
   * roster the licence is not yet recorded, so it falls back to the membership
   * number — a member must still be reachable at a stable address.
   */
  slug: string
  /**
   * DLS-issued. NULL when the syndicate holds the member on its roster but has
   * not recorded their licence number — see supabase/migrations/0007.
   */
  licenseNumber: string | null
  membershipNumber: string
  status: MemberStatus
  /** NULL while the member's governorate is unknown. */
  governorate: Governorate | null
  /** NULL while the member's category is unknown. */
  category: string | null
  fullName: string
  officeName: string | null
  specializations: string[]
  directoryPhone: string | null
  directoryEmail: string | null
  directoryAddress: string | null
  joinedAt: string
}

export interface PostCategory {
  id: string
  slug: string
  name: string
}

export interface Post {
  id: string
  slug: string
  publishedAt: string
  category: PostCategory | null
  title: string
  excerpt: string
  body: string | null
  featuredImage: string | null
  /** True when the requested locale had no translation and we fell back. */
  isFallback: boolean
  fallbackLocale: Locale | null
}

export interface DocumentCategory {
  id: string
  slug: string
  name: string
}

export interface SyndicateDocument {
  id: string
  slug: string
  category: DocumentCategory
  title: string
  description: string | null
  officialReference: string | null
  /** Null means the file has not been supplied yet — see Q7. */
  fileUrl: string | null
  fileSize: number | null
  mimeType: string | null
  externalUrl: string | null
}

export interface ExternalLink {
  id: string
  groupCode: 'gov_services' | 'survey_maps'
  url: string
  icon: string
  title: string
  description: string
}

/* ------------------------------------------------------------------ layout */

export type LayoutRegion = 'main' | 'aside'

export type LayoutBlockType =
  | 'hero'
  | 'stat_counters'
  | 'service_grid'
  | 'link_cards'
  | 'news_feed'
  | 'document_list'
  | 'directory_search'
  | 'rich_text'
  | 'cta_banner'

export interface LayoutBlock {
  id: string
  type: LayoutBlockType
  region: LayoutRegion
  position: number
  /** Validated against a per-type Zod schema at read time. */
  config: unknown
  text: BlockText
}

/** Translated text for a block, already resolved to the requested locale. */
export interface BlockText {
  heading?: string
  subheading?: string
  body?: string
  badgeText?: string
  ctaLabel?: string
  secondaryCtaLabel?: string
  viewAllLabel?: string
  items?: Array<{ label?: string; title?: string; description?: string }>
}

/* -------------------------------------------------------------- repository */

export interface DirectoryQuery {
  q?: string
  governorate?: string
  page?: number
  perPage?: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

/**
 * The single data boundary for the public site.
 * Phase 2 replaces the implementation, not this interface.
 */
export interface ContentRepository {
  getLayoutBlocks(layoutCode: string, locale: Locale): Promise<LayoutBlock[]>

  listPosts(locale: Locale, opts?: { limit?: number; categorySlug?: string }): Promise<Post[]>
  getPost(slug: string, locale: Locale): Promise<Post | null>
  listPostCategories(locale: Locale): Promise<PostCategory[]>

  listDocuments(locale: Locale, categorySlug?: string): Promise<SyndicateDocument[]>
  listDocumentCategories(locale: Locale): Promise<DocumentCategory[]>

  listExternalLinks(groupCode: string, locale: Locale): Promise<ExternalLink[]>

  listGovernorates(locale: Locale): Promise<Governorate[]>
  searchDirectory(query: DirectoryQuery, locale: Locale): Promise<Paginated<DirectoryMember>>
  getMemberByLicense(licenseNumber: string, locale: Locale): Promise<DirectoryMember | null>

  getPage(slug: string, locale: Locale): Promise<{ title: string; body: string } | null>
}
