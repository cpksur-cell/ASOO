import type { ReactNode } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  CircleDashed,
  Clock,
  FileClock,
} from 'lucide-react'

import { StatusBadge, type StatusTone } from '@/components/ui/primitives'
import type { InvoiceStatus } from '@/lib/data/member-demo'

/** Member-page heading with the survey-station rule beneath it. */
export function MemberPageHeader({
  title,
  intro,
  action,
}: {
  title: string
  intro?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[length:var(--type-2xl)] font-bold text-text-primary">{title}</h1>
        <div className="mt-2 h-[3px] w-12 rounded-full bg-surface-rule" aria-hidden />
        {intro && (
          <p className="prose-measure mt-3 text-[length:var(--type-sm)] text-text-secondary">
            {intro}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

/** The demonstration-data banner, shown on every member screen until Phase 3. */
export function DemoBanner({ label }: { label: string }) {
  return (
    <p className="mb-6 rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-2.5 text-[length:var(--type-xs)] font-medium text-status-warning-fg">
      {label}
    </p>
  )
}

const INVOICE_TONE: Record<InvoiceStatus, StatusTone> = {
  overdue: 'overdue',
  issued: 'pending',
  partially_paid: 'warning',
  paid: 'active',
}

const INVOICE_ICON: Record<InvoiceStatus, ReactNode> = {
  overdue: <AlertTriangle />,
  issued: <FileClock />,
  partially_paid: <Clock />,
  paid: <BadgeCheck />,
}

/** Status always carries an icon and a label — never colour alone. */
export function InvoiceStatusBadge({
  status,
  label,
}: {
  status: InvoiceStatus
  label: string
}) {
  return (
    <StatusBadge tone={INVOICE_TONE[status]} icon={INVOICE_ICON[status]}>
      {label}
    </StatusBadge>
  )
}

export function GenericStatusBadge({
  tone,
  label,
}: {
  tone: StatusTone
  label: string
}) {
  const icon =
    tone === 'active' ? <BadgeCheck /> : tone === 'overdue' ? <AlertTriangle /> : <CircleDashed />
  return (
    <StatusBadge tone={tone} icon={icon}>
      {label}
    </StatusBadge>
  )
}
