'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Languages } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * Switches locale while preserving the current path and query.
 *
 * Slugs are locale-independent (ASCII, transliterated), so `/ar/news/x` maps
 * straight to `/en/news/x` with no lookup table.
 *
 * Switching writes the `asoo_locale` cookie, which the middleware treats as an
 * explicit choice that OUTRANKS IP geolocation — otherwise a visitor in an
 * Arab-region IP who deliberately picked English would be flipped back to
 * Arabic on their next visit to `/`.
 */
export function LocaleSwitcher({
  locale,
  label,
  className,
}: {
  locale: 'ar' | 'en'
  label: string
  className?: string
}) {
  const pathname = usePathname()
  const target = locale === 'ar' ? 'en' : 'ar'
  const rest = pathname.replace(/^\/(ar|en)/, '')
  const nextPath = `/${target}${rest}`

  function persistChoice() {
    // One year, path-wide, Lax. A language preference is not sensitive.
    document.cookie = `asoo_locale=${target}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <Link
      href={nextPath}
      hrefLang={target}
      lang={target}
      dir={target === 'ar' ? 'rtl' : 'ltr'}
      onClick={persistChoice}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3',
        'text-sm font-medium transition-colors duration-[120ms]',
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      {label}
    </Link>
  )
}
