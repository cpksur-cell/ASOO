'use client'

import { useState } from 'react'
import { AlertTriangle, Award, Bell, CheckCheck, Megaphone, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { formatDateISO } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { Card, EmptyState } from '@/components/ui/primitives'

interface Item {
  id: string
  kind: 'renewal' | 'overdue' | 'certificate' | 'announcement'
  title: string
  createdAt: string
  read: boolean
}

const ICON: Record<Item['kind'], LucideIcon> = {
  overdue: AlertTriangle,
  renewal: RefreshCw,
  certificate: Award,
  announcement: Megaphone,
}

const TONE: Record<Item['kind'], string> = {
  overdue: 'text-status-overdue-fg',
  renewal: 'text-status-pending-fg',
  certificate: 'text-status-active-fg',
  announcement: 'text-text-brand',
}

export function NotificationList({
  initial,
  labels,
}: {
  initial: Item[]
  labels: { markAllRead: string; empty: string }
}) {
  const [items, setItems] = useState(initial)
  const hasUnread = items.some((i) => !i.read)

  if (items.length === 0) {
    return <EmptyState icon={<Bell />} title={labels.empty} />
  }

  return (
    <div>
      {hasUnread && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, read: true })))}
            className="inline-flex min-h-11 items-center gap-2 text-[length:var(--type-sm)] font-medium text-text-brand hover:underline"
          >
            <CheckCheck className="size-4" aria-hidden />
            {labels.markAllRead}
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = ICON[item.kind]
          return (
            <li key={item.id}>
              <Card
                className={cn(
                  'flex items-start gap-3 p-4',
                  !item.read && 'border-border-brand bg-surface-brand-subtle',
                )}
              >
                <span className={cn('mt-0.5', TONE[item.kind])}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="flex-1">
                  <p className="text-[length:var(--type-sm)] text-text-primary">{item.title}</p>
                  <p className="mt-0.5 text-[length:var(--type-xs)] text-text-muted" data-numeric>
                    {formatDateISO(item.createdAt)}
                  </p>
                </div>
                {!item.read && (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-surface-accent" aria-hidden />
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
