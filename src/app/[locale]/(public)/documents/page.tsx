import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FileX, ExternalLink } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { getRepository } from '@/lib/data'
import { href } from '@/lib/routes'
import { dlsLegislationUrl } from '@/lib/site'
import { cn } from '@/lib/cn'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { DocumentCard } from '@/components/features/cards'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('documents.title'),
    description: t('documents.intro'),
    alternates: {
      canonical: href(locale, 'documents'),
      languages: { 'ar-JO': '/ar/documents', en: '/en/documents' },
    },
  }
}

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ category?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  const { category = 'all' } = await searchParams
  const t = createTranslator(getDictionary(typed))

  const repo = getRepository()
  const [categories, docs] = await Promise.all([
    repo.listDocumentCategories(typed),
    repo.listDocuments(typed, category === 'all' ? undefined : category),
  ])

  return (
    <>
      <Breadcrumbs locale={typed} items={[{ label: t('documents.title') }]} />
      <PageHeader title={t('documents.title')} intro={t('documents.intro')} />

      <div className="container-page py-12">
        <nav className="flex flex-wrap items-center gap-2" aria-label={t('common.filter')}>
          <FilterChip href={href(typed, 'documents')} active={category === 'all'}>
            {t('common.all')}
          </FilterChip>
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              href={`${href(typed, 'documents')}?category=${c.slug}`}
              active={category === c.slug}
            >
              {c.name}
            </FilterChip>
          ))}
          {/* The prototype put this in the primary nav, which threw users
              off-site mid-session. It belongs here, clearly marked external.
              docs/04-site-architecture.md §5.1. */}
          <a
            href={dlsLegislationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border-default px-4 text-[length:var(--type-sm)] text-text-secondary transition-colors hover:border-border-strong hover:text-text-brand"
          >
            {t('documents.dlsLegislation')}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </nav>

        <div className="mt-8">
          {docs.length === 0 ? (
            <EmptyState icon={<FileX />} title={t('documents.empty')} />
          ) : (
            <RevealGroup as="ul" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => (
                <RevealItem key={doc.id} as="li">
                  <DocumentCard document={doc} locale={typed} />
                </RevealItem>
              ))}
            </RevealGroup>
          )}
        </div>
      </div>
    </>
  )
}

function FilterChip({
  href: url,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={url}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border px-4',
        'text-[length:var(--type-sm)] font-medium transition-colors duration-[120ms]',
        active
          ? 'border-transparent bg-surface-brand text-text-on-brand'
          : 'border-border-default bg-surface-default text-text-secondary hover:border-border-strong hover:text-text-primary',
      )}
    >
      {children}
    </Link>
  )
}
