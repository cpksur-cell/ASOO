import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SearchX } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { listGovernorates, searchDirectory } from '@/lib/data/members-source'
import { href } from '@/lib/routes'
import { dlsRegistryUrl } from '@/lib/site'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { ButtonLink } from '@/components/ui/button'
import { MemberCard } from '@/components/features/cards'
import { DirectorySearchForm } from '@/components/features/directory-search-form'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('directory.title'),
    description: t('directory.intro'),
    alternates: {
      canonical: href(locale, 'directory'),
      languages: { 'ar-JO': '/ar/directory', en: '/en/directory' },
    },
  }
}

export default async function DirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; governorate?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  const { q = '', governorate = 'all' } = await searchParams
  const t = createTranslator(getDictionary(typed))

  const [governorates, results] = await Promise.all([
    listGovernorates(typed),
    searchDirectory({ q, governorate }, typed),
  ])

  return (
    <>
      <Breadcrumbs locale={typed} items={[{ label: t('directory.title') }]} />
      <PageHeader title={t('directory.title')} intro={t('directory.intro')}>
        <div className="mt-8 max-w-4xl">
          <DirectorySearchForm
            locale={typed}
            governorates={governorates}
            action={href(typed, 'directory')}
            defaultQuery={q}
            defaultGovernorate={governorate}
          />
        </div>
      </PageHeader>

      <div className="container-page py-12">
        <p className="mb-6 text-[length:var(--type-sm)] text-text-muted">
          {t('directory.resultsCount', { count: results.total })}
        </p>

        {results.items.length === 0 ? (
          /* A dead-end empty state sends the user to the phone. This one
             offers a route forward. docs/06-ux-flows.md §9. */
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
