'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
import { withAtomicAudit } from '@/lib/audit/atomic'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import * as cms from '@/lib/data/cms-admin'
import {
  archiveStoredPost,
  listStoredBlocks,
  listStoredPosts,
  getStoredPost,
  removeStoredBlock,
  reorderStoredBlock,
  setStoredBlockPublished,
  updateStoredBlockText,
  upsertStoredPost,
} from '@/lib/data/store'
import type { Locale } from '@/i18n/config'

/**
 * Which backend a mutation lands in.
 *
 * With Supabase configured these write the same rows the public site reads,
 * so an edit here appears there — the whole point of wiring the CMS. Without
 * credentials they fall back to the in-memory store, and the admin screens
 * still demo exactly as before.
 */
const live = () => isSupabaseConfigured()

/**
 * The locale a text edit targets.
 *
 * The admin screens are locale-scoped — editing at `/ar/admin` edits the
 * Arabic site. The client passes the locale it is rendered in; anything else
 * falls back to Arabic, the default locale (CLAUDE.md §2 #1).
 */
const localeOf = (value: unknown): Locale => (value === 'en' ? 'en' : 'ar')

/**
 * Admin mutations for the CMS.
 *
 * Every export follows the same three steps, in this order and no other:
 *
 *   1. assertPermission()  — layer 2 of docs/08-security.md §3. Server actions
 *                            are public HTTP endpoints; a hidden button in the
 *                            UI is not access control.
 *   2. withAudit()         — CLAUDE.md §2 #5, non-negotiable
 *   3. revalidatePath()    — the public site reflects the change
 *
 * Input is parsed with Zod at the boundary. An action argument arrives from
 * the network and is untrusted, exactly like a request body.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'INVALID' | 'NOT_FOUND' }

async function guard<T>(
  resource: string,
  action: string,
  run: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    await assertPermission(resource, action)
    return { ok: true, data: await run() }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    throw err
  }
}

/** Revalidate both locales — a CMS edit changes the Arabic and English pages. */
function revalidatePublic(paths: string[]) {
  for (const locale of ['ar', 'en']) {
    for (const p of paths) {
      revalidatePath(`/${locale}${p}`)
    }
  }
}

/* ----------------------------------------------------------------- blocks */

const reorderSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(['up', 'down']),
  locale: z.string().optional(),
})

export async function reorderBlockAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = reorderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id, direction } = parsed.data

  return guard('layout', 'manage', async () => {
    if (live()) {
      const ops = await cms.buildReorderOps(id, direction)
      if (ops.length === 0) return
      await withAtomicAudit(
        { action: 'layout.reorder', entityType: 'layout_block', entityId: id },
        ops,
      )
    } else {
      const before = listStoredBlocks().map((b) => ({ id: b.id, position: b.position }))
      await withAudit(
        { action: 'layout.reorder', entityType: 'layout_block', entityId: id, before },
        async () =>
          reorderStoredBlock(id, direction).map((b) => ({ id: b.id, position: b.position })),
      )
    }
    revalidatePublic([''])
  })
}

const publishSchema = z.object({
  id: z.string().min(1),
  isPublished: z.boolean(),
})

export async function setBlockPublishedAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = publishSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id, isPublished } = parsed.data

  return guard('layout', 'manage', async () => {
    const ctx = {
      action: isPublished ? 'layout.publish' : 'layout.unpublish',
      entityType: 'layout_block',
      entityId: id,
    }
    if (live()) {
      await withAtomicAudit(ctx, cms.buildSetPublishedOps(id, isPublished))
    } else {
      await withAudit(ctx, async () => setStoredBlockPublished(id, isPublished))
    }
    revalidatePublic([''])
  })
}

const blockTextSchema = z.object({
  id: z.string().min(1),
  text: z.record(z.string(), z.unknown()),
  locale: z.string().optional(),
})

export async function updateBlockTextAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = blockTextSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id, text } = parsed.data
  const locale = localeOf(parsed.data.locale)

  return guard('layout', 'manage', async () => {
    if (live()) {
      await withAtomicAudit(
        { action: 'layout.update', entityType: 'layout_block', entityId: id },
        cms.buildBlockTextOps(id, locale, text),
      )
    } else {
      const before = listStoredBlocks().find((b) => b.id === id)?.text ?? null
      await withAudit(
        { action: 'layout.update', entityType: 'layout_block', entityId: id, before },
        async () => updateStoredBlockText(id, text),
      )
    }
    revalidatePublic([''])
  })
}

export async function removeBlockAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = z
    .object({ id: z.string().min(1), locale: z.string().optional() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id } = parsed.data

  return guard('layout', 'manage', async () => {
    if (live()) {
      // The deleted row is captured by the database itself as `before`, so the
      // trail records exactly what was removed.
      await withAtomicAudit(
        { action: 'layout.remove', entityType: 'layout_block', entityId: id },
        cms.buildRemoveBlockOps(id),
      )
    } else {
      // Capture the block before it goes — a removal with no record of what
      // was removed is not an audit trail. In live mode the database does this
      // itself, inside the transaction.
      const before = listStoredBlocks().find((b) => b.id === id) ?? null
      await withAudit(
        { action: 'layout.remove', entityType: 'layout_block', entityId: id, before },
        async () => removeStoredBlock(id),
      )
    }
    revalidatePublic([''])
  })
}

/* ------------------------------------------------------------------ posts */

const postSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .min(1)
    // ASCII only. Arabic titles are transliterated or given an explicit slug —
    // an Arabic slug becomes a percent-encoded URL nobody can read or share.
    // CLAUDE.md §4.
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase ASCII with hyphens'),
  title: z.string().min(1).max(200),
  category: z.string().min(1),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['draft', 'published', 'scheduled']),
  featuredImage: z.string(),
  excerpt: z.string().max(600),
  locale: z.string().optional(),
})

export async function savePostAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = postSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { locale: rawLocale, ...post } = parsed.data
  const locale = localeOf(rawLocale)

  return guard('posts', 'write', async () => {
    const before = live() ? await cms.getPost(post.id, locale) : getStoredPost(post.id)
    const ctx = {
      action: before ? 'post.update' : 'post.create',
      entityType: 'post',
      entityId: post.id,
    }

    if (live()) {
      // Reads first — resolving the category and checking existence are
      // lookups, not writes, so they belong outside the transaction.
      const categoryId = await cms.categoryIdForSlug(post.category)
      await withAtomicAudit(
        ctx,
        cms.buildSavePostOps(post, locale, categoryId, Boolean(before)),
      )
    } else {
      await withAudit({ ...ctx, before }, async () => upsertStoredPost(post))
    }
    revalidatePublic(['', '/news', `/news/${post.slug}`])
  })
}

/**
 * Archives, never deletes. A destroyed announcement cannot be recovered, and
 * the syndicate's record of what it published is part of its governance.
 */
export async function archivePostAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = z
    .object({ id: z.string().min(1), locale: z.string().optional() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id } = parsed.data
  const locale = localeOf(parsed.data.locale)

  return guard('posts', 'publish', async () => {
    const before = live() ? await cms.getPost(id, locale) : getStoredPost(id)
    if (!before) return
    if (live()) {
      await withAtomicAudit(
        { action: 'post.archive', entityType: 'post', entityId: id },
        cms.buildArchivePostOps(id),
      )
    } else {
      await withAudit(
        { action: 'post.archive', entityType: 'post', entityId: id, before },
        async () => archiveStoredPost(id),
      )
    }
    revalidatePublic(['', '/news'])
  })
}

/* ------------------------------------------------------------------ reads */

export async function loadBlocksAction(locale?: string) {
  return guard('layout', 'manage', async () =>
    live() ? cms.listBlocks(localeOf(locale)) : listStoredBlocks(),
  )
}

export async function loadPostsAction(locale?: string) {
  return guard('posts', 'read', async () =>
    live() ? cms.listPosts(localeOf(locale)) : listStoredPosts(),
  )
}
