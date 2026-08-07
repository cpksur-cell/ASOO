import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { isLocale } from '@/i18n/config'
import { siteUrl } from '@/lib/site'
import { getDictionary } from '@/i18n/config'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

export default async function PublicLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOrganization',
    name: dict.site.fullName,
    alternateName: dict.site.name,
    url: `${siteUrl}/${locale}`,
    foundingDate: '1999',
    description: dict.site.description,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Amman',
      addressCountry: 'JO',
    },
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} />
      <main id="main" className="flex-1">
        {children}
      </main>
      {/* Clears the fixed bottom tab bar and the gesture area on mobile. */}
      <div className="pb-bottom-nav">
        <SiteFooter locale={locale} />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
