import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BadgeCheck, Clock, CreditCard, QrCode, Receipt, ShieldCheck } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Card, PageHeader } from '@/components/ui/primitives'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import { ButtonLink } from '@/components/ui/button'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('services.title'),
    description: t('services.intro'),
    alternates: {
      canonical: href(locale, 'services'),
      languages: { 'ar-JO': '/ar/services', en: '/en/services' },
    },
  }
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  const services = [
    {
      icon: CreditCard,
      title: t('services.payTitle'),
      body: t('services.payIntro'),
      path: 'services/pay',
      cta: t('services.payLookup'),
      primary: true,
    },
    {
      icon: BadgeCheck,
      title: t('services.verifyTitle'),
      body: t('services.verifyIntro'),
      path: 'services/verify',
      cta: t('services.verifySubmit'),
      primary: false,
    },
    {
      icon: QrCode,
      title: t('reports.verifyTitle'),
      body: t('reports.verifyIntro'),
      path: 'services/verify-report',
      cta: t('reports.verifySubmit'),
      primary: false,
    },
  ]

  return (
    <>
      <Breadcrumbs locale={typed} items={[{ label: t('services.title') }]} />
      <PageHeader title={t('services.title')} intro={t('services.intro')} />

      <div className="container-page py-12">
        <RevealGroup as="ul" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {services.map((s) => (
            <RevealItem key={s.path} as="li">
              <Card className="flex h-full flex-col p-6 md:p-8">
                <span className="flex size-12 items-center justify-center rounded-lg bg-surface-brand-subtle text-text-brand">
                  <s.icon className="size-6" aria-hidden strokeWidth={1.75} />
                </span>
                <h2 className="mt-5 text-[length:var(--type-xl)] font-semibold text-text-primary">
                  {s.title}
                </h2>
                <div className="mt-3 h-[3px] w-10 rounded-full bg-surface-rule" aria-hidden />
                <p className="mt-4 flex-1 leading-[var(--leading-body)] text-text-secondary">
                  {s.body}
                </p>
                <div className="mt-6">
                  <ButtonLink
                    href={href(typed, s.path)}
                    variant={s.primary ? 'primary' : 'secondary'}
                    withArrow
                  >
                    {s.cta}
                  </ButtonLink>
                </div>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal className="mt-10">
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-4 border-dashed p-6">
            <Assurance icon={<ShieldCheck />}>{t('services.assuranceSecure')}</Assurance>
            <Assurance icon={<Receipt />}>{t('services.assuranceReceipt')}</Assurance>
            <Assurance icon={<Clock />}>{t('services.assuranceAlways')}</Assurance>
          </Card>
        </Reveal>
      </div>
    </>
  )
}

function Assurance({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[length:var(--type-sm)] text-text-secondary">
      <span className="text-text-accent [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  )
}
