import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Mono, Readex_Pro } from 'next/font/google'
import { AuthProvider } from '@/lib/auth/client'

import {
  getDictionary,
  isLocale,
  localeDirection,
  localeHrefLang,
  locales,
  type Locale,
} from '@/i18n/config'
import { siteUrl } from '@/lib/site'

/**
 * Self-hosted at build time by next/font — no third-party font CDN on a
 * government site. docs/05-design-system.md §3.
 *
 * Readex Pro carries the display voice across BOTH scripts from one variable
 * family, so an Arabic headline and its English translation share a skeleton
 * rather than reading as two different products.
 */
const readex = Readex_Pro({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-loaded-display',
  display: 'swap',
})

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-loaded-arabic',
  display: 'swap',
})

const plexLatin = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-loaded-latin',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-loaded-mono',
  display: 'swap',
})

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const dict = getDictionary(locale)

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${dict.site.fullName}`,
      template: `%s — ${dict.site.name}`,
    },
    description: dict.site.description,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        [localeHrefLang.ar]: '/ar',
        [localeHrefLang.en]: '/en',
        // Arabic is x-default — the primary audience is Jordanian.
        'x-default': '/ar',
      },
    },
    openGraph: {
      type: 'website',
      siteName: dict.site.name,
      title: dict.site.fullName,
      description: dict.site.description,
      locale: locale === 'ar' ? 'ar_JO' : 'en_US',
    },
    robots: { index: true, follow: true },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const typed: Locale = locale

  return (
    <html
      lang={typed}
      dir={localeDirection[typed]}
      className={`${readex.variable} ${plexArabic.variable} ${plexLatin.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Applies an EXPLICIT stored theme before first paint, to avoid a flash
          of the wrong theme. Critically, when nothing is stored it leaves
          `data-theme` UNSET, so the `prefers-color-scheme` media query in
          tokens.generated.css governs — day/dark then follows the device by
          default, which is the requested behaviour. Setting the attribute to
          'light' here (as a previous edit did) would permanently disable
          device dark mode for every visitor who never touched the toggle.
          Inline and synchronous by necessity; runs before the body exists.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('asoo-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
