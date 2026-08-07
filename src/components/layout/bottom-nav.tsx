'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Newspaper, Search, Wallet, Menu } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * Mobile primary navigation.
 *
 * A hamburger would bury the three things people actually come here to do —
 * verify a surveyor, pay a bill, read an announcement — behind a tap and a
 * scan. A bottom bar puts them in thumb reach.
 *
 * Four destinations plus "More", which opens the full drawer. Five is the
 * Material ceiling, and every item carries an icon AND a label because
 * icon-only navigation is a discoverability failure.
 */

const icons = { home: Home, directory: Search, services: Wallet, news: Newspaper } as const

export interface BottomNavItem {
  key: keyof typeof icons
  label: string
  href: string
  exact?: boolean
}

export function BottomNav({
  items,
  moreLabel,
  onMore,
}: {
  items: BottomNavItem[]
  moreLabel: string
  onMore: () => void
}) {
  const pathname = usePathname()

  return (
    <nav
      aria-label={moreLabel}
      className={cn(
        'fixed inset-x-0 bottom-0 w-full z-[1150] lg:hidden',
        'border-t border-border-subtle bg-surface-default/95 backdrop-blur-md',
        'safe-bottom',
      )}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const IconCmp = icons[item.key]

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-16 flex-col items-center justify-center gap-1 px-1',
                  'transition-colors duration-[120ms]',
                  active ? 'text-text-brand' : 'text-text-muted',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-active"
                    className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-surface-rule"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    aria-hidden
                  />
                )}
                <IconCmp
                  className="size-[22px]"
                  strokeWidth={active ? 2.1 : 1.75}
                  aria-hidden
                />
                <span className="text-[0.68rem] font-medium leading-none">{item.label}</span>
              </Link>
            </li>
          )
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={onMore}
            className="flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-text-muted transition-colors duration-[120ms]"
          >
            <Menu className="size-[22px]" strokeWidth={1.75} aria-hidden />
            <span className="text-[0.68rem] font-medium leading-none">{moreLabel}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}

/** Small hook so the header drawer and the bottom bar share one open state. */
export function useDrawer() {
  const [open, setOpen] = useState(false)
  return { open, setOpen }
}
