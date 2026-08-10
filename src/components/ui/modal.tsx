'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { duration, ease } from '@/lib/motion'

/**
 * The accessible dialog every modal in the system is built from.
 *
 * Hand-rolled dialogs reliably miss the same four things, and each one is a
 * real defect for someone:
 *
 *   1. ESCAPE TO DISMISS — ui-ux-pro-max §1 `escape-routes`, §9 `modal-escape`.
 *      A keyboard user with no visible pointer needs a guaranteed way out.
 *   2. FOCUS TRAP — Tab must not walk into the page behind the scrim. Without
 *      it a screen-reader user silently ends up operating a hidden page.
 *   3. FOCUS RESTORE — on close, focus returns to the trigger, so the reading
 *      position is not lost.
 *   4. SCROLL LOCK — the page behind must not scroll under the dialog.
 *
 * Motion: scrim fades while the panel rises and scales from 0.97, and exit
 * runs at ~65% of enter so dismissal feels quicker than opening
 * (§7 `modal-motion`, `exit-faster-than-enter`). `prefers-reduced-motion` is
 * collapsed globally in globals.css, so this needs no branch of its own.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  closeLabel,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  /** Accessible name for the dialog. Rendered as the visible heading. */
  title: string
  /** Optional context line under the heading — a record number, a name. */
  subtitle?: ReactNode
  closeLabel: string
  children: ReactNode
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    // Remember what had focus so it can be handed back on close.
    restoreRef.current = document.activeElement as HTMLElement | null

    // Move focus into the dialog — the first field if there is one, else the
    // panel itself, so the very next Tab stays inside.
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      // Cycle focus within the panel.
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!nodes || nodes.length === 0) return
      const list = Array.from(nodes).filter((n) => n.offsetParent !== null)
      if (list.length === 0) return

      const firstNode = list[0]!
      const lastNode = list[list.length - 1]!
      const active = document.activeElement

      if (event.shiftKey && (active === firstNode || active === panelRef.current)) {
        event.preventDefault()
        lastNode.focus()
      } else if (!event.shiftKey && active === lastNode) {
        event.preventDefault()
        firstNode.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
          {/*
            The scrim is strong enough to isolate the dialog (≈60% ink) and
            blurs the page behind, which is what signals "tap here to dismiss"
            rather than being decoration.
          */}
          <motion.div
            className="absolute inset-0 bg-primary-950/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: duration.exit } }}
            transition={{ duration: duration.normal, ease: ease.decelerate }}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={cn(
              'relative z-10 w-full max-w-lg rounded-lg border border-border-subtle',
              'bg-surface-default p-6 text-start shadow-lg outline-none',
              className,
            )}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: 8,
              scale: 0.98,
              transition: { duration: duration.exit, ease: ease.accelerate },
            }}
            transition={{ duration: duration.slow, ease: ease.decelerate }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[length:var(--type-xl)] font-semibold text-text-primary">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-[length:var(--type-sm)] text-text-muted">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-sunken"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
