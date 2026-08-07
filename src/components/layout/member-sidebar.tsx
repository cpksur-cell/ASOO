'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Award,
  Bell,
  FileCheck,
  FileText,
  LayoutDashboard,
  MessageSquareWarning,
  RefreshCw,
  UserCircle,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/cn'

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  subscriptions: Wallet,
  reports: FileCheck,
  profile: UserCircle,
  renewal: RefreshCw,
  certificates: Award,
  complaints: MessageSquareWarning,
  notifications: Bell,
}

export interface MemberNavItem {
  key: string
  label: string
  href: string
  /** Optional unread/attention count shown as a badge. */
  count?: number
  /** Marks the exact-match root so it isn't highlighted on every child route. */
  exact?: boolean
}

export function MemberSidebar({ items }: { items: MemberNavItem[] }) {
  const pathname = usePathname()

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        const Icon = ICONS[item.key] ?? FileText
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-3',
                'text-[length:var(--type-sm)] font-medium transition-colors duration-[120ms]',
                active
                  ? 'bg-surface-brand-subtle text-text-brand'
                  : 'text-text-secondary hover:bg-surface-sunken hover:text-text-primary',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.count ? (
                <span
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface-accent px-1.5 text-[0.7rem] font-bold text-text-on-accent"
                  data-numeric
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
