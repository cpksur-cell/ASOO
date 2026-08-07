import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BadgeCheck, Building2, CalendarDays, Mail, MapPin, Phone } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate } from '@/i18n/format'
import { getRepository } from '@/lib/data'
import { href } from '@/lib/routes'
import { siteUrl } from '@/lib/site'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Card, Mono, StatusBadge, Tag } from '@/components/ui/primitives'
import { CadastralPlan } from '@/components/ui/cadastral-plan'



export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; license: string }>
}): Promise<Metadata> {
  const { locale, license } = await params
  if (!isLocale(locale)) return {}
  const member = await getRepository().getMemberByLicense(license, locale)
  if (!member) return {}

  return {
    title: member.fullName,
    description: `${member.officeName ?? member.fullName} — ${member.governorate.name}`,
    alternates: { canonical: href(locale, `directory/${license}`) },
  }
}

export default async function MemberPage({
  params,
}: {
  params: Promise<{ locale: string; license: string }>
}) {
  const { locale, license } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  const member = await getRepository().getMemberByLicense(license, typed)
  if (!member) notFound()

  const t = createTranslator(getDictionary(typed))

  /* Individually indexable member pages are this site's strongest SEO
     differentiator — no other surface lists Jordanian surveyors one by one. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: member.officeName ?? member.fullName,
    url: `${siteUrl}${href(typed, `directory/${license}`)}`,
    areaServed: member.governorate.name,
    identifier: member.licenseNumber,
    address: { '@type': 'PostalAddress', addressLocality: member.governorate.name, addressCountry: 'JO' },
    ...(member.directoryPhone ? { telephone: member.directoryPhone } : {}),
  }

  return (
    <>
      <Breadcrumbs
        locale={typed}
        items={[
          { label: t('directory.title'), path: 'directory' },
          { label: member.governorate.name, path: `directory/governorate/${member.governorate.code}` },
          { label: member.fullName },
        ]}
      />

      <header className="relative overflow-hidden border-b border-border-subtle bg-surface-default">
        <CadastralPlan className="opacity-70" />
        <div className="container-page relative py-12">
          <div className="flex flex-wrap items-start gap-5">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-surface-brand text-text-on-brand">
              <Building2 className="size-8" aria-hidden strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[length:var(--type-3xl)] font-bold tracking-tight text-text-primary">
                  {member.fullName}
                </h1>
                <StatusBadge tone="active" icon={<BadgeCheck />}>
                  {t('status.active')}
                </StatusBadge>
              </div>
              {member.officeName && (
                <p className="mt-2 text-[length:var(--type-lg)] text-text-secondary">
                  {member.officeName}
                </p>
              )}
              <div className="mt-4 h-[3px] w-14 rounded-full bg-surface-rule" aria-hidden />
            </div>
          </div>
        </div>
      </header>

      <div className="container-page grid gap-6 py-12 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">
            {t('directory.office')}
          </h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-[length:var(--type-sm)] text-text-muted">
                {t('directory.licenseNumber')}
              </dt>
              <dd className="mt-1 text-[length:var(--type-base)] font-semibold text-text-primary">
                <Mono>{member.licenseNumber}</Mono>
              </dd>
            </div>
            <div>
              <dt className="text-[length:var(--type-sm)] text-text-muted">
                {t('directory.governorate')}
              </dt>
              <dd className="mt-1">
                <Link
                  href={href(typed, `directory/governorate/${member.governorate.code}`)}
                  className="inline-flex items-center gap-1.5 font-medium text-text-brand hover:underline"
                >
                  <MapPin className="size-4" aria-hidden />
                  {member.governorate.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-[length:var(--type-sm)] text-text-muted">
                {t('news.published')}
              </dt>
              <dd className="mt-1 inline-flex items-center gap-1.5 text-text-primary">
                <CalendarDays className="size-4 text-text-muted" aria-hidden />
                <span data-numeric>{formatDate(member.joinedAt, typed)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[length:var(--type-sm)] text-text-muted">
                {t('directory.office')}
              </dt>
              <dd className="mt-1 text-text-primary">{member.category}</dd>
            </div>
          </dl>

          {member.specializations.length > 0 && (
            <div className="mt-6 border-t border-border-subtle pt-6">
              <h3 className="text-[length:var(--type-sm)] font-medium text-text-muted">
                {t('directory.specializations')}
              </h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {member.specializations.map((s) => (
                  <li key={s}>
                    <Tag>{s}</Tag>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="h-fit p-6">
          <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">
            {t('contact.title')}
          </h2>
          <div className="mt-3 h-[3px] w-10 rounded-full bg-surface-rule" aria-hidden />
          <ul className="mt-5 flex flex-col gap-4 text-[length:var(--type-sm)]">
            {member.directoryAddress && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
                <span className="text-text-secondary">{member.directoryAddress}</span>
              </li>
            )}
            {member.directoryPhone && (
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-text-muted" aria-hidden />
                <a
                  href={`tel:${member.directoryPhone.replace(/\s/g, '')}`}
                  className="text-text-brand hover:underline"
                >
                  <span data-ltr>{member.directoryPhone}</span>
                </a>
              </li>
            )}
            {member.directoryEmail && (
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-text-muted" aria-hidden />
                <a href={`mailto:${member.directoryEmail}`} className="text-text-brand hover:underline">
                  <span data-ltr>{member.directoryEmail}</span>
                </a>
              </li>
            )}
          </ul>
        </Card>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  )
}
