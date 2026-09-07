/**
 * Move the CMS content from the in-memory seed into PostgreSQL.
 *
 *   node scripts/seed-cms.mjs [--dry-run]
 *
 * WHY THIS EXISTS
 *
 * The admin CMS wrote to an in-memory store while the public pages read the
 * seed module, so an editor could compose a homepage nobody would ever see.
 * Closing that gap needs the content to live in one place — Postgres — and
 * this is the one-time move that puts it there.
 *
 * WHAT IT WRITES
 *   · post_categories                (3)
 *   · posts + post_translations      (5 articles × ar/en)
 *   · layouts                        (1: `homepage`)
 *   · layout_blocks + translations   (the homepage composition)
 *
 * SAFETY
 *   · Idempotent. Keyed on natural keys — category slug, post slug, layout
 *     code, and a block's (layout, type, position). Re-running updates in
 *     place rather than duplicating; run it twice and the homepage is the
 *     same shape.
 *   · `--dry-run` reports exactly what would change and writes nothing.
 *   · It never deletes. A block an editor added in the admin screen and that
 *     is not in the seed is left alone — this is a seed, not a sync, and
 *     silently reverting someone's edit is the worst thing it could do.
 */

import { createClient } from '@supabase/supabase-js'
// @next/env is CommonJS, so it has no named exports under ESM.
import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())

const DRY = process.argv.includes('--dry-run')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

// Same normalization the app applies: the dashboard also surfaces the REST
// endpoint, and supabase-js appends /rest/v1 itself.
const origin = (() => {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
})()

const db = createClient(origin, key, { auth: { persistSession: false } })

/* ------------------------------------------------------------------ seed */

// seed.ts's only import is `import type`, which Node's type stripping removes,
// so it loads directly with no bundler and no path-alias resolution.
const seed = await import('../src/lib/data/seed.ts')

const LOCALES = ['ar', 'en']
const changes = []
const note = (s) => changes.push(s)

/* ------------------------------------------------------- post categories */

const categoryIdBySlug = new Map()

for (const [i, c] of seed.postCategories.entries()) {
  const row = { slug: c.slug, name_ar: c.name.ar, name_en: c.name.en, position: (i + 1) * 10 }
  const { data: existing } = await db
    .from('post_categories')
    .select('id')
    .eq('slug', c.slug)
    .maybeSingle()

  if (existing) {
    categoryIdBySlug.set(c.slug, existing.id)
    if (!DRY) {
      const { error } = await db.from('post_categories').update(row).eq('id', existing.id)
      if (error) throw error
    }
    note(`category ${c.slug}: updated`)
  } else {
    if (DRY) {
      note(`category ${c.slug}: would insert`)
      continue
    }
    const { data, error } = await db.from('post_categories').insert(row).select('id').single()
    if (error) throw error
    categoryIdBySlug.set(c.slug, data.id)
    note(`category ${c.slug}: inserted`)
  }
}

/* ----------------------------------------------------------------- posts */

for (const p of seed.posts) {
  const row = {
    slug: p.slug,
    category_id: categoryIdBySlug.get(p.categorySlug) ?? null,
    // The seeded articles are the syndicate's real published news.
    status: 'published',
    published_at: new Date(`${p.publishedAt}T00:00:00Z`).toISOString(),
    featured_image_url: p.featuredImage ?? null,
  }

  const { data: existing } = await db
    .from('posts')
    .select('id')
    .eq('slug', p.slug)
    .maybeSingle()

  let postId = existing?.id
  if (existing) {
    if (!DRY) {
      const { error } = await db.from('posts').update(row).eq('id', existing.id)
      if (error) throw error
    }
    note(`post ${p.slug}: updated`)
  } else {
    if (DRY) {
      note(`post ${p.slug}: would insert (+${LOCALES.length} translations)`)
      continue
    }
    const { data, error } = await db.from('posts').insert(row).select('id').single()
    if (error) throw error
    postId = data.id
    note(`post ${p.slug}: inserted`)
  }

  if (DRY) continue

  for (const locale of LOCALES) {
    const { error } = await db.from('post_translations').upsert(
      {
        post_id: postId,
        locale,
        title: p.title[locale],
        excerpt: p.excerpt[locale] ?? null,
        // Only excerpts were ever published; body stays null and the article
        // page shows its "full text not available" notice. See seed.ts.
        body: p.body ?? null,
      },
      { onConflict: 'post_id,locale' },
    )
    if (error) throw error
  }
}

/* --------------------------------------------------------------- layouts */

const LAYOUT_CODE = 'homepage'

let layoutId
{
  const { data: existing } = await db
    .from('layouts')
    .select('id')
    .eq('code', LAYOUT_CODE)
    .maybeSingle()

  if (existing) {
    layoutId = existing.id
    note(`layout ${LAYOUT_CODE}: exists`)
  } else if (DRY) {
    note(`layout ${LAYOUT_CODE}: would insert`)
  } else {
    const { data, error } = await db
      .from('layouts')
      .insert({ code: LAYOUT_CODE, name_ar: 'الصفحة الرئيسية', name_en: 'Homepage' })
      .select('id')
      .single()
    if (error) throw error
    layoutId = data.id
    note(`layout ${LAYOUT_CODE}: inserted`)
  }
}

/* --------------------------------------------------------- layout blocks */

/**
 * Split a block's per-locale text bundle into one row per locale.
 *
 * The seed nests locale inside each field (`heading: { ar, en }`); the table
 * is one row per locale with flat columns. `items` stays JSONB, resolved to
 * the row's locale so the renderer never sees a translations array.
 */
function translationRow(text, locale) {
  const t = text ?? {}
  const pick = (v) => (v && typeof v === 'object' ? (v[locale] ?? null) : null)
  return {
    locale,
    heading: pick(t.heading),
    subheading: pick(t.subheading),
    body: pick(t.body),
    cta_label: pick(t.ctaLabel),
    badge_text: pick(t.badgeText),
    secondary_cta_label: pick(t.secondaryCtaLabel),
    view_all_label: pick(t.viewAllLabel),
    items: Array.isArray(t.items)
      ? t.items.map((item) =>
          Object.fromEntries(
            Object.entries(item).map(([k, v]) => [
              k,
              v && typeof v === 'object' ? (v[locale] ?? null) : v,
            ]),
          ),
        )
      : null,
  }
}

if (layoutId) {
  for (const b of seed.homepageBlocks) {
    const row = {
      layout_id: layoutId,
      type: b.type,
      region: b.region,
      position: b.position,
      // Seeded blocks ARE the live homepage, so they are published. A block an
      // editor adds later starts as a draft, which is the table's own default.
      is_published: true,
      config: b.config ?? null,
    }

    // Natural key: one block of a given type at a given position in a layout.
    const { data: existing } = await db
      .from('layout_blocks')
      .select('id')
      .eq('layout_id', layoutId)
      .eq('type', b.type)
      .eq('position', b.position)
      .maybeSingle()

    let blockId = existing?.id
    if (existing) {
      if (!DRY) {
        const { error } = await db.from('layout_blocks').update(row).eq('id', existing.id)
        if (error) throw error
      }
      note(`block ${b.type}@${b.position}: updated`)
    } else {
      if (DRY) {
        note(`block ${b.type}@${b.position}: would insert`)
        continue
      }
      const { data, error } = await db.from('layout_blocks').insert(row).select('id').single()
      if (error) throw error
      blockId = data.id
      note(`block ${b.type}@${b.position}: inserted`)
    }

    if (DRY) continue

    for (const locale of LOCALES) {
      const { error } = await db
        .from('layout_block_translations')
        .upsert({ block_id: blockId, ...translationRow(b.text, locale) }, {
          onConflict: 'block_id,locale',
        })
      if (error) throw error
    }
  }
}

/* ---------------------------------------------------------------- report */

console.log(changes.map((c) => `  ${c}`).join('\n'))
console.log(
  `\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} ` +
    `${seed.postCategories.length} categories, ${seed.posts.length} posts, ` +
    `${seed.homepageBlocks.length} blocks.`,
)
