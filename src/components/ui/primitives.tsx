import type { ReactNode, HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { CadastralPlan } from './cadastral-plan'

/* ------------------------------------------------------------------ surface */

export function Card({
  className,
  interactive,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border-subtle bg-surface-default',
        'transition-[border-color,box-shadow] duration-[120ms]',
        interactive && 'hover:border-border-strong hover:shadow-md',
        className,
      )}
      {...rest}
    />
  )
}

/**
 * Section heading, marked with a triangulation station.
 *
 * Deliberately NOT `01 / 02 / 03`. Numbered markers imply a sequence, and
 * these sections are not one — a reader does not consume "government
 * services" before "maps". A station mark says "this is a fixed point in the
 * survey", which is true of a section, and it belongs to the subject.
 */
export function SectionHeading({
  children,
  as: Tag = 'h2',
  subtitle,
  className,
}: {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  subtitle?: string
  className?: string
}) {
  return (
    <div className={cn('mb-8', className)}>
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-surface-rule" aria-hidden>
          <path d="M8 2 L14.5 13.5 L1.5 13.5 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="8" cy="10.2" r="1.3" fill="currentColor" />
        </svg>
        <Tag className="text-[length:var(--type-2xl)] font-semibold text-text-primary">
          {children}
        </Tag>
      </div>
      <div className="mt-3 h-px w-full bg-border-subtle" aria-hidden />
      {subtitle && (
        <p className="prose-measure mt-4 text-[length:var(--type-lg)] text-text-secondary">
          {subtitle}
        </p>
      )}
    </div>
  )
}

export function PageHeader({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children?: ReactNode
}) {
  return (
    <header className="relative overflow-hidden border-b border-border-subtle bg-surface-default">
      <CadastralPlan className="opacity-70" />
      <div className="container-page relative py-12 md:py-16">
        <h1 className="text-[length:var(--type-4xl)] font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        <div className="mt-4 h-[3px] w-16 rounded-full bg-surface-rule" aria-hidden />
        {intro && (
          <p className="prose-measure mt-6 text-[length:var(--type-lg)] leading-[var(--leading-body)] text-text-secondary">
            {intro}
          </p>
        )}
        {children}
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------- badge */

const statusTone = {
  active: 'bg-status-active-bg text-status-active-fg border-status-active-border',
  pending: 'bg-status-pending-bg text-status-pending-fg border-status-pending-border',
  warning: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border',
  overdue: 'bg-status-overdue-bg text-status-overdue-fg border-status-overdue-border',
  neutral: 'bg-status-neutral-bg text-status-neutral-fg border-status-neutral-border',
} as const

export type StatusTone = keyof typeof statusTone

/**
 * The ONLY way status is displayed anywhere in the system.
 *
 * Always carries an icon and a text label — status is never signalled by
 * colour alone. WCAG 1.4.1, and the difference between a member noticing
 * "your membership is at risk" and missing it.
 */
export function StatusBadge({
  tone,
  icon,
  children,
}: {
  tone: StatusTone
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-[length:var(--type-xs)] font-medium',
        statusTone[tone],
      )}
    >
      <span className="[&>svg]:size-3.5" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  )
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm bg-surface-sunken px-2 py-0.5',
        'text-[length:var(--type-xs)] font-medium text-text-secondary',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------------------------------------------------------- monospace */

/**
 * Licence numbers, invoice numbers, verification codes, amounts — anything a
 * human might transcribe. Tabular figures, Western digits, LTR-isolated so
 * the value does not reorder inside an Arabic sentence.
 */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span data-numeric className={cn('text-[0.95em] tracking-tight', className)}>
      {children}
    </span>
  )
}

/* -------------------------------------------------------------- empty state */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-default bg-surface-default px-6 py-16 text-center">
      {icon && (
        <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-surface-sunken text-text-muted [&>svg]:size-6">
          {icon}
        </div>
      )}
      <p className="text-[length:var(--type-lg)] font-semibold text-text-primary">{title}</p>
      {body && <p className="prose-measure mt-2 text-text-secondary">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
