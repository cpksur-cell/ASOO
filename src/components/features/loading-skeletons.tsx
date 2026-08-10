'use client'

import { usePathname } from 'next/navigation'

import ar from '@/messages/ar.json'
import en from '@/messages/en.json'
import { Card, Skeleton } from '@/components/ui/primitives'

/**
 * Route-level loading screens.
 *
 * Each skeleton mirrors the SHAPE of the page it stands in for, so when the
 * data arrives nothing moves — the layout was already correct (CLS ≈ 0,
 * ui-ux-pro-max §3 `content-jumping`). This matters more since the report and
 * review screens started reading from Postgres: a network round-trip that used
 * to be an in-memory lookup now has real latency behind it.
 *
 * Client components because `loading.tsx` receives no props and therefore no
 * locale — the same constraint that shapes ErrorState. Only the announcement
 * needs the dictionary; the boxes themselves are `aria-hidden`.
 */

const dictionaries = { ar, en } as const

function useLoadingLabel(): string {
  const pathname = usePathname()
  const locale = pathname?.split('/')[1] === 'en' ? 'en' : 'ar'
  return dictionaries[locale].common.loading
}

/**
 * Wraps a skeleton with the single announcement a screen reader should hear.
 * `aria-live="polite"` waits for a pause rather than interrupting.
 */
function Shell({ children }: { children: React.ReactNode }) {
  const label = useLoadingLabel()
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      {children}
    </div>
  )
}

/** Header block: title bar, rule, intro line — matches PageHeader. */
function HeaderSkeleton() {
  return (
    <div className="mb-8">
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="mt-4 h-[3px] w-16" />
      <Skeleton className="mt-6 h-5 w-full max-w-prose" />
    </div>
  )
}

/** A stack of record cards — orders, invoices, members, review queue. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Shell>
      <HeaderSkeleton />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-3 h-5 w-3/4 max-w-sm" />
                <Skeleton className="mt-2 h-3.5 w-32" />
              </div>
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border-subtle pt-4">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  )
}

/** Overview screens: a row of stat tiles above a list. */
export function DashboardSkeleton() {
  return (
    <Shell>
      <HeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="mt-4 h-3.5 w-24" />
            <Skeleton className="mt-2.5 h-7 w-32" />
          </Card>
        ))}
      </div>
      <div className="mt-8 space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-1/2 max-w-xs" />
            <Skeleton className="mt-3 h-3.5 w-full max-w-md" />
          </Card>
        ))}
      </div>
    </Shell>
  )
}
