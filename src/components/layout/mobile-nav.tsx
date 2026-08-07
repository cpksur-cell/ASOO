'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { LogIn, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { slideIn, duration, ease, staggerGroup, staggerItem } from '@/lib/motion'
import type { Locale } from '@/i18n/client'
import { BottomNav, type BottomNavItem } from './bottom-nav'
import { ThemeToggle } from './theme-toggle'

/**
 * Mobile chrome: the bottom tab bar and the overflow drawer, sharing one open
 * state so "More" and the drawer can never disagree.
 *
 * The header carries no hamburger on mobile — the bottom bar is the primary
 * navigation there, and two competing menu affordances is one too many.
 */
export function MobileChrome({
  locale,
  drawerItems,
  bottomItems,
  labels,
}: {
  locale: Locale
  drawerItems: Array<{ label: string; href: string }>
  bottomItems: BottomNavItem[]
  labels: {
    menu: string
    more: string
    close: string
    login: string
    loginHref: string
    theme: string
    themeLight: string
    themeDark: string
    themeSystem: string
  }
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  // Close on navigation — otherwise the drawer survives the route change.
  useEffect(() => setOpen(false), [pathname])

  // Escape closes; body scroll locks while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <BottomNav items={bottomItems} moreLabel={labels.more} onMore={() => setOpen(true)} />

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: duration.exit } }}
              transition={{ duration: duration.normal, ease: ease.standard }}
              className="fixed inset-0 z-[1200] bg-primary-950/60 backdrop-blur-[3px] lg:hidden"
              onClick={() => setOpen(false)}
              aria-hidden
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={labels.menu}
              variants={slideIn(dir)}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                'fixed top-0 bottom-0 start-0 z-[1300] flex w-[min(21rem,88vw)] flex-col',
                'bg-surface-default shadow-xl lg:hidden',
              )}
            >
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <span className="text-[length:var(--type-sm)] font-semibold text-text-muted">
                  {labels.menu}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={labels.close}
                  className="inline-flex size-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-sunken"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

              <motion.nav
                variants={staggerGroup}
                initial="hidden"
                animate="visible"
                className="flex-1 overflow-y-auto p-2"
              >
                <ul className="flex flex-col gap-0.5">
                  {drawerItems.map((item) => {
                    const active = pathname === item.href
                    return (
                      <motion.li key={item.href} variants={staggerItem}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-12 items-center rounded-md px-3',
                            'text-[length:var(--type-base)] transition-colors duration-[120ms]',
                            active
                              ? 'bg-surface-brand-subtle font-semibold text-text-brand'
                              : 'text-text-secondary hover:bg-surface-sunken hover:text-text-primary',
                          )}
                        >
                          {item.label}
                        </Link>
                      </motion.li>
                    )
                  })}
                </ul>
              </motion.nav>

              <div className="flex flex-col gap-3 border-t border-border-subtle p-4 safe-bottom">
                <Link
                  href={labels.loginHref}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-surface-accent px-4 font-semibold text-text-on-accent"
                >
                  <LogIn className="size-4" data-mirror="true" aria-hidden />
                  {labels.login}
                </Link>
                <ThemeToggle
                  className="self-start border-border-default"
                  labels={{
                    theme: labels.theme,
                    light: labels.themeLight,
                    dark: labels.themeDark,
                    system: labels.themeSystem,
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
