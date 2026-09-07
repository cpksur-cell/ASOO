import 'server-only'

import type { Locale } from '@/i18n/config'
import type { AuditedOp } from '@/lib/audit/atomic'
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
    // `position` has no unique constraint, so ties are possible. Breaking them
    // by id matches how `audited_reorder_block` picks a neighbour: without it,
    // two tied blocks could be listed in one order and reordered against
    // another, and moving one up then down would not return it to where it was.
    .order('id', { ascending: true })
  if (error) throw error

  return (data as unknown as AdminBlockRow[]).map((r) => toStoredBlock(r, locale))
}

/* --------------------------------------------------------- op builders */
/*
 * These describe writes rather than performing them, so the action can hand
 * them to `withAtomicAudit` and have the change and its audit row commit in
 * one transaction. Nothing here touches the database.
 */

export function buildSetPublishedOps(id: string, isPublished: boolean): AuditedOp[] {
  return [
    {
      kind: 'update',
      table: 'layout_blocks',
      match: { id },
      values: { is_published: isPublished },
    },
  ]
}

export function buildBlockTextOps(
  id: string,
  locale: Locale,
  text: Record<string, unknown>,
): AuditedOp[] {
  return [
    {
      kind: 'upsert',
      table: 'layout_block_translations',
      match: { block_id: id, locale },
      values: toTranslationColumns(text),
    },
  ]
}

export function buildRemoveBlockOps(id: string): AuditedOp[] {
  // Translations go with it via ON DELETE CASCADE. A layout block is
  // configuration, not a record of an act — unlike a post, which is archived.
  return [{ kind: 'delete', table: 'layout_blocks', match: { id } }]
}

/**
 * Move a block one place within its region.
 *
 * This deliberately reads NOTHING. An earlier version fetched the current
 * order, worked out which two rows to swap, and emitted the position writes —
 * but that read went over its own request, outside the transaction that then
 * acted on it, so two editors reordering the same layout at the same moment
 * could each compute a swap against a layout the other had already changed.
 * The outcome was not "one of them won" but an order neither asked for, with
 * two blocks sharing a position. Migration 0015 has the worked example.
 *
 * So the decision moves to where it can be made safely: `reorder_block` names
 * the block and the direction, and `audited_reorder_block` picks the neighbour
 * having locked the parent layout row.
 *
 * The consequence worth knowing is that the caller can no longer tell in
 * advance whether the move is a no-op — a block already at the edge of its
 * region. It has to ask, and the database answers by changing nothing.
 */
export function buildReorderOps(id: string, direction: 'up' | 'down'): AuditedOp[] {
  return [{ kind: 'reorder_block', table: 'layout_blocks', match: { id }, direction }]
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

/**
 * Archive, never delete. A destroyed announcement cannot be recovered, and the
 * syndicate's record of what it published is part of its governance.
 */
export function buildArchivePostOps(id: string): AuditedOp[] {
  return [{ kind: 'update', table: 'posts', match: { id }, values: { status: 'archived' } }]
}

/**
 * Describe saving an article: the row, then its translation for this locale.
 *
 * The id is resolved by the caller so the ops can reference it — a new post
 * gets a client-generated uuid, which is safe because `slug` carries the
 * uniqueness that matters and the id is opaque.
 */
export function buildSavePostOps(
  post: {
    id: string
    slug: string
    title: string
    publishedAt: string
    status: 'draft' | 'published' | 'scheduled'
    featuredImage: string
    excerpt: string
  },
  locale: Locale,
  categoryId: string | null,
  exists: boolean,
): AuditedOp[] {
  const row = {
    slug: post.slug,
    category_id: categoryId,
    status: post.status,
    published_at: new Date(`${post.publishedAt}T00:00:00Z`).toISOString(),
    featured_image_url: post.featuredImage || null,
  }

  return [
    exists
      ? { kind: 'update', table: 'posts', match: { id: post.id }, values: row }
      : { kind: 'insert', table: 'posts', values: { id: post.id, ...row } },
    {
      kind: 'upsert',
      table: 'post_translations',
      match: { post_id: post.id, locale },
      values: { title: post.title, excerpt: post.excerpt || null },
    },
  ]
}

/** Resolves a category slug to its id. A read, so it runs before the write. */
export async function categoryIdForSlug(slug: string): Promise<string | null> {
  const { data, error } = await getServiceClient()
    .from('post_categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return (data?.id as string | undefined) ?? null
}
