import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SearchX } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, locales, type Locale } from '@/i18n/config'
import { listGovernorates, searchDirectory } from '@/lib/data/members-source'
import { href } from '@/lib/routes'
import { dlsRegistryUrl } from '@/lib/site'
import { governorates as seedGovernorates } from '@/lib/data/seed'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { ButtonLink } from '@/components/ui/button'
import { MemberCard } from '@/components/features/cards'

export function generateStaticParams() {
  return locales.flatMap((locale) => seedGovernorates.map((g) => ({ locale, slug: g.code })))
}

async function resolve(locale: Locale, slug: string) {
  const governorates = await listGovernorates(locale)
  return governorates.find((g) => g.code === slug) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const gov = await resolve(locale, slug)
  if (!gov) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('directory.inGovernorate', { governorate: gov.name }),
    alternates: { canonical: href(locale, `directory/governorate/${slug}`) },
  }
}

export default async function GovernoratePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  const gov = await resolve(typed, slug)
  if (!gov) notFound()

  const t = createTranslator(getDictionary(typed))
  const results = await searchDirectory({ governorate: slug }, typed)
  const title = t('directory.inGovernorate', { governorate: gov.name })

  return (
    <>
      <Breadcrumbs
        locale={typed}
        items={[{ label: t('directory.title'), path: 'directory' }, { label: gov.name }]}
      />
      <PageHeader title={title} intro={t('directory.intro')} />

      <div className="container-page py-12">
        <p className="mb-6 text-[length:var(--type-sm)] text-text-muted">
          {t('directory.resultsCount', { count: results.total })}
        </p>

        {results.items.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={t('directory.emptyTitle')}
            body={t('directory.emptyBody')}
            action={
              <ButtonLink href={dlsRegistryUrl} variant="secondary" external>
                {t('directory.emptyCta')}
              </ButtonLink>
            }
          />
        ) : (
          <RevealGroup as="ul" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.items.map((m) => (
              <RevealItem key={m.id} as="li" className="relative">
                <MemberCard member={m} locale={typed} />
              </RevealItem>
            ))}
          </RevealGroup>
        )}
      </div>
    </>
  )
}
