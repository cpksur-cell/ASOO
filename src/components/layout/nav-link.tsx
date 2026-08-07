'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

import { cn } from '@/lib/cn'

/**
 * Desktop nav item. The active indicator is a shared layout element, so
 * moving between items slides the marker rather than cross-fading two —
 * spatial continuity. ui-ux-pro-max §7 `continuity`.
 */
export function NavLink({
  href,
  children,
  exact,
}: {
  href: string
  children: ReactNode
  exact?: boolean
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-11 items-center rounded-md px-2 xl:px-3 whitespace-nowrap',
        'text-[length:var(--type-xs)] xl:text-[length:var(--type-sm)] font-medium transition-colors duration-[120ms]',
        active ? 'text-text-on-brand' : 'text-primary-100 hover:text-text-on-brand',
      )}
    >
      {children}
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-inline-2 -bottom-px h-[3px] rounded-full bg-surface-accent"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          aria-hidden
        />
      )}
    </Link>
  )
}
