import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { getRepository } from '@/lib/data'
import { href } from '@/lib/routes'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { PageHeader } from '@/components/ui/primitives'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { GovLinkCard } from '@/components/features/cards'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('maps.title'),
    description: t('maps.intro'),
    alternates: { canonical: href(locale, 'maps'), languages: { 'ar-JO': '/ar/maps', en: '/en/maps' } },
  }
}

export default async function MapsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  const t = createTranslator(getDictionary(typed))
  const repo = getRepository()
  const [maps, gov] = await Promise.all([
    repo.listExternalLinks('survey_maps', typed),
    repo.listExternalLinks('gov_services', typed),
  ])

  return (
    <>
      <Breadcrumbs locale={typed} items={[{ label: t('maps.title') }]} />
      <PageHeader title={t('maps.title')} intro={t('maps.intro')} />

      <div className="container-page py-12">
        <RevealGroup as="ul" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {maps.map((link) => (
            <RevealItem key={link.id} as="li">
              <GovLinkCard link={link} locale={typed} />
            </RevealItem>
          ))}
        </RevealGroup>

        <section className="mt-16 border-t border-border-subtle pt-12">
          <h2 className="text-[length:var(--type-2xl)] font-semibold text-text-primary">
            {t('home.govServicesHeading')}
          </h2>
          <div className="mt-3 h-[3px] w-14 rounded-full bg-surface-rule" aria-hidden />
          <RevealGroup as="ul" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gov.map((link) => (
              <RevealItem key={link.id} as="li">
                <GovLinkCard link={link} locale={typed} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      </div>
    </>
  )
}
