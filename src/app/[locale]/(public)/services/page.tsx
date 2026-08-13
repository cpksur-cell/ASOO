import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  CreditCard,
  Map,
  QrCode,
  Receipt,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { mapEmbedUrl, mapViewUrl, syndicateMaps } from '@/lib/site'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Card, PageHeader } from '@/components/ui/primitives'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import { ButtonLink } from '@/components/ui/button'
import { EmbeddedMap } from '@/components/features/embedded-map'

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
    // The two counter services the syndicate performs at the Department of
    // Lands and Survey. Both take one field — the DLS key.
    {
      icon: Map,
      title: t('serviceRequests.plateTitle'),
      body: t('serviceRequests.plateIntro'),
      path: 'services/electronic-plate',
      cta: t('serviceRequests.requestCta'),
      primary: false,
    },
    {
      icon: ScrollText,
      title: t('serviceRequests.changeTitle'),
      body: t('serviceRequests.changeIntro'),
      path: 'services/change-statement',
      cta: t('serviceRequests.requestCta'),
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

        {/*
          The syndicate's maps, embedded here as well as on /maps. Consulting a
          map is part of doing the work the other services on this page start,
          so making people leave for it would be an odd seam. Same source of
          truth (`syndicateMaps`) — a map swapped there changes in both places.
        */}
        <section className="mt-16 border-t border-border-subtle pt-12">
          <h2 className="text-[length:var(--type-2xl)] font-semibold text-text-primary">
            {t('services.mapsHeading')}
          </h2>
          <div className="mt-3 h-[3px] w-14 rounded-full bg-surface-rule" aria-hidden />
          <p className="prose-measure mt-4 text-text-secondary">{t('services.mapsIntro')}</p>

          <RevealGroup className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {syndicateMaps.map((map) => (
              <RevealItem key={map.id}>
                <EmbeddedMap
                  src={mapEmbedUrl(map.id)}
                  title={t(map.titleKey)}
                  hint={t('maps.mapFrameHint')}
                  openLabel={t('maps.openInGoogleMaps')}
                  openHref={mapViewUrl(map.id)}
                />
              </RevealItem>
            ))}
          </RevealGroup>

          <Link
            href={href(typed, 'maps')}
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-[length:var(--type-sm)] font-semibold text-text-brand hover:underline"
          >
            {t('services.viewAllMaps')}
            <ArrowLeft className="size-4" data-mirror="true" aria-hidden />
          </Link>
        </section>
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
