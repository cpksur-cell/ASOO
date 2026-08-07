'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, LogOut, Shield, Sparkles } from 'lucide-react'

import { useAuth } from '@/lib/auth/client'
import { cn } from '@/lib/cn'
import { MOCK_ROLES, type MockRole } from '@/lib/auth/mock'

/**
 * Development-only role impersonation control.
 *
 * Rendered ONLY when the server has confirmed mock auth is enabled — see the
 * guard in site-header.tsx. The API it calls is independently gated, so even
 * if this ever rendered by mistake it could not obtain a session.
 *
 * Labels arrive as props from the server translator. Nothing here holds a
 * literal string: CLAUDE.md §2.
 */
export function MockRoleSwitcher({
  labels,
  activeLabelFallback,
  switcherLabel,
  signOutLabel,
}: {
  labels: Record<MockRole, string>
  activeLabelFallback: string
  switcherLabel: string
  signOutLabel: string
}) {
  const { user, loginAsMockRole, logout } = useAuth()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  function change(role: MockRole | 'guest') {
    setIsOpen(false)
    startTransition(async () => {
      if (role === 'guest') await logout()
      else await loginAsMockRole(role)
      router.refresh()
    })
  }

  const activeLabel =
    user && (MOCK_ROLES as readonly string[]).includes(user.role)
      ? labels[user.role as MockRole]
      : activeLabelFallback

  return (
    <div ref={menuRef} className="relative inline-block text-start">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={switcherLabel}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-primary-600 px-2 sm:gap-2 sm:px-3',
          'text-[length:var(--type-xs)] font-medium transition-colors duration-[120ms]',
          'bg-primary-800 text-primary-100 hover:bg-primary-600 hover:text-text-on-brand',
          isOpen && 'bg-primary-600 text-text-on-brand',
        )}
      >
        <Sparkles className="size-3.5 shrink-0 text-accent-300" aria-hidden />
        <span className="hidden whitespace-nowrap font-medium sm:inline-block">{activeLabel}</span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 text-primary-200 transition-transform duration-200', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute end-0 top-full z-[1200] mt-2 w-64 rounded-xl border border-border-subtle bg-surface-default p-2 shadow-lg"
        >
          <p className="mb-1 border-b border-border-subtle px-2.5 py-1.5 text-[length:var(--type-xs)] font-bold text-text-primary">
            {switcherLabel}
          </p>

          <ul className="space-y-0.5">
            {MOCK_ROLES.map((role) => {
              const selected = user?.role === role
              return (
                <li key={role}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    disabled={isPending}
                    onClick={() => change(role)}
                    className={cn(
                      'flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 text-start',
                      'text-[length:var(--type-sm)] font-medium transition-colors',
                      selected
                        ? 'bg-surface-brand-subtle font-semibold text-text-brand'
                        : 'text-text-primary hover:bg-surface-sunken',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Shield
                        className={cn('size-3.5', selected ? 'text-text-brand' : 'text-text-muted')}
                        aria-hidden
                      />
                      {labels[role]}
                    </span>
                    {selected && <Check className="size-4 shrink-0 text-text-brand" aria-hidden />}
                  </button>
                </li>
              )
            })}

            {user && (
              <li className="mt-1 border-t border-border-subtle pt-1">
                <button
                  type="button"
                  role="menuitem"
                  disabled={isPending}
                  onClick={() => change('guest')}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-start text-[length:var(--type-sm)] font-medium text-status-warning-fg transition-colors hover:bg-status-warning-bg"
                >
                  <LogOut className="size-4 shrink-0" data-mirror="true" aria-hidden />
                  <span>{signOutLabel}</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
