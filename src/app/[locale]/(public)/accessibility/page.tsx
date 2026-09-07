import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { Card } from '@/components/ui/primitives'
import { ProseList, ProsePage, ProseSection } from '@/components/features/prose-page'

const PATH = 'accessibility'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('accessibility.title'),
    description: t('accessibility.intro'),
    alternates: {
      canonical: href(locale, PATH),
      languages: { 'ar-JO': `/ar/${PATH}`, en: `/en/${PATH}` },
    },
  }
}

export default async function AccessibilityPage({
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
      title={t('accessibility.title')}
      intro={t('accessibility.intro')}
      aside={
        <Card className="p-6">
          <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">
            {t('accessibility.feedbackTitle')}
          </h2>
          <p className="mt-2 leading-[var(--leading-body)] text-text-secondary">
            {t('accessibility.feedbackBody')}
          </p>
          <Link
            href={href(typed, 'contact')}
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-surface-brand px-5 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
          >
            {t('nav.contact')}
          </Link>
        </Card>
      }
    >
      <ProseSection heading={t('accessibility.standardTitle')}>
        <p>{t('accessibility.standardBody')}</p>
      </ProseSection>

      {/*
        Each of these is a property the build actually enforces — the contrast
        claim is checked by `npm run audit:tokens` on every build, and the
        status claim by the StatusBadge primitive, which cannot render without
        an icon. An accessibility statement that overclaims is worse than none.
      */}
      <ProseSection heading={t('accessibility.doneTitle')}>
        <ProseList
          items={[
            t('accessibility.doneContrast'),
            t('accessibility.doneKeyboard'),
            t('accessibility.doneRtl'),
            t('accessibility.doneMotion'),
            t('accessibility.doneStatus'),
          ]}
        />
      </ProseSection>

      {/* Stating the gap is the part that makes the rest credible. */}
      <ProseSection heading={t('accessibility.knownTitle')}>
        <p>{t('accessibility.knownBody')}</p>
      </ProseSection>
    </ProsePage>
  )
}
