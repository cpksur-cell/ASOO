import Link from 'next/link'
import { Compass } from 'lucide-react'

import ar from '@/messages/ar.json'

/**
 * Next renders not-found outside the `[locale]` params context, so the locale
 * is not readable here. Arabic is the default, and the English label is shown
 * alongside so a non-Arabic reader is not stranded.
 */
export default function NotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-canvas px-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-lg bg-surface-brand text-text-on-brand">
            <Compass className="size-8" aria-hidden strokeWidth={1.5} />
          </span>

          <p className="mt-8 text-[length:var(--type-5xl)] font-bold tracking-tight text-text-primary">
            <span data-numeric>404</span>
          </p>

          <h1 className="mt-4 text-[length:var(--type-2xl)] font-semibold text-text-primary">
            {ar.error.notFoundTitle}
          </h1>
          <div className="mt-4 h-[3px] w-14 rounded-full bg-surface-rule" aria-hidden />
          <p className="prose-measure mt-5 text-text-secondary">{ar.error.notFoundBody}</p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/ar"
              className="inline-flex min-h-11 items-center rounded-md bg-surface-brand px-6 font-medium text-text-on-brand transition-colors hover:bg-primary-600"
            >
              {ar.common.backToHome}
            </Link>
            <Link
              href="/en"
              lang="en"
              dir="ltr"
              className="inline-flex min-h-11 items-center rounded-md border border-border-default px-6 font-medium text-text-brand transition-colors hover:bg-surface-sunken"
            >
              English
            </Link>
          </div>
        </main>
      </body>
    </html>
  )
}
