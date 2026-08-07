import { AlertTriangle, BadgeCheck, Clock } from 'lucide-react'

import { StatusBadge } from '@/components/ui/primitives'

/**
 * The persistent membership-status indicator.
 *
 * A member's standing is the single most consequential fact in the dashboard,
 * so it is shown on every screen and derived from real state, not decoration.
 * An overdue balance overrides the "active" status — because to the member,
 * "you owe money and it's late" matters more than "your record says active".
 * docs/06-ux-flows.md §2.
 */
export function MemberStatusPill({
  hasOverdue,
  expiringSoon,
  labels,
}: {
  hasOverdue: boolean
  expiringSoon: boolean
  labels: { active: string; overdue: string; expiring: string }
}) {
  if (hasOverdue) {
    return (
      <StatusBadge tone="overdue" icon={<AlertTriangle />}>
        {labels.overdue}
      </StatusBadge>
    )
  }
  if (expiringSoon) {
    return (
      <StatusBadge tone="warning" icon={<Clock />}>
        {labels.expiring}
      </StatusBadge>
    )
  }
  return (
    <StatusBadge tone="active" icon={<BadgeCheck />}>
      {labels.active}
    </StatusBadge>
  )
}
