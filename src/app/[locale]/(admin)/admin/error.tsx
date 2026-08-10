'use client'

import { ErrorState } from '@/components/features/error-state'

/**
 * Admin boundary. The copy states that the request failed BEFORE any change
 * was made — after a failed approval or status change, staff need to know
 * whether to retry or whether they have half-applied a mutation.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState error={error} reset={reset} titleKey="adminTitle" bodyKey="adminBody" />
  )
}
