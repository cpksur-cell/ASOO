import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BadgeCheck, QrCode } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { Card, EmptyState } from '@/components/ui/primitives'
import { ButtonLink } from '@/components/ui/button'
import { ProsePage } from '@/components/features/prose-page'

const PATH = 'services/verify'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('services.verifyTitle'),
    description: t('services.verifyIntro'),
    alternates: {
      canonical: href(locale, PATH),
      languages: { 'ar-JO': `/ar/${PATH}`, en: `/en/${PATH}` },
    },
  }
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  /*
   * This page was linked from the E-Services grid and the footer while the
   * route did not exist — both went to a 404.
   *
   * The honest fix is not a fake code box. Certificates are a Phase 4
   * capability and the syndicate has issued none, so any code entered here
   * could only ever fail, which reads as a broken service rather than an
   * unstarted one. Instead: say so, and route people to report verification,
   * which IS live and is what most people arriving here actually hold.
   */
  return (
    <ProsePage
      locale={typed}
      title={t('services.verifyTitle')}
      intro={t('services.verifyIntro')}
      trail={[{ label: t('services.title'), path: 'services' }]}
    >
      <EmptyState
        icon={<BadgeCheck />}
        title={t('verifyPage.notYetTitle')}
        body={t('verifyPage.notYetBody')}
      />

      <Card className="flex flex-col items-start gap-4 p-6">
        <span className="flex size-11 items-center justify-center rounded-lg bg-surface-brand-subtle text-text-brand">
          <QrCode className="size-5" aria-hidden strokeWidth={1.75} />
        </span>
        <p className="leading-[var(--leading-body)] text-text-secondary">
          {t('verifyPage.reportAlt')}
        </p>
        <ButtonLink href={href(typed, 'services/verify-report')} variant="primary" withArrow>
          {t('verifyPage.reportCta')}
        </ButtonLink>
      </Card>
    </ProsePage>
  )
}
