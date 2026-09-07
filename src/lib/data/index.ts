import 'server-only'

import { isSupabaseConfigured } from '@/lib/supabase/config'
import * as cms from './cms-source'
import { seedRepository } from './seed-repository'
import type { ContentRepository } from './types'

/**
 * The single data boundary for the public site.
 *
 * Two implementations behind one interface. When Supabase is configured, the
 * CMS-managed content — the homepage composition and the news articles — is
 * read from Postgres, which is what the admin screens write to. Everything
 * else still comes from the seed module.
 *
 * That split is deliberate rather than half-finished. The homepage composer
 * and the news manager are the only CMS screens that exist, so those are the
 * only tables an editor can currently change. Documents, external links and
 * the `about` page body have no admin UI and no table — moving them into
 * Postgres now would add a migration nobody can edit through, so they stay in
 * the seed until the screen that manages them is built. See docs/11 §1.
 *
 * The fallback matters: with no credentials set, every call lands on the seed
 * repository and the site renders exactly as it did before.
 */

/**
 * The seed repository with the CMS reads swapped for Postgres.
 *
 * Spread rather than reimplemented: the methods this does not override are
 * the seed's own, and `this` still resolves within the composed object, so
 * `listDocuments` reaching for `this.listDocumentCategories` keeps working.
 */
const supabaseRepository: ContentRepository = {
  ...seedRepository,
  getLayoutBlocks: cms.getLayoutBlocks,
  listPosts: cms.listPosts,
  getPost: cms.getPost,
  listPostCategories: cms.listPostCategories,
}

export function getRepository(): ContentRepository {
  return isSupabaseConfigured() ? supabaseRepository : seedRepository
}

export type * from './types'
