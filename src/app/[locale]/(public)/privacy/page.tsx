import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import {
  PendingApprovalNote,
  ProseList,
  ProsePage,
  ProseSection,
} from '@/components/features/prose-page'

const PATH = 'privacy'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('privacy.title'),
    description: t('privacy.intro'),
    alternates: {
      canonical: href(locale, PATH),
      languages: { 'ar-JO': `/ar/${PATH}`, en: `/en/${PATH}` },
    },
  }
}

export default async function PrivacyPage({
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
      title={t('privacy.title')}
      intro={t('privacy.intro')}
      aside={
        <PendingApprovalNote title={t('legal.pendingTitle')} body={t('legal.pendingBody')} />
      }
    >
      {/*
        Every claim on this page is checked against the implementation:
        the directory policy mirrors the `public_read_directory_members` RLS
        policy, the ownership claim mirrors the auth.uid()-bound policies, and
        the storage claim mirrors the private `reports` bucket with no anon
        policy. If one of those changes, this page is wrong and must change too.
      */}
      <ProseSection heading={t('privacy.collectTitle')}>
        <ProseList
          items={[
            t('privacy.collectPublic'),
            t('privacy.collectDirectory'),
            t('privacy.collectAccount'),
            t('privacy.collectRequests'),
            t('privacy.collectReports'),
          ]}
        />
      </ProseSection>

      <ProseSection heading={t('privacy.useTitle')}>
        <p>{t('privacy.useBody')}</p>
      </ProseSection>

      <ProseSection heading={t('privacy.accessTitle')}>
        <p>{t('privacy.accessBody')}</p>
      </ProseSection>

      <ProseSection heading={t('privacy.filesTitle')}>
        <p>{t('privacy.filesBody')}</p>
      </ProseSection>

      <ProseSection heading={t('privacy.rightsTitle')}>
        <p>{t('privacy.rightsBody')}</p>
      </ProseSection>
    </ProsePage>
  )
}
