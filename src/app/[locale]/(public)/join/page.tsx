import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Clock } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { Card } from '@/components/ui/primitives'
import { ButtonLink } from '@/components/ui/button'
import { ProsePage, ProseSection } from '@/components/features/prose-page'

const PATH = 'join'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('join.title'),
    description: t('join.intro'),
    alternates: {
      canonical: href(locale, PATH),
      languages: { 'ar-JO': `/ar/${PATH}`, en: `/en/${PATH}` },
    },
  }
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  return (
    <ProsePage
      locale={typed}
      title={t('join.title')}
      intro={t('join.intro')}
      aside={
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={href(typed, 'contact')} variant="primary" withArrow>
            {t('joinPage.contactCta')}
          </ButtonLink>
          <ButtonLink href={href(typed, 'directory')} variant="secondary">
            {t('joinPage.directoryCta')}
          </ButtonLink>
        </div>
      }
    >
      {/* The legal basis is the one hard fact available: Law 43/1972 and
          Regulation 105/1999, both cited in CLAUDE.md §1. The detailed
          eligibility conditions and document list are the syndicate's to
          state, so this page routes to them rather than guessing. */}
      <ProseSection heading={t('joinPage.eligibilityTitle')}>
        <p>{t('joinPage.eligibilityBody')}</p>
      </ProseSection>

      <ProseSection heading={t('joinPage.documentsTitle')}>
        <p>{t('joinPage.documentsBody')}</p>
      </ProseSection>

      <ProseSection heading={t('joinPage.howTitle')}>
        <p>{t('joinPage.howBody')}</p>
        <Card className="mt-4 flex items-start gap-3 border-dashed bg-surface-sunken p-4">
          <Clock className="mt-0.5 size-4 shrink-0 text-text-accent" aria-hidden />
          <p className="text-[length:var(--type-sm)] text-text-secondary">
            {t('joinPage.onlineSoon')}
          </p>
        </Card>
      </ProseSection>
    </ProsePage>
  )
}
