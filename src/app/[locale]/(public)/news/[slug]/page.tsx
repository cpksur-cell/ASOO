import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { CalendarDays, Info } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, locales, type Locale } from '@/i18n/config'
import { formatDate, formatDateISO, formatDateWithHijri } from '@/i18n/format'
import { getRepository } from '@/lib/data'
import { href } from '@/lib/routes'
import { siteUrl } from '@/lib/site'
import { posts as seedPosts } from '@/lib/data/seed'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Tag } from '@/components/ui/primitives'
import { CadastralPlan } from '@/components/ui/cadastral-plan'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { NewsCard } from '@/components/features/cards'

export async function generateStaticParams() {
  return locales.flatMap((locale) => seedPosts.map((p) => ({ locale, slug: p.slug })))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const post = await getRepository().getPost(slug, locale)
  if (!post) return {}

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: href(locale, `news/${slug}`),
      languages: { 'ar-JO': `/ar/news/${slug}`, en: `/en/news/${slug}` },
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt,
    },
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  const repo = getRepository()
  const post = await repo.getPost(slug, typed)
  if (!post) notFound()

  const t = createTranslator(getDictionary(typed))
  const related = (await repo.listPosts(typed, { limit: 4 })).filter((p) => p.id !== post.id).slice(0, 3)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    inLanguage: typed,
    mainEntityOfPage: `${siteUrl}${href(typed, `news/${slug}`)}`,
    publisher: { '@type': 'GovernmentOrganization', name: getDictionary(typed).site.fullName },
  }

  return (
    <>
      <Breadcrumbs
        locale={typed}
        items={[{ label: t('news.title'), path: 'news' }, { label: post.title }]}
      />

      <article>
        <header className="relative overflow-hidden border-b border-border-subtle bg-surface-default">
          <CadastralPlan className="opacity-70" />
          <div className="container-page relative py-12 md:py-16">
            <div className="prose-measure">
              {post.category && <Tag>{post.category.name}</Tag>}
              <h1 className="mt-4 text-[length:var(--type-4xl)] font-bold leading-[var(--leading-heading)] tracking-tight text-text-primary">
                {post.title}
              </h1>
              <div className="mt-5 h-[3px] w-16 rounded-full bg-surface-rule" aria-hidden />
              <p className="mt-5 inline-flex items-center gap-2 text-[length:var(--type-sm)] text-text-muted">
                <CalendarDays className="size-4" aria-hidden />
                <time dateTime={formatDateISO(post.publishedAt)}>
                  {typed === 'ar'
                    ? formatDateWithHijri(post.publishedAt)
                    : formatDate(post.publishedAt, typed)}
                </time>
              </p>
            </div>
          </div>
        </header>

        <div className="container-page py-12">
          {post.featuredImage && (
            <div className="relative mb-8 aspect-[16/9] w-full max-w-4xl overflow-hidden rounded-2xl border border-border-subtle bg-surface-sunken shadow-md">
              <Image
                src={post.featuredImage}
                alt=""
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          <div className="prose-measure">
            <p className="text-[length:var(--type-lg)] leading-[var(--leading-body)] text-text-secondary">
              {post.excerpt}
            </p>

            {post.body ? (
              <div className="mt-6 leading-[var(--leading-body)] text-text-secondary">
                {post.body}
              </div>
            ) : (
              /* The syndicate published only excerpts — no article bodies
                 exist. Saying so is better than a page that looks broken.
                 Full text is open question Q7. */
              <p className="mt-8 flex items-start gap-3 rounded-md border border-status-pending-border bg-status-pending-bg p-4 text-[length:var(--type-sm)] text-status-pending-fg">
                <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
                {t('news.bodyUnavailable')}
              </p>
            )}
          </div>

          {related.length > 0 && (
            <section className="mt-16 border-t border-border-subtle pt-12">
              <h2 className="text-[length:var(--type-xl)] font-semibold text-text-primary">
                {t('news.related')}
              </h2>
              <div className="mt-3 h-[3px] w-12 rounded-full bg-surface-rule" aria-hidden />
              <RevealGroup as="ul" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <RevealItem key={p.id} as="li" className="relative">
                    <NewsCard post={p} locale={typed} />
                  </RevealItem>
                ))}
              </RevealGroup>
            </section>
          )}
        </div>
      </article>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  )
}
