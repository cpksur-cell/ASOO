'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'

import ar from '@/messages/ar.json'
import en from '@/messages/en.json'
import { Card } from '@/components/ui/primitives'

/**
 * The shared recovery screen behind every `error.tsx` boundary.
 *
 * ui-ux-pro-max §8 `error-recovery`: an error must state what happened AND
 * offer a way out. Next's default error page offers neither, and on a
 * government portal a dead end means a member simply cannot pay their bill.
 *
 * WHY IT IMPORTS THE DICTIONARIES DIRECTLY
 * `error.tsx` is always a client component and receives no props, so it cannot
 * take server-resolved labels the way every other component here does — and
 * `@/i18n/config` is `server-only`. Importing the JSON keeps ONE source of
 * truth for the strings (CLAUDE.md §9) at the cost of bundling them; the
 * alternative, hardcoding Arabic in the component, is a defect.
 *
 * The raw error message is never rendered — it can carry a query fragment or
 * connection string. Only Next's opaque `digest` is shown, which is what
 * support needs to find the matching server log.
 */

const dictionaries = { ar, en } as const

export function ErrorState({
  error,
  reset,
  titleKey = 'title',
  bodyKey = 'body',
}: {
  error: Error & { digest?: string }
  reset: () => void
  titleKey?: 'title' | 'dashboardTitle' | 'adminTitle'
  bodyKey?: 'body' | 'dashboardBody' | 'adminBody'
}) {
  const pathname = usePathname()
  const locale = pathname?.split('/')[1] === 'en' ? 'en' : 'ar'
  const t = dictionaries[locale].errorState

  useEffect(() => {
    // Surface it for the browser console / error reporting, without ever
    // painting the message into the DOM.
    console.error(error)
  }, [error])

  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
      <Card className="w-full max-w-md p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-status-overdue-bg text-status-overdue-fg">
          <AlertTriangle className="size-7" aria-hidden />
        </span>

        {/*
          role="alert" so the failure is announced immediately rather than
          silently replacing the page for a screen-reader user. WCAG 4.1.3.
        */}
        <div role="alert">
          <h1 className="mt-5 text-[length:var(--type-xl)] font-semibold text-text-primary">
            {t[titleKey]}
          </h1>
          <p className="prose-measure mt-3 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
            {t[bodyKey]}
          </p>
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-brand px-5 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t.retry}
          </button>
          <a
            href={`/${locale}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-default px-5 text-[length:var(--type-sm)] font-semibold text-text-secondary transition-colors hover:bg-surface-sunken"
          >
            <Home className="size-4" aria-hidden />
            {t.backHome}
          </a>
        </div>

        {error.digest && (
          <p className="mt-6 text-[length:var(--type-xs)] text-text-muted">
            {t.reference}: <span data-numeric>{error.digest}</span>
          </p>
        )}
      </Card>
    </div>
  )
}
