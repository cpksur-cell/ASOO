import { ListSkeleton } from '@/components/features/loading-skeletons'

/** The review queue reads every pending submission plus its order. */
export default function Loading() {
  return <ListSkeleton rows={4} />
}
