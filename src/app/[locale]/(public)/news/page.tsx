import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Newspaper } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { getRepository } from '@/lib/data'
import { href } from '@/lib/routes'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { NewsCard } from '@/components/features/cards'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('news.title'),
    description: t('news.intro'),
    alternates: { canonical: href(locale, 'news'), languages: { 'ar-JO': '/ar/news', en: '/en/news' } },
  }
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  const t = createTranslator(getDictionary(typed))
  const posts = await getRepository().listPosts(typed)

  return (
    <>
      <Breadcrumbs locale={typed} items={[{ label: t('news.title') }]} />
      <PageHeader title={t('news.title')} intro={t('news.intro')} />

      <div className="container-page py-12">
        {posts.length === 0 ? (
          <EmptyState icon={<Newspaper />} title={t('news.empty')} />
        ) : (
          <RevealGroup as="ul" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <RevealItem key={post.id} as="li" className="relative">
                <NewsCard post={post} locale={typed} />
              </RevealItem>
            ))}
          </RevealGroup>
        )}
      </div>
    </>
  )
}
