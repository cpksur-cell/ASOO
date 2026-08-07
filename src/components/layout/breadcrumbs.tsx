import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { createTranslator, getDictionary, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { siteUrl } from '@/lib/site'

export interface Crumb {
  label: string
  path?: string
}

/**
 * Mirrors the URL exactly. Every segment links except the current page.
 * The separator mirrors in RTL along with the reading flow.
 * docs/04-site-architecture.md §5.5.
 */
export function Breadcrumbs({ locale, items }: { locale: Locale; items: Crumb[] }) {
  const t = createTranslator(getDictionary(locale))
  const all: Crumb[] = [{ label: t('nav.home'), path: '' }, ...items]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.path !== undefined ? { item: `${siteUrl}${href(locale, c.path)}` } : {}),
    })),
  }

  return (
    <nav aria-label={t('common.breadcrumb')} className="border-b border-border-subtle bg-surface-sunken">
      <div className="container-page">
        <ol className="flex flex-wrap items-center gap-1 py-3 text-[length:var(--type-sm)]">
          {all.map((crumb, i) => {
            const last = i === all.length - 1
            return (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronLeft
                    className="size-4 text-text-muted"
                    data-mirror="true"
                    aria-hidden
                  />
                )}
                {last || crumb.path === undefined ? (
                  <span aria-current="page" className="font-medium text-text-primary">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={href(locale, crumb.path)}
                    className="text-text-secondary transition-colors hover:text-text-brand"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </nav>
  )
}
