import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Compass, Eye, Scale, Target } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { getRepository } from '@/lib/data'
import { aboutPillars } from '@/lib/data/seed'
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
    title: t('about.title'),
    alternates: { canonical: href(locale, 'about'), languages: { 'ar-JO': '/ar/about', en: '/en/about' } },
  }
}

const pillarIcons = { mission: Target, vision: Eye, values: Scale } as const

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  const t = createTranslator(getDictionary(typed))
  const page = await getRepository().getPage('about', typed)

  return (
    <>
      <Breadcrumbs locale={typed} items={[{ label: t('about.title') }]} />
      <PageHeader title={t('about.title')} />

      <div className="container-page py-12">
        <Reveal className="prose-measure">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-surface-accent-subtle px-3.5 py-1.5 text-[length:var(--type-sm)] font-semibold text-text-accent">
            <Compass className="size-4" aria-hidden />
            {t('site.founded')}
          </div>
          <p className="mt-6 text-[length:var(--type-lg)] leading-[var(--leading-body)] text-text-secondary">
            {page?.body}
          </p>
        </Reveal>

        <RevealGroup as="ul" className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {aboutPillars.map((p) => {
            const PillarIcon = pillarIcons[p.key as keyof typeof pillarIcons]
            return (
              <RevealItem key={p.key} as="li">
                <Card className="h-full p-6">
                  <span className="flex size-11 items-center justify-center rounded-md bg-surface-brand-subtle text-text-brand">
                    <PillarIcon className="size-5" aria-hidden strokeWidth={1.75} />
                  </span>
                  <h2 className="mt-4 text-[length:var(--type-lg)] font-semibold text-text-primary">
                    {p.title[typed]}
                  </h2>
                  <div className="mt-3 h-[3px] w-10 rounded-full bg-surface-rule" aria-hidden />
                  <p className="mt-4 leading-[var(--leading-body)] text-text-secondary">
                    {p.body[typed]}
                  </p>
                </Card>
              </RevealItem>
            )
          })}
        </RevealGroup>

        <Reveal className="mt-14 flex flex-wrap gap-3">
          <ButtonLink href={href(typed, 'directory')} withArrow>
            {t('nav.directory')}
          </ButtonLink>
          <ButtonLink href={href(typed, 'join')} variant="secondary">
            {t('nav.join')}
          </ButtonLink>
        </Reveal>
      </div>
    </>
  )
}
