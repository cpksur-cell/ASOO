import 'server-only'

import type { Locale } from '@/i18n/config'
import { getServiceClient } from '@/lib/supabase/server'
import type {
  BlockText,
  LayoutBlock,
  LayoutBlockType,
  LayoutRegion,
  Post,
  PostCategory,
} from './types'

/**
 * The CMS read path, backed by Postgres.
 *
 * This is the half of the content model an editor actually controls: the
 * homepage composition and the news articles. Until now the admin screens
 * wrote to an in-memory store while these pages read the seed module, so an
 * editor could publish a homepage nobody would ever see. These functions are
 * what close that loop.
 *
 * Everything here reads with the SERVICE client rather than the anon client.
 * Not for privilege — the RLS policies already allow anonymous reads of
 * published blocks and published posts — but because these run in server
 * components where there is no user session to carry, and going through the
 * same client as the rest of the data layer keeps one code path.
 */

/* ---------------------------------------------------------------- shapes */

interface BlockRow {
  id: string
  type: string
  region: string
  position: number
  config: unknown
  layout_block_translations: Array<{
    locale: string
    heading: string | null
    subheading: string | null
    body: string | null
    cta_label: string | null
    badge_text: string | null
    secondary_cta_label: string | null
    view_all_label: string | null
    items: unknown
  }>
}

interface PostRow {
  id: string
  slug: string
  published_at: string | null
  featured_image_url: string | null
  post_categories: { id: string; slug: string; name_ar: string; name_en: string } | null
  post_translations: Array<{
    locale: string
    title: string
    excerpt: string | null
    body: string | null
  }>
}

/* --------------------------------------------------------------- mappers */

/** Drop nulls so `BlockText` carries only fields the editor actually filled. */
function mapBlockText(
  rows: BlockRow['layout_block_translations'],
  locale: Locale,
): BlockText {
  const row = rows.find((r) => r.locale === locale)
  if (!row) return {}

  const text: BlockText = {}
  if (row.heading) text.heading = row.heading
  if (row.subheading) text.subheading = row.subheading
  if (row.body) text.body = row.body
  if (row.cta_label) text.ctaLabel = row.cta_label
  if (row.badge_text) text.badgeText = row.badge_text
  if (row.secondary_cta_label) text.secondaryCtaLabel = row.secondary_cta_label
  if (row.view_all_label) text.viewAllLabel = row.view_all_label
  if (Array.isArray(row.items)) text.items = row.items as BlockText['items']
  return text
}

function mapPost(row: PostRow, locale: Locale): Post {
  /*
   * Locale fallback. An article translated only into Arabic must still be
   * reachable at /en — showing the Arabic with a notice beats a 404 or a
   * blank card. `isFallback` is what the article page uses to render that
   * notice, so the reader knows why the language changed under them.
   */
  const wanted = row.post_translations.find((t) => t.locale === locale)
  const other = row.post_translations.find((t) => t.locale !== locale)
  const t = wanted ?? other
  const isFallback = !wanted && Boolean(other)

  const cat = row.post_categories

  return {
    id: row.id,
    slug: row.slug,
    // Date only: the rest of the app formats a plain date, and a timestamp
    // here would drag the article's display time into the reader's timezone.
    publishedAt: (row.published_at ?? '').slice(0, 10),
    category: cat
      ? { id: cat.id, slug: cat.slug, name: locale === 'ar' ? cat.name_ar : cat.name_en }
      : null,
    title: t?.title ?? row.slug,
    excerpt: t?.excerpt ?? '',
    body: t?.body ?? null,
    featuredImage: row.featured_image_url,
    isFallback,
    fallbackLocale: isFallback ? ((other?.locale as Locale) ?? null) : null,
  }
}

const BLOCK_SELECT =
  'id, type, region, position, config, layout_block_translations(locale, heading, subheading, body, cta_label, badge_text, secondary_cta_label, view_all_label, items)'

const POST_SELECT =
  'id, slug, published_at, featured_image_url, post_categories(id, slug, name_ar, name_en), post_translations(locale, title, excerpt, body)'

/* ----------------------------------------------------------------- reads */

export async function getLayoutBlocks(
  layoutCode: string,
  locale: Locale,
): Promise<LayoutBlock[]> {
  const supabase = getServiceClient()

  const { data: layout, error: layoutError } = await supabase
    .from('layouts')
    .select('id')
    .eq('code', layoutCode)
    .maybeSingle()
  if (layoutError) throw layoutError
  if (!layout) return []

  const { data, error } = await supabase
    .from('layout_blocks')
    .select(BLOCK_SELECT)
    .eq('layout_id', layout.id)
    // Only published blocks reach the public site. An unpublished block is an
    // editor's work in progress, not content.
    .eq('is_published', true)
    .order('position', { ascending: true })
  if (error) throw error

  return (data as unknown as BlockRow[]).map((row) => ({
    id: row.id,
    type: row.type as LayoutBlockType,
    region: row.region as LayoutRegion,
    position: row.position,
    config: row.config,
    text: mapBlockText(row.layout_block_translations ?? [], locale),
  }))
}

export async function listPosts(
  locale: Locale,
  opts?: { limit?: number; categorySlug?: string },
): Promise<Post[]> {
  let query = getServiceClient()
    .from('posts')
    .select(POST_SELECT)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })

  if (opts?.categorySlug) {
    query = query.eq('post_categories.slug', opts.categorySlug)
  }
  if (opts?.limit) query = query.limit(opts.limit)

  const { data, error } = await query
  if (error) throw error

  const rows = data as unknown as PostRow[]
  return (
    opts?.categorySlug
      ? // An inner filter on an embedded table nulls the relation rather than
        // dropping the row, so the row still comes back with no category.
        rows.filter((r) => r.post_categories?.slug === opts.categorySlug)
      : rows
  ).map((r) => mapPost(r, locale))
}

export async function getPost(slug: string, locale: Locale): Promise<Post | null> {
  const { data, error } = await getServiceClient()
    .from('posts')
    .select(POST_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data ? mapPost(data as unknown as PostRow, locale) : null
}

export async function listPostCategories(locale: Locale): Promise<PostCategory[]> {
  const { data, error } = await getServiceClient()
    .from('post_categories')
    .select('id, slug, name_ar, name_en')
    .order('position', { ascending: true })
  if (error) throw error

  return (data ?? []).map((c) => ({
    id: c.id as string,
    slug: c.slug as string,
    name: (locale === 'ar' ? c.name_ar : c.name_en) as string,
  }))
}
