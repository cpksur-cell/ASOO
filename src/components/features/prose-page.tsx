import type { ReactNode } from 'react'

import type { Locale } from '@/i18n/config'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Card, PageHeader } from '@/components/ui/primitives'
import { Reveal } from '@/components/ui/reveal'

/**
 * The shared shell for the syndicate's text pages — privacy, terms,
 * accessibility, join, board, history.
 *
 * These pages are read, not operated. They share one measure, one heading
 * rhythm, and one breadcrumb treatment so the institutional voice stays
 * consistent, and so adding the next one is a content decision rather than a
 * layout decision.
 */
export function ProsePage({
  locale,
  title,
  intro,
  trail,
  children,
  aside,
}: {
  locale: Locale
  title: string
  intro?: string
  /** Breadcrumb ancestors above this page, nearest last. */
  trail?: Array<{ label: string; path?: string }>
  children: ReactNode
  /** Optional panel rendered after the prose — a note, a CTA pair. */
  aside?: ReactNode
}) {
  return (
    <>
      <Breadcrumbs locale={locale} items={[...(trail ?? []), { label: title }]} />
      <PageHeader title={title} intro={intro} />

      <div className="container-page py-12">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            {/* `prose-measure` caps the line length; §5 line-length-control. */}
            <div className="space-y-8">{children}</div>
          </Reveal>
          {aside && <Reveal className="mt-10">{aside}</Reveal>}
        </div>
      </div>
    </>
  )
}

/** One titled block of body copy. */
export function ProseSection({
  heading,
  children,
}: {
  heading: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="text-[length:var(--type-xl)] font-semibold text-text-primary">{heading}</h2>
      <div className="mt-3 h-[3px] w-10 rounded-full bg-surface-rule" aria-hidden />
      <div className="mt-4 space-y-3 leading-[var(--leading-body)] text-text-secondary">
        {children}
      </div>
    </section>
  )
}

/** A bulleted list that keeps the marker on the correct side in RTL. */
export function ProseList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            className="mt-2 size-1.5 shrink-0 rounded-full bg-surface-accent"
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The standing note on the two legal pages.
 *
 * These pages describe what the system verifiably does, but the binding legal
 * wording is the syndicate's to approve. Saying so in the page is more honest
 * than publishing text that looks settled and is not.
 */
export function PendingApprovalNote({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <Card className="border-dashed bg-surface-sunken p-5">
      <p className="text-[length:var(--type-sm)] font-semibold text-text-primary">{title}</p>
      <p className="mt-2 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
        {body}
      </p>
    </Card>
  )
}
