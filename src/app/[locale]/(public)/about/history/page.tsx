import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ScrollText } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { EmptyState } from '@/components/ui/primitives'
import { ButtonLink } from '@/components/ui/button'
import { ProsePage } from '@/components/features/prose-page'

const PATH = 'about/history'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('nav.history'),
    description: t('historyPage.pendingBody'),
    alternates: {
      canonical: href(locale, PATH),
      languages: { 'ar-JO': `/ar/${PATH}`, en: `/en/${PATH}` },
    },
    robots: { index: false, follow: true },
  }
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  /*
   * The founding facts — 1999, Regulation 105/1999, Law 43/1972 — are the only
   * historical claims in the repository (CLAUDE.md §1), so they are the only
   * ones stated. The narrative around them belongs to the syndicate.
   */
  return (
    <ProsePage
      locale={typed}
      title={t('nav.history')}
      trail={[{ label: t('about.title'), path: 'about' }]}
    >
      <EmptyState
        icon={<ScrollText />}
        title={t('historyPage.pendingTitle')}
        body={t('historyPage.pendingBody')}
        action={
          <ButtonLink href={href(typed, 'about')} variant="secondary" withArrow>
            {t('about.title')}
          </ButtonLink>
        }
      />
    </ProsePage>
  )
}
