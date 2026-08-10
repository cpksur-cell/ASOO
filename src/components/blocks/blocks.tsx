import Link from 'next/link'
import { ArrowLeft, Compass, ExternalLink, Search } from 'lucide-react'

import { createTranslator, getDictionary, localeDirection, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { cn } from '@/lib/cn'
import { getRepository } from '@/lib/data'
import type { BlockText, LayoutBlock } from '@/lib/data'
import { parseBlockConfig } from '@/lib/cms/block-schemas'
import { Card, SectionHeading } from '@/components/ui/primitives'
import { CadastralPlan } from '@/components/ui/cadastral-plan'
import { InteractiveGlobe, type GlobeMarker } from '@/components/ui/interactive-globe'
import { JORDAN_GOVERNORATES, ORIGIN_CODE, TRIANGULATION_LEGS } from '@/lib/geo/jordan'
import { governorates as seedGovernorates } from '@/lib/data/seed'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import { ButtonLink } from '@/components/ui/button'
import { DocumentCard, GovLinkCard, NewsCard, ServiceCard } from '@/components/features/cards'
import { Icon } from '@/components/features/icon'
import { CountUp } from './stat-counter'
import { DirectorySearchForm } from '@/components/features/directory-search-form'

const gridCols: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

interface BlockProps {
  block: LayoutBlock
  locale: Locale
}

/* -------------------------------------------------------------------- hero */

function Hero({ block, locale }: BlockProps) {
  const cfg = parseBlockConfig('hero', block.config)
  if (!cfg) return null
  const text = block.text
  const t = createTranslator(getDictionary(locale))

  /*
   * Station labels come from the governorate records that already back the
   * directory, so the globe cannot drift out of step with the rest of the site
   * and no place name is duplicated as a literal here (CLAUDE.md §9).
   */
  const globeMarkers: GlobeMarker[] = JORDAN_GOVERNORATES.map((point) => ({
    ...point,
    label: seedGovernorates.find((g) => g.code === point.code)?.name[locale] ?? point.code,
  }))

  return (
    <section className="relative -mt-px overflow-hidden border-b border-border-subtle bg-surface-default">
      <CadastralPlan animated dense />
      {/* A single soft wash of the accent, anchored to the inline-end corner.
          Establishes depth without becoming decoration. */}
      <div
        className="pointer-events-none absolute -top-24 end-[-6rem] size-[28rem] rounded-full bg-accent-100 opacity-40 blur-3xl"
        aria-hidden
      />
      {/* Secondary glow for added depth */}
      <div
        className="pointer-events-none absolute -bottom-32 start-[-10rem] size-[20rem] rounded-full bg-primary-200 opacity-30 blur-3xl"
        aria-hidden
      />

      <div className="container-page relative py-16 md:py-24">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
          <Reveal className="max-w-2xl lg:flex-1">
            {cfg.showBadge && text.badgeText && (
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-surface-accent-subtle px-3.5 py-1.5 text-[length:var(--type-sm)] font-semibold text-text-accent">
                <Compass className="size-4" aria-hidden />
                {text.badgeText}
              </span>
            )}

            <h1 className="mt-6 text-[length:var(--type-4xl)] font-bold leading-[var(--leading-heading)] tracking-tight text-text-primary md:text-[length:var(--type-5xl)]">
              {text.heading}
            </h1>

            <div className="mt-6 h-[3px] w-20 rounded-full bg-surface-rule" aria-hidden />

            {text.body && (
              <p className="prose-measure mt-6 text-[length:var(--type-lg)] leading-[var(--leading-body)] text-text-secondary">
                {text.body}
              </p>
            )}

            <div className="mt-9 flex flex-wrap gap-3">
              {cfg.primaryCta && text.ctaLabel && (
                <ButtonLink href={href(locale, cfg.primaryCta.href)} size="lg" withArrow>
                  {text.ctaLabel}
                </ButtonLink>
              )}
              {cfg.secondaryCta && text.secondaryCtaLabel && (
                <ButtonLink
                  href={href(locale, cfg.secondaryCta.href)}
                  variant="secondary"
                  size="lg"
                >
                  {text.secondaryCtaLabel}
                </ButtonLink>
              )}
            </div>
          </Reveal>

          {/*
            Hero visual — a geodetic globe rather than a photograph.

            It replaces a 990 KB stock image with inline SVG: nothing to
            download, nothing to lay out late, so the largest paint is the
            heading itself. It also says what the photo could not — that this
            syndicate's members measure the Earth, and that the network is
            occupied from Amman.
          */}
          <Reveal className="relative hidden lg:block lg:w-[44%] lg:shrink-0">
            <div className="relative mx-auto aspect-square w-full max-w-[30rem]">
              <InteractiveGlobe
                markers={globeMarkers}
                legs={TRIANGULATION_LEGS}
                originCode={ORIGIN_CODE}
                label={t('common.globeLabel')}
                dir={localeDirection[locale]}
              />
              {/* The affordance has to be stated — a canvas gives no hint that
                  it can be grabbed. */}
              <p className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[length:var(--type-xs)] text-text-muted">
                {t('common.globeHint')}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- stat counters */

function StatCounters({ block, locale }: BlockProps) {
  const cfg = parseBlockConfig('stat_counters', block.config)
  if (!cfg) return null
  const labels = block.text.items ?? []

  return (
    <section className="container-page py-12">
      <RevealGroup
        as="ul"
        className={cn('grid grid-cols-1 gap-4', gridCols[cfg.columns])}
      >
        {cfg.items.map((item, i) => {
          const label = labels[i]?.label ?? ''
          const inner = (
            <Card
              interactive={Boolean(item.href)}
              className="group flex h-full items-center gap-5 p-6"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-text-brand transition-colors group-hover:bg-surface-accent-subtle group-hover:text-text-accent">
                <Icon name={item.icon} className="size-7" />
              </span>
              <span className="flex flex-col">
                <span className="text-[length:var(--type-4xl)] font-bold leading-none tracking-tight text-text-primary">
                  <CountUp value={item.value} suffix={item.suffix} />
                </span>
                <span className="mt-2 text-[length:var(--type-sm)] text-text-secondary">
                  {label}
                </span>
              </span>
            </Card>
          )

          return (
            <RevealItem key={item.value + i} as="li">
              {item.href ? (
                <Link href={href(locale, item.href)} className="block h-full">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </RevealItem>
          )
        })}
      </RevealGroup>
    </section>
  )
}

/* ------------------------------------------------------------ service grid */

function ServiceGrid({ block, locale }: BlockProps) {
  const cfg = parseBlockConfig('service_grid', block.config)
  if (!cfg) return null
  const items = block.text.items ?? []

  return (
    <section className="container-page py-12">
      {block.text.heading && <SectionHeading>{block.text.heading}</SectionHeading>}
      <RevealGroup as="ul" className={cn('grid grid-cols-1 gap-4', gridCols[cfg.columns])}>
        {cfg.items.map((item, i) => (
          <RevealItem key={i} as="li">
            <ServiceCard
              icon={item.icon}
              title={items[i]?.title ?? ''}
              description={items[i]?.description ?? ''}
              url={href(locale, item.href)}
            />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  )
}

/* -------------------------------------------------------------- link cards */

async function LinkCards({ block, locale }: BlockProps) {
  const cfg = parseBlockConfig('link_cards', block.config)
  if (!cfg) return null

  let links = await getRepository().listExternalLinks(cfg.groupCode, locale)
  if (cfg.limit) links = links.slice(0, cfg.limit)

  return (
    <section className="container-page py-12">
      {block.text.heading && (
        <SectionHeading subtitle={block.text.subheading}>{block.text.heading}</SectionHeading>
      )}
      <RevealGroup as="ul" className={cn('grid grid-cols-1 gap-4', gridCols[cfg.columns])}>
        {links.map((link) => (
          <RevealItem key={link.id} as="li">
            <GovLinkCard link={link} locale={locale} />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  )
}

/* --------------------------------------------------------------- news feed */

async function NewsFeed({ block, locale }: BlockProps) {
  const cfg = parseBlockConfig('news_feed', block.config)
  if (!cfg) return null

  const t = createTranslator(getDictionary(locale))
  const posts = await getRepository().listPosts(locale, {
    limit: cfg.limit,
    categorySlug: cfg.categorySlug ?? undefined,
  })

  if (posts.length === 0) return null

  // The `list` layout is the sidebar form; `grid` is the full-width form.
  if (cfg.layout === 'list') {
    return (
      <Card className="p-5">
        <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">
          {block.text.heading}
        </h2>
        <div className="mt-3 h-[3px] w-10 rounded-full bg-surface-rule" aria-hidden />
        <div className="mt-5 flex flex-col gap-4">
          {posts.map((post) => (
            <NewsCard key={post.id} post={post} locale={locale} variant="row" />
          ))}
        </div>
        {cfg.showViewAll && (
          <Link
            href={href(locale, 'news')}
            className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-[length:var(--type-sm)] font-medium text-text-brand hover:underline"
          >
            {block.text.viewAllLabel ?? t('common.viewAll')}
            <ArrowLeft className="size-4" data-mirror="true" aria-hidden />
          </Link>
        )}
      </Card>
    )
  }

  return (
    <section className="container-page py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading className="mb-0">{block.text.heading}</SectionHeading>
        {cfg.showViewAll && (
          <Link
            href={href(locale, 'news')}
            className="inline-flex min-h-11 items-center gap-1.5 text-[length:var(--type-sm)] font-medium text-text-brand hover:underline"
          >
            {block.text.viewAllLabel ?? t('common.viewAll')}
            <ArrowLeft className="size-4" data-mirror="true" aria-hidden />
          </Link>
        )}
      </div>
      <RevealGroup as="ul" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <RevealItem key={post.id} as="li" className="relative">
            <NewsCard post={post} locale={locale} />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  )
}

/* ----------------------------------------------------------- document list */

async function DocumentList({ block, locale }: BlockProps) {
  const cfg = parseBlockConfig('document_list', block.config)
  if (!cfg) return null

  const docs = (await getRepository().listDocuments(locale, cfg.categorySlug ?? undefined)).slice(
    0,
    cfg.limit,
  )

  return (
    <section className="container-page py-12">
      {block.text.heading && <SectionHeading>{block.text.heading}</SectionHeading>}
      <RevealGroup as="ul" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((doc) => (
          <RevealItem key={doc.id} as="li">
            <DocumentCard document={doc} locale={locale} />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  )
}

/* -------------------------------------------------------- directory search */

async function DirectorySearchBlock({ block, locale }: BlockProps) {
  const cfg = parseBlockConfig('directory_search', block.config)
  if (!cfg) return null

  const governorates = cfg.showGovernorateFilter
    ? await getRepository().listGovernorates(locale)
    : []

  return (
    <section className="container-page py-12">
      <Reveal>
        <Card className="relative overflow-hidden border-border-default p-6 md:p-8">
          <CadastralPlan className="opacity-80" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-md bg-surface-accent text-primary-900">
                <Search className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-[length:var(--type-xl)] font-semibold text-text-primary">
                  {block.text.heading}
                </h2>
                {block.text.subheading && (
                  <p className="mt-1 text-[length:var(--type-sm)] text-text-secondary">
                    {block.text.subheading}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6">
              <DirectorySearchForm
                locale={locale}
                governorates={governorates}
                action={href(locale, 'directory')}
              />
            </div>
          </div>
        </Card>
      </Reveal>
    </section>
  )
}

/* --------------------------------------------------------------- rich text */

function RichText({ block }: BlockProps) {
  const cfg = parseBlockConfig('rich_text', block.config)
  if (!cfg || !block.text.body) return null

  return (
    <section className="container-page py-12">
      <Reveal
        className={cn(
          cfg.maxWidth === 'prose' && 'prose-measure',
          cfg.align === 'center' && 'mx-auto text-center',
        )}
      >
        {block.text.heading && <SectionHeading>{block.text.heading}</SectionHeading>}
        <div className="text-[length:var(--type-base)] leading-[var(--leading-body)] text-text-secondary">
          {block.text.body}
        </div>
      </Reveal>
    </section>
  )
}

/* -------------------------------------------------------------- cta banner */

function CtaBanner({ block, locale }: BlockProps) {
  const cfg = parseBlockConfig('cta_banner', block.config)
  if (!cfg) return null

  const tone =
    cfg.variant === 'accent'
      ? 'bg-surface-accent text-primary-900'
      : cfg.variant === 'subtle'
        ? 'bg-surface-sunken text-text-primary'
        : 'bg-surface-inverse text-text-on-inverse'

  const onDark = cfg.variant === 'brand'

  return (
    <section className="container-page py-12">
      <Reveal>
        <div className={cn('relative overflow-hidden rounded-xl p-8 md:p-10', tone)}>
          <CadastralPlan className="opacity-50" />
          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-[length:var(--type-2xl)] font-bold">{block.text.heading}</h2>
              {block.text.body && (
                <p
                  className={cn(
                    'mt-3 leading-[var(--leading-body)]',
                    onDark ? 'text-primary-100' : 'opacity-85',
                  )}
                >
                  {block.text.body}
                </p>
              )}
            </div>
            {block.text.ctaLabel && (
              <ButtonLink
                href={cfg.isExternal ? cfg.href : href(locale, cfg.href)}
                variant={onDark ? 'accent' : 'primary'}
                size="lg"
                external={cfg.isExternal}
                className="shrink-0"
              >
                {block.text.ctaLabel}
              </ButtonLink>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ---------------------------------------------------------------- renderer */

/**
 * Maps a CMS block type to its component. Adding a block type is one entry
 * here plus a schema, a component, and an admin editor form.
 * docs/09-cms.md §5.
 */
export function BlockRenderer({ block, locale }: BlockProps) {
  switch (block.type) {
    case 'hero':
      return <Hero block={block} locale={locale} />
    case 'stat_counters':
      return <StatCounters block={block} locale={locale} />
    case 'service_grid':
      return <ServiceGrid block={block} locale={locale} />
    case 'link_cards':
      return <LinkCards block={block} locale={locale} />
    case 'news_feed':
      return <NewsFeed block={block} locale={locale} />
    case 'document_list':
      return <DocumentList block={block} locale={locale} />
    case 'directory_search':
      return <DirectorySearchBlock block={block} locale={locale} />
    case 'rich_text':
      return <RichText block={block} locale={locale} />
    case 'cta_banner':
      return <CtaBanner block={block} locale={locale} />
    default:
      // An unknown type must not break the page — it renders nothing.
      return null
  }
}

export type { BlockText }
export { ExternalLink as ExternalLinkIcon }
