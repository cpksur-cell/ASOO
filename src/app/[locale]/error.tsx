'use client'

import { ErrorState } from '@/components/features/error-state'

/**
 * Recovery boundary for every public page in a locale. Catches render and data
 * failures — including a Supabase query that throws — and offers retry instead
 * of Next's blank default error screen.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorState error={error} reset={reset} />
}
