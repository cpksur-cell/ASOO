'use client'

import { ErrorState } from '@/components/features/error-state'

/**
 * Member dashboard boundary. The copy reassures explicitly that the member's
 * data is safe — a failed READ must never read like lost records to someone
 * looking at their own subscription or licence.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      titleKey="dashboardTitle"
      bodyKey="dashboardBody"
    />
  )
}
