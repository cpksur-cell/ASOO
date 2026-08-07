'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
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
})

export async function reorderBlockAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = reorderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id, direction } = parsed.data

  return guard('layout', 'manage', async () => {
    await withAudit(
      {
        action: 'layout.reorder',
        entityType: 'layout_block',
        entityId: id,
        before: listStoredBlocks().map((b) => ({ id: b.id, position: b.position })),
      },
      async () => reorderStoredBlock(id, direction).map((b) => ({ id: b.id, position: b.position })),
    )
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
    await withAudit(
      {
        action: isPublished ? 'layout.publish' : 'layout.unpublish',
        entityType: 'layout_block',
        entityId: id,
      },
      async () => setStoredBlockPublished(id, isPublished),
    )
    revalidatePublic([''])
  })
}

const blockTextSchema = z.object({
  id: z.string().min(1),
  text: z.record(z.string(), z.unknown()),
})

export async function updateBlockTextAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = blockTextSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id, text } = parsed.data

  return guard('layout', 'manage', async () => {
    const before = listStoredBlocks().find((b) => b.id === id)?.text ?? null
    await withAudit(
      { action: 'layout.update', entityType: 'layout_block', entityId: id, before },
      async () => updateStoredBlockText(id, text),
    )
    revalidatePublic([''])
  })
}

export async function removeBlockAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id } = parsed.data

  return guard('layout', 'manage', async () => {
    await withAudit(
      { action: 'layout.remove', entityType: 'layout_block', entityId: id },
      async () => removeStoredBlock(id),
    )
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
})

export async function savePostAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = postSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const post = parsed.data

  return guard('posts', 'write', async () => {
    const before = getStoredPost(post.id)
    await withAudit(
      {
        action: before ? 'post.update' : 'post.create',
        entityType: 'post',
        entityId: post.id,
        before,
      },
      async () => upsertStoredPost(post),
    )
    revalidatePublic(['', '/news', `/news/${post.slug}`])
  })
}

/**
 * Archives, never deletes. A destroyed announcement cannot be recovered, and
 * the syndicate's record of what it published is part of its governance.
 */
export async function archivePostAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const { id } = parsed.data

  return guard('posts', 'publish', async () => {
    const before = getStoredPost(id)
    if (!before) return
    await withAudit(
      { action: 'post.archive', entityType: 'post', entityId: id, before },
      async () => archiveStoredPost(id),
    )
    revalidatePublic(['', '/news'])
  })
}

/* ------------------------------------------------------------------ reads */

export async function loadBlocksAction() {
  return guard('layout', 'manage', async () => listStoredBlocks())
}

export async function loadPostsAction() {
  return guard('posts', 'read', async () => listStoredPosts())
}
