import 'server-only'

import type { Locale } from '@/i18n/config'
import { getServiceClient } from '@/lib/supabase/server'
import type { StoredBlock } from './store'
import type { LayoutRegion } from './types'

/**
 * The CMS write path, backed by Postgres.
 *
 * The mirror of `cms-source.ts`: that file is what the public site reads, this
 * is what the admin screens write. They address the same rows, which is the
 * entire point — before this, the composer wrote to an in-memory store the
 * public pages never consulted.
 *
 * ON LOCALE
 *
 * The admin screens are themselves locale-scoped: an editor working at
 * `/ar/admin/cms/homepage` is editing the Arabic site, and at `/en/...` the
 * English one. So a text write targets one translation row, named explicitly
 * by the caller. That is narrower than the dual-locale side-by-side editor
 * docs/09-cms.md eventually wants, and it is honest about what today's UI
 * actually offers — one language at a time, the one you are looking at.
 */

const LAYOUT_CODE = 'homepage'

/* --------------------------------------------------------------- helpers */

async function layoutId(): Promise<string | null> {
  const { data, error } = await getServiceClient()
    .from('layouts')
    .select('id')
    .eq('code', LAYOUT_CODE)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

interface AdminBlockRow {
  id: string
  type: string
  region: string
  position: number
  is_published: boolean
  config: Record<string, unknown> | null
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

const ADMIN_BLOCK_SELECT =
  'id, type, region, position, is_published, config, layout_block_translations(locale, heading, subheading, body, cta_label, badge_text, secondary_cta_label, view_all_label, items)'

/** Flatten one locale's translation row into the shape the composer edits. */
function toStoredBlock(row: AdminBlockRow, locale: Locale): StoredBlock {
  const t = row.layout_block_translations?.find((x) => x.locale === locale)
  const text: StoredBlock['text'] = {}
  if (t?.heading) text.heading = t.heading
  if (t?.subheading) text.subheading = t.subheading
  if (t?.body) text.body = t.body
  if (t?.cta_label) text.ctaLabel = t.cta_label
  if (t?.badge_text) text.badgeText = t.badge_text
  if (t?.secondary_cta_label) text.secondaryCtaLabel = t.secondary_cta_label
  if (t?.view_all_label) text.viewAllLabel = t.view_all_label
  if (Array.isArray(t?.items)) text.items = t.items as unknown[]

  return {
    id: row.id,
    type: row.type,
    region: row.region as LayoutRegion,
    position: row.position,
    isPublished: row.is_published,
    config: row.config ?? {},
    text,
  }
}

/** Map the composer's flat text keys onto translation columns. */
function toTranslationColumns(text: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  return {
    heading: str(text.heading),
    subheading: str(text.subheading),
    body: str(text.body),
    cta_label: str(text.ctaLabel),
    badge_text: str(text.badgeText),
    secondary_cta_label: str(text.secondaryCtaLabel),
    view_all_label: str(text.viewAllLabel),
    items: Array.isArray(text.items) ? text.items : null,
  }
}

/* ---------------------------------------------------------------- blocks */

export async function listBlocks(locale: Locale): Promise<StoredBlock[]> {
  const id = await layoutId()
  if (!id) return []

  const { data, error } = await getServiceClient()
    .from('layout_blocks')
    .select(ADMIN_BLOCK_SELECT)
    .eq('layout_id', id)
    // Unlike the public read, the admin sees unpublished blocks too — that is
    // what the publish toggle is for.
    .order('position', { ascending: true })
  if (error) throw error

  return (data as unknown as AdminBlockRow[]).map((r) => toStoredBlock(r, locale))
}

export async function setBlockPublished(id: string, isPublished: boolean): Promise<void> {
  const { error } = await getServiceClient()
    .from('layout_blocks')
    .update({ is_published: isPublished })
    .eq('id', id)
  if (error) throw error
}

export async function updateBlockText(
  id: string,
  locale: Locale,
  text: Record<string, unknown>,
): Promise<void> {
  const { error } = await getServiceClient()
    .from('layout_block_translations')
    .upsert({ block_id: id, locale, ...toTranslationColumns(text) }, {
      onConflict: 'block_id,locale',
    })
  if (error) throw error
}

/**
 * Swap a block with its neighbour.
 *
 * Positions are swapped rather than renumbered so a reorder touches two rows
 * instead of the whole layout — and so a concurrent edit to a third block
 * cannot be clobbered by a wholesale rewrite.
 */
export async function reorderBlock(
  id: string,
  direction: 'up' | 'down',
): Promise<Array<{ id: string; position: number }>> {
  const supabase = getServiceClient()
  const layout = await layoutId()
  if (!layout) return []

  const { data, error } = await supabase
    .from('layout_blocks')
    .select('id, position, region')
    .eq('layout_id', layout)
    .order('position', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as Array<{ id: string; position: number; region: string }>
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return rows.map(({ id: rid, position }) => ({ id: rid, position }))

  const current = rows[index]!
  // Only reorder within the same region — moving a `main` block above an
  // `aside` one would be meaningless.
  const siblings = rows.filter((r) => r.region === current.region)
  const sIndex = siblings.findIndex((r) => r.id === id)
  const target = direction === 'up' ? siblings[sIndex - 1] : siblings[sIndex + 1]
  if (!target) return rows.map(({ id: rid, position }) => ({ id: rid, position }))

  // A two-step swap through a scratch value: `position` is not unique, but
  // going straight to the target's number would briefly duplicate it, which
  // makes the ordering ambiguous to any read landing in between.
  const scratch = -Math.abs(current.position) - 1
  for (const [blockId, position] of [
    [current.id, scratch],
    [target.id, current.position],
    [current.id, target.position],
  ] as Array<[string, number]>) {
    const { error: updateError } = await supabase
      .from('layout_blocks')
      .update({ position })
      .eq('id', blockId)
    if (updateError) throw updateError
  }

  return rows
    .map((r) =>
      r.id === current.id
        ? { id: r.id, position: target.position }
        : r.id === target.id
          ? { id: r.id, position: current.position }
          : { id: r.id, position: r.position },
    )
    .sort((a, b) => a.position - b.position)
}

export async function removeBlock(id: string): Promise<void> {
  // The translations go with it via ON DELETE CASCADE. A layout block is
  // configuration, not a record of an act — unlike a post, which is archived.
  const { error } = await getServiceClient().from('layout_blocks').delete().eq('id', id)
  if (error) throw error
}

/* ----------------------------------------------------------------- posts */

/**
 * Shaped to match `DemoNewsItem` so the manager renders either backend.
 *
 * `archived` is deliberately absent: an archived post is filtered out of the
 * list, exactly as the in-memory store drops it, so the editor never holds one.
 */
export interface AdminPost {
  id: string
  slug: string
  title: string
  category: string
  publishedAt: string
  status: 'draft' | 'published' | 'scheduled'
  featuredImage: string
  excerpt: string
}

interface AdminPostRow {
  id: string
  slug: string
  status: string
  published_at: string | null
  featured_image_url: string | null
  post_categories: { slug: string } | null
  post_translations: Array<{ locale: string; title: string; excerpt: string | null }>
}

const ADMIN_POST_SELECT =
  'id, slug, status, published_at, featured_image_url, post_categories(slug), post_translations(locale, title, excerpt)'

function toAdminPost(row: AdminPostRow, locale: Locale): AdminPost {
  const t =
    row.post_translations.find((x) => x.locale === locale) ?? row.post_translations[0]
  return {
    id: row.id,
    slug: row.slug,
    title: t?.title ?? row.slug,
    category: row.post_categories?.slug ?? '',
    publishedAt: (row.published_at ?? '').slice(0, 10),
    status: row.status as AdminPost['status'],
    featuredImage: row.featured_image_url ?? '',
    excerpt: t?.excerpt ?? '',
  }
}

export async function listPosts(locale: Locale): Promise<AdminPost[]> {
  const { data, error } = await getServiceClient()
    .from('posts')
    .select(ADMIN_POST_SELECT)
    .is('deleted_at', null)
    // Archived posts leave the manager's list, matching how archiving has
    // always behaved here. The difference from the in-memory store is that the
    // row survives in Postgres rather than vanishing — the syndicate's record
    // of what it published is intact even though the editor stops seeing it.
    .neq('status', 'archived')
    .order('published_at', { ascending: false })
  if (error) throw error
  return (data as unknown as AdminPostRow[]).map((r) => toAdminPost(r, locale))
}

export async function getPost(id: string, locale: Locale): Promise<AdminPost | null> {
  const { data, error } = await getServiceClient()
    .from('posts')
    .select(ADMIN_POST_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? toAdminPost(data as unknown as AdminPostRow, locale) : null
}

export async function upsertPost(
  post: {
    id: string
    slug: string
    title: string
    category: string
    publishedAt: string
    status: 'draft' | 'published' | 'scheduled'
    featuredImage: string
    excerpt: string
  },
  locale: Locale,
): Promise<void> {
  const supabase = getServiceClient()

  const { data: category, error: catError } = await supabase
    .from('post_categories')
    .select('id')
    .eq('slug', post.category)
    .maybeSingle()
  if (catError) throw catError

  const row = {
    slug: post.slug,
    category_id: category?.id ?? null,
    status: post.status,
    published_at: new Date(`${post.publishedAt}T00:00:00Z`).toISOString(),
    featured_image_url: post.featuredImage || null,
  }

  // The composer sends a client-side id for a new post. Treat an id that does
  // not resolve to a row as "create", so a stale tab cannot 404 an editor's
  // work — and match on the id we hold, never on one supplied blind.
  const existing = await getPost(post.id, locale).catch(() => null)

  let postId = existing?.id
  if (existing) {
    const { error } = await supabase.from('posts').update(row).eq('id', existing.id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('posts').insert(row).select('id').single()
    if (error) throw error
    postId = data.id as string
  }

  const { error: translationError } = await supabase.from('post_translations').upsert(
    { post_id: postId, locale, title: post.title, excerpt: post.excerpt || null },
    { onConflict: 'post_id,locale' },
  )
  if (translationError) throw translationError
}

/**
 * Archive, never delete. A destroyed announcement cannot be recovered, and the
 * syndicate's record of what it published is part of its governance.
 */
export async function archivePost(id: string): Promise<void> {
  const { error } = await getServiceClient()
    .from('posts')
    .update({ status: 'archived' })
    .eq('id', id)
  if (error) throw error
}
