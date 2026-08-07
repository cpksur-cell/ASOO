import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'

import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger'
type Size = 'sm' | 'md' | 'lg'

/**
 * Interaction states are all six: default, hover, focus-visible, active,
 * disabled, loading. docs/05-design-system.md §6.3.
 *
 * `accent` uses INK text on the survey orange — measured at 5.67:1. White on
 * that fill is 3.18:1 and fails AA, so it is not offered.
 */
const variants: Record<Variant, string> = {
  primary:
    'bg-surface-brand text-text-on-brand hover:bg-primary-600 active:bg-primary-800 shadow-sm',
  secondary:
    'bg-surface-default text-text-brand border border-border-default hover:bg-surface-sunken hover:border-border-strong active:bg-neutral-200',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-sunken hover:text-text-primary active:bg-neutral-200',
  accent:
    'bg-surface-accent text-primary-900 hover:bg-accent-300 active:bg-accent-500 shadow-sm font-semibold',
  danger:
    'bg-red-600 text-neutral-0 hover:bg-red-500 active:bg-red-700 shadow-sm',
}

const sizes: Record<Size, string> = {
  // Every size meets the 44px minimum touch target — field surveyors use this
  // outdoors on phones. ui-ux-pro-max §2.
  sm: 'min-h-11 px-3.5 text-sm gap-1.5',
  md: 'min-h-11 px-5 text-base gap-2',
  lg: 'min-h-13 px-7 text-lg gap-2.5',
}

const base = cn(
  'inline-flex items-center justify-center rounded-md font-medium',
  'transition-[background-color,border-color,color,box-shadow,transform]',
  'duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
  'active:scale-[0.985]',
  'disabled:pointer-events-none disabled:opacity-45',
  'whitespace-nowrap',
)

interface CommonProps {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Renders an external-link glyph and the correct rel. */
  external?: boolean
  /** Renders a direction-aware arrow that mirrors in RTL. */
  withArrow?: boolean
  children: ReactNode
  className?: string
}

export type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, external, withArrow, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
      {withArrow && !loading && (
        <ArrowLeft className="size-4" data-mirror="true" aria-hidden />
      )}
      {external && <ExternalLink className="size-4 opacity-80" aria-hidden />}
    </button>
  )
})

export type ButtonLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string }

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  external,
  withArrow,
  href,
  children,
  className,
  ...rest
}: ButtonLinkProps) {
  const cls = cn(base, variants[variant], sizes[size], className)

  const content = (
    <>
      {children}
      {withArrow && <ArrowLeft className="size-4" data-mirror="true" aria-hidden />}
      {external && <ExternalLink className="size-4 opacity-80" aria-hidden />}
    </>
  )

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
        {content}
      </a>
    )
  }

  return (
    <Link href={href} className={cls} {...rest}>
      {content}
    </Link>
  )
}
