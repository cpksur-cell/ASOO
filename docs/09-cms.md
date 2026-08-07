# 09 — CMS & Homepage Composition

The requirement, in the client's words: *"a CMS to control the front end appearance like grids and posts section."*

That means content editors change **what the homepage shows and in what order** — not just the text inside a fixed template. This document specifies how.

---

## 1. The model

The homepage is **an ordered list of typed blocks**, not a template.

```
layouts                    one per composable surface (homepage, ...)
  └── layout_blocks        type · position · is_published · config (jsonb)
        └── layout_block_translations   heading · subheading · body · cta · items, per locale
```

Rendering is a single component:

```tsx
// app/[locale]/(public)/page.tsx
const blocks = await getPublishedBlocks('homepage')
return blocks.map(b => <BlockRenderer key={b.id} block={b} locale={locale} />)
```

`BlockRenderer` maps a block type to a server component. Adding a block type touches four places and nothing else — see §5.

**Why blocks rather than a page builder.** A free-form drag-and-drop builder lets an editor produce a homepage that violates the design system, breaks in RTL, or fails accessibility. Typed blocks constrain composition to arrangements that are guaranteed to work in both locales at every breakpoint. The editor gets real control over structure; the system keeps its guarantees.

---

## 2. Block types

### `hero`
The masthead. Logo, founding-year badge, title, description, up to two CTAs, optional background media.

| Config | |
|---|---|
| `variant` | `centered` \| `split` \| `image_background` |
| `showLogo`, `showBadge` | boolean |
| `backgroundMediaId` | media asset |
| `overlayOpacity` | 0–100 |
| `primaryCta`, `secondaryCta` | `{ href }` — label is translated |

*Translated:* `heading`, `subheading`, `body`, `badgeText`, CTA labels.

### `stat_counters`
The "450+ licensed offices · 1,200 licensed surveyors" row.

| Config | |
|---|---|
| `columns` | 2 \| 3 \| 4 |
| `animate` | count-up on scroll — **disabled under `prefers-reduced-motion`** |
| `items[]` | `{ value, suffix, icon, href }` |

*Translated:* per-item `label`.

`href` lets a counter link to a filtered directory — a stat that is also a route into the data.

### `service_grid`
The service cards: site plans, legal consultation, member services, e-transactions.

| Config | |
|---|---|
| `columns` | 2 \| 3 \| 4 |
| `iconStyle` | `outline` \| `filled` \| `none` |
| `items[]` | `{ icon, href }` |

*Translated:* per-item `title`, `description`.

### `link_cards`
Government service and map cards, sourced from `external_links` rather than duplicated into block config — so a link edited in `/admin/content/links` updates everywhere it appears at once.

| Config | |
|---|---|
| `groupCode` | `gov_services` \| `survey_maps` |
| `columns` | 2 \| 3 \| 4 |
| `limit` | max cards |

*Translated:* section `heading`, `subheading`. Card text comes from the link records.

Every card renders an explicit external-link indicator and `rel="noopener"` — a user must know they are leaving the syndicate's site.

### `news_feed`
| Config | |
|---|---|
| `categorySlug` | null = all |
| `limit` | default 5 |
| `layout` | `list` \| `grid` \| `featured_plus_list` |
| `showDate`, `showExcerpt`, `showViewAll` | boolean |

*Translated:* `heading`, `viewAllLabel`.

### `document_list`
| Config | `categorySlug`, `limit`, `layout` (`list` \| `cards`) |

### `directory_search`
An inline member search widget. Config: `showGovernorateFilter`, `resultLimit`.

Putting the directory search directly on the homepage is worth doing — verifying a surveyor is the single most common reason a member of the public arrives at this site.

### `rich_text`
Localized WYSIWYG for announcements. Config: `maxWidth` (`prose` \| `full`), `align`.

Sanitized server-side against an allow-list on save **and** on render. Permitted: headings h2–h4, paragraphs, lists, links, bold, italic, blockquote, tables. No scripts, no iframes, no inline styles, no class attributes.

### `cta_banner`
| Config | `variant` (`brand` \| `accent` \| `subtle`), `href`, `isExternal` |

*Translated:* `heading`, `body`, `ctaLabel`.

---

## 3. Config validation

Each block type has a Zod schema. `config` is validated on save and again on read.

```ts
// lib/cms/block-schemas.ts
export const blockConfigSchemas = {
  hero: z.object({
    variant: z.enum(['centered', 'split', 'image_background']).default('centered'),
    showLogo: z.boolean().default(true),
    showBadge: z.boolean().default(true),
    backgroundMediaId: z.string().uuid().nullable().default(null),
    overlayOpacity: z.number().min(0).max(100).default(40),
    primaryCta: z.object({ href: z.string() }).nullable().default(null),
    secondaryCta: z.object({ href: z.string() }).nullable().default(null),
  }),
  stat_counters: z.object({
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
    animate: z.boolean().default(true),
    items: z.array(z.object({
      value: z.string(),
      suffix: z.string().optional(),
      icon: z.string().optional(),
      href: z.string().optional(),
    })).max(6),
  }),
  // ... one per type
} as const
```

**Validating on read matters.** A block whose config was written by an older schema version must not crash the homepage. Invalid config falls back to defaults and logs a warning; the page still renders. A CMS that can take the public homepage down is not acceptable for a government body.

---

## 4. Draft and publish

`layouts` carries a draft state and a published state. An editor composes freely; the public sees only what has been published.

```
Editor changes ──► draft saved automatically
                        │
                   preview (AR + EN, mobile + desktop)
                        │
                   Publish ──┬──► published version updated
                             ├──► audit row written
                             └──► ISR revalidation by tag
```

- **Preview requires both locales and both breakpoints** before the publish button enables. An editor who previews only Arabic desktop will ship a broken English mobile homepage — this is the most reliable way to prevent it.
- **Removing a block unpublishes it.** Content is retained. Editors will remove things by accident.
- **Publishing writes an audit row** recording who changed the homepage, when, and what changed.
- **Revalidation is by tag**, so publishing the homepage does not invalidate news articles.

---

## 5. Adding a new block type

Four changes, in this order:

1. **Schema** — add the value to the `LayoutBlockType` enum in `dataconnect/schema/schema.gql`, regenerate, migrate.
2. **Config schema** — add a Zod schema to `lib/cms/block-schemas.ts`.
3. **Renderer** — add a server component in `components/blocks/`, register it in `BlockRenderer`.
4. **Editor** — add a config form in `components/admin/block-editors/`.

Then verify: renders in AR and EN, at 375px and 1280px, keyboard-navigable, no raw hex, no physical CSS properties.

This is deliberately a code change, not a runtime configuration. Block *types* are a design-system decision; block *composition* is an editorial decision. Letting editors invent new block types is how a design system dies.

---

## 6. Editorial workflow for news

```
draft ──► scheduled ──► published ──► archived
```

- A post is publicly visible only when `status = published` **and** `published_at <= now()` **and** a translation exists for the requested locale.
- **Missing translation behavior:** show the available locale's content with an explicit notice — "This article is available in Arabic only." Never a blank page, never a 404 for content that exists.
- The admin news list shows **translation completeness** per post, so an editor can see at a glance which posts are Arabic-only.
- Slugs are ASCII and locale-independent. Arabic titles are transliterated, or the editor sets a slug manually. Slugs are immutable after publish — changing one breaks every external link.
- Scheduled publishing runs on a Cloud Scheduler sweep, not a per-post timer.

---

## 7. Media

- Uploads are converted to **WebP** with an original retained, and resized to a standard set (thumbnail, card, hero, full).
- **Alt text is required per locale before an asset can be used in published content.** Not a warning — a block. Accessibility failures in a government system are the kind that get reported.
- The library supports search, filtering by type, and shows where each asset is used — so an editor can tell whether deleting an image will break a page.

---

## 8. Default homepage composition

Seeded to reproduce the current site exactly, so nothing is lost at launch:

Seeded to reproduce the syndicate's existing homepage, which runs **two columns at the top** — hero and stats on the right (`main`), the news feed as a left sidebar (`aside`) — then full-width sections below.

| Region | # | Block | Config |
|---|---|---|---|
| `main` | 10 | `hero` | logo watermark, "تأسست عام 1999" badge, two CTAs (directory, about) |
| `main` | 20 | `stat_counters` | 2 columns — 450+ licensed offices, 1,200 licensed surveyors |
| `main` | 30 | `service_grid` | 2 columns — site plans · legal consultation · member services · e-transactions |
| `aside` | 10 | `news_feed` | latest 5, `list`, dated, with view-all |
| `main` | 40 | `link_cards` | group `gov_services`, 3 columns |
| `main` | 50 | `link_cards` | group `survey_maps`, 4 columns |
| `main` | 60 | `cta_banner` | the licensed-surveyor registry |

Positions are gap-numbered by 10 so inserting a block between two existing ones does not renumber the list. `aside` blocks collapse below `main` on mobile, in `position` order.

**One addition recommended at launch:** a `directory_search` block at `main`/25, directly under the stat counters. The most common public intent on this site is verifying that a surveyor is licensed, and today that takes two clicks from the homepage. It should take zero.

### Section rule
Every section heading carries the syndicate's **flag-red 3px rule** beneath it, matching their existing site. This is `surface.rule` and it is decorative only — see the constraint in `docs/05-design-system.md` §2.
