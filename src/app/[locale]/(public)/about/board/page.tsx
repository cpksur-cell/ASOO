import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Users } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { EmptyState } from '@/components/ui/primitives'
import { ButtonLink } from '@/components/ui/button'
import { ProsePage } from '@/components/features/prose-page'

const PATH = 'about/board'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('nav.board'),
    description: t('boardPage.pendingBody'),
    alternates: {
      canonical: href(locale, PATH),
      languages: { 'ar-JO': `/ar/${PATH}`, en: `/en/${PATH}` },
    },
    // Nothing to index until the roster exists. Letting an empty state get
    // indexed as the syndicate's board page would be worse than not ranking.
    robots: { index: false, follow: true },
  }
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  /*
   * DELIBERATELY EMPTY.
   *
   * design/content-inventory.md lists "Board member names, roles, and
   * photographs" as still to be obtained from the syndicate. These are real
   * people holding public office in a government-affiliated body; inventing a
   * plausible roster would be fabricating a public record. The page exists so
   * the footer link is not a dead end, and says plainly that the list is not
   * published yet.
   */
  return (
    <ProsePage
      locale={typed}
      title={t('nav.board')}
      trail={[{ label: t('about.title'), path: 'about' }]}
    >
      <EmptyState
        icon={<Users />}
        title={t('boardPage.pendingTitle')}
        body={t('boardPage.pendingBody')}
        action={
          <ButtonLink href={href(typed, 'contact')} variant="secondary" withArrow>
            {t('nav.contact')}
          </ButtonLink>
        }
      />
    </ProsePage>
  )
}
