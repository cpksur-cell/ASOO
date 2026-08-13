import { CheckCircle2, Clock, Loader, XCircle } from 'lucide-react'

import { StatusBadge, type StatusTone } from '@/components/ui/primitives'
import type { ServiceRequestStatus } from '@/lib/service-requests'

/**
 * One mapping from request status to tone + icon, used by both the member's
 * list and the staff queue.
 *
 * Never colour alone — StatusBadge always carries an icon and the label, so a
 * "declined" is legible to someone who cannot distinguish red from green.
 */
const PRESENTATION: Record<
  ServiceRequestStatus,
  { tone: StatusTone; icon: React.ReactNode; labelKey: string }
> = {
  submitted: { tone: 'pending', icon: <Clock />, labelKey: 'statusSubmitted' },
  in_progress: { tone: 'warning', icon: <Loader />, labelKey: 'statusInProgress' },
  fulfilled: { tone: 'active', icon: <CheckCircle2 />, labelKey: 'statusFulfilled' },
  rejected: { tone: 'overdue', icon: <XCircle />, labelKey: 'statusRejected' },
}

export function serviceRequestStatusKey(status: ServiceRequestStatus): string {
  return `serviceRequests.${PRESENTATION[status].labelKey}`
}

export function ServiceRequestStatusBadge({
  status,
  label,
}: {
  status: ServiceRequestStatus
  label: string
}) {
  const { tone, icon } = PRESENTATION[status]
  return (
    <StatusBadge tone={tone} icon={icon}>
      {label}
    </StatusBadge>
  )
}
