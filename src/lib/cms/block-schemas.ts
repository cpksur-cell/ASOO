import { z } from 'zod'
import type { LayoutBlockType } from '@/lib/data'

/**
 * One Zod schema per block type. Config is validated on save AND on read.
 *
 * Validating on read is the part that matters: a block whose config was
 * written by an older schema version must not take the public homepage down.
 * Invalid config falls back to defaults and logs — the page still renders.
 * docs/09-cms.md §3.
 */

const cta = z.object({ href: z.string() }).nullable().default(null)
const columns = z.union([z.literal(2), z.literal(3), z.literal(4)])

export const blockConfigSchemas = {
  hero: z.object({
    variant: z.enum(['centered', 'split', 'image_background']).default('split'),
    showBadge: z.boolean().default(true),
    primaryCta: cta,
    secondaryCta: cta,
  }),

  stat_counters: z.object({
    columns: columns.default(2),
    animate: z.boolean().default(true),
    items: z
      .array(
        z.object({
          value: z.string(),
          suffix: z.string().optional().default(''),
          icon: z.string().optional().default('users'),
          href: z.string().optional(),
        }),
      )
      .max(6)
      .default([]),
  }),

  service_grid: z.object({
    columns: columns.default(4),
    items: z
      .array(z.object({ icon: z.string().default('globe'), href: z.string().default('/') }))
      .default([]),
  }),

  link_cards: z.object({
    groupCode: z.enum(['gov_services', 'survey_maps']),
    columns: columns.default(3),
    limit: z.number().int().positive().optional(),
  }),

  news_feed: z.object({
    categorySlug: z.string().nullable().default(null),
    limit: z.number().int().positive().default(5),
    layout: z.enum(['list', 'grid', 'featured_plus_list']).default('grid'),
    showDate: z.boolean().default(true),
    showExcerpt: z.boolean().default(true),
    showViewAll: z.boolean().default(true),
  }),

  document_list: z.object({
    categorySlug: z.string().nullable().default(null),
    limit: z.number().int().positive().default(6),
    layout: z.enum(['list', 'cards']).default('cards'),
  }),

  directory_search: z.object({
    showGovernorateFilter: z.boolean().default(true),
  }),

  rich_text: z.object({
    maxWidth: z.enum(['prose', 'full']).default('prose'),
    align: z.enum(['start', 'center']).default('start'),
  }),

  cta_banner: z.object({
    variant: z.enum(['brand', 'accent', 'subtle']).default('brand'),
    href: z.string(),
    isExternal: z.boolean().default(false),
  }),
} satisfies Record<LayoutBlockType, z.ZodTypeAny>

export type BlockConfig<T extends LayoutBlockType> = z.infer<
  (typeof blockConfigSchemas)[T]
>

/**
 * Parse a block's config, degrading to defaults rather than throwing.
 * Returns null only when the type itself is unknown.
 */
export function parseBlockConfig<T extends LayoutBlockType>(
  type: T,
  config: unknown,
): BlockConfig<T> | null {
  const schema = blockConfigSchemas[type]
  if (!schema) return null

  const result = schema.safeParse(config ?? {})
  if (result.success) return result.data as BlockConfig<T>

  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[cms] invalid config for block "${type}":`, result.error.flatten())
  }

  // Second chance with an empty object, so a block with one bad field still
  // renders from defaults instead of disappearing.
  const fallback = schema.safeParse({})
  return fallback.success ? (fallback.data as BlockConfig<T>) : null
}
