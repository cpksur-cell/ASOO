'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

import { cn } from '@/lib/cn'

type Theme = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'asoo-theme'

/**
 * Three states, not two. "System" is the honest default — a toggle that only
 * offers light and dark silently overrides an OS preference the user already
 * set, which is the wrong call for a site people visit once a year to pay a bill.
 *
 * The pre-paint script in the locale layout reads the same key, so there is no
 * flash of the wrong theme on load.
 */
export function ThemeToggle({
  className,
  labels,
}: {
  className?: string
  labels: { light: string; dark: string; system: string; theme: string }
}) {
  // Default is 'system': with no stored override the page follows the device
  // via `prefers-color-scheme` (handled in tokens.generated.css), so day/dark
  // tracks the OS out of the box. This state only decides which chip is lit.
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') setTheme(stored)
    } catch {
      /* storage unavailable — stay on system */
    }
  }, [])

  function apply(next: Theme) {
    setTheme(next)
    try {
      if (next === 'system') {
        localStorage.removeItem(STORAGE_KEY)
        document.documentElement.removeAttribute('data-theme')
      } else {
        localStorage.setItem(STORAGE_KEY, next)
        document.documentElement.setAttribute('data-theme', next)
      }
    } catch {
      /* storage unavailable — the attribute still applies for this session */
    }
  }

  const options: Array<{ value: Theme; icon: typeof Sun; label: string }> = [
    { value: 'light', icon: Sun, label: labels.light },
    { value: 'dark', icon: Moon, label: labels.dark },
    { value: 'system', icon: Monitor, label: labels.system },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={labels.theme}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-primary-600 p-0.5',
        className,
      )}
    >
      {options.map((opt) => {
        // Before mount the stored value is unknown; rendering nothing as
        // selected avoids a hydration mismatch and a wrong-looking flash.
        const selected = mounted && theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => apply(opt.value)}
            className={cn(
              'flex size-8 items-center justify-center rounded-full',
              'transition-colors duration-[120ms]',
              selected
                ? 'bg-surface-accent text-text-on-accent'
                : 'text-primary-200 hover:text-neutral-0',
            )}
          >
            <opt.icon className="size-4" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
