import { DashboardSkeleton } from '@/components/features/loading-skeletons'

/** Default admin loading state; specific screens may override it. */
export default function Loading() {
  return <DashboardSkeleton />
}
