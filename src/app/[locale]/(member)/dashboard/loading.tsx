import { DashboardSkeleton } from '@/components/features/loading-skeletons'

/**
 * Covers the member dashboard and any child route without its own loading
 * file, so no member screen can render blank while data is in flight.
 */
export default function Loading() {
  return <DashboardSkeleton />
}
