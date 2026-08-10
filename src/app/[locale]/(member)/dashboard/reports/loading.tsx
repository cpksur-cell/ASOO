import { ListSkeleton } from '@/components/features/loading-skeletons'

/** Orders + their latest submission — a Postgres round-trip per order. */
export default function Loading() {
  return <ListSkeleton rows={3} />
}
