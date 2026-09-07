import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import {
  PendingApprovalNote,
  ProsePage,
  ProseSection,
} from '@/components/features/prose-page'

const PATH = 'terms'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('terms.title'),
    description: t('terms.intro'),
    alternates: {
      canonical: href(locale, PATH),
      languages: { 'ar-JO': `/ar/${PATH}`, en: `/en/${PATH}` },
    },
  }
}

export default async function TermsPage({
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
      title={t('terms.title')}
      intro={t('terms.intro')}
      aside={
        <PendingApprovalNote title={t('legal.pendingTitle')} body={t('legal.pendingBody')} />
      }
    >
      <ProseSection heading={t('terms.useTitle')}>
        <p>{t('terms.useBody')}</p>
      </ProseSection>

      <ProseSection heading={t('terms.accountTitle')}>
        <p>{t('terms.accountBody')}</p>
      </ProseSection>

      {/* The map disclaimer is not boilerplate: the embedded Google My Maps
          layers are published for orientation and are explicitly NOT a survey
          product. Saying so is the point of this section. */}
      <ProseSection heading={t('terms.dataTitle')}>
        <p>{t('terms.dataBody')}</p>
      </ProseSection>

      <ProseSection heading={t('terms.serviceTitle')}>
        <p>{t('terms.serviceBody')}</p>
      </ProseSection>
    </ProsePage>
  )
}
