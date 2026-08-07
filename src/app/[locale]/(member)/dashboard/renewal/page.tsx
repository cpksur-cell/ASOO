import { notFound, redirect } from 'next/navigation'
import { Check, FileCheck, FileText, Wallet } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { getMemberRenewal } from '@/lib/data/member'
import { Card } from '@/components/ui/primitives'
import { DemoBanner, MemberPageHeader } from '@/components/features/member-ui'

export default async function RenewalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  const session = await getUserSession()
  if (!session) redirect(href(typed, 'login'))

  const renewal = getMemberRenewal(session.uid)

  const steps = [
    { key: 'renewalStep1', icon: FileCheck },
    { key: 'renewalStep2', icon: FileText },
    { key: 'renewalStep3', icon: Wallet },
  ]

  return (
    <div>
      <MemberPageHeader title={t('member.renewalTitle', { year: renewal.membershipYear })} />
      <DemoBanner label={t('member.demoNotice')} />

      <Card className="mb-6 border-status-active-border bg-status-active-bg p-5">
        <p className="font-medium text-status-active-fg">
          {t('member.renewalOpen', { date: formatDate(renewal.dueAt, typed) })}
        </p>
      </Card>

      {/* Three steps, never more. Each independently savable in the real flow.
          docs/06-ux-flows.md §3. Step indicator flows RTL in Arabic. */}
      <ol className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        {steps.map((step, i) => (
          <li key={step.key} className="flex flex-1 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-border-default bg-surface-default text-text-muted">
              <step.icon className="size-5" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-[length:var(--type-xs)] text-text-muted" data-numeric>
                {i + 1}
              </span>
              <span className="text-[length:var(--type-sm)] font-medium text-text-primary">
                {t(`member.${step.key}`)}
              </span>
            </span>
            {i < steps.length - 1 && (
              <span
                className="mx-1 hidden h-px flex-1 bg-border-default sm:block"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="inline-flex min-h-13 items-center gap-2 rounded-lg bg-surface-brand px-6 text-[length:var(--type-base)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
      >
        <Check className="size-5" aria-hidden />
        {t('member.startRenewal')}
      </button>
    </div>
  )
}
