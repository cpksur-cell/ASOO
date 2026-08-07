import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Award,
  CalendarClock,
  RefreshCw,
  Wallet,
} from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatMoney, formatDate } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import {
  getMemberInvoices,
  getMemberOutstandingFils,
  getMemberProfile,
  getMemberRenewal,
} from '@/lib/data/member'
import { invoiceTotalFils } from '@/lib/data/member-demo'
import { Card, Mono } from '@/components/ui/primitives'
import { DemoBanner, InvoiceStatusBadge, MemberPageHeader } from '@/components/features/member-ui'

const INVOICE_STATUS_KEY = {
  overdue: 'member.invStatusOverdue',
  issued: 'member.invStatusIssued',
  partially_paid: 'member.invStatusPartial',
  paid: 'member.invStatusPaid',
} as const

export default async function MemberOverviewPage({
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

  const profile = getMemberProfile(session.uid)
  const outstanding = getMemberOutstandingFils(session.uid)
  const invoices = getMemberInvoices(session.uid)
  const renewal = getMemberRenewal(session.uid)
  const overdue = invoices.find((i) => i.status === 'overdue')

  return (
    <div>
      <MemberPageHeader title={t('member.welcome', { name: profile.fullName[typed] })} />
      <DemoBanner label={t('member.demoNotice')} />

      {/* Two headline facts: what you owe, and when you renew. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col p-6">
          <span className="flex items-center gap-2 text-[length:var(--type-sm)] text-text-muted">
            <Wallet className="size-4" aria-hidden />
            {t('member.outstandingBalance')}
          </span>
          <span
            className={`mt-3 text-[length:var(--type-4xl)] font-bold ${
              outstanding > 0 ? 'text-status-overdue-fg' : 'text-text-primary'
            }`}
          >
            <Mono>{formatMoney(outstanding, typed)}</Mono>
          </span>
          {outstanding > 0 && overdue ? (
            <Link
              href={href(typed, `dashboard/invoices/${overdue.id}`)}
              className="mt-4 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-surface-accent px-5 text-[length:var(--type-sm)] font-semibold text-text-on-accent transition-colors hover:bg-accent-300"
            >
              {t('member.payNow')}
              <ArrowLeft className="size-4" data-mirror="true" aria-hidden />
            </Link>
          ) : (
            <span className="mt-4 text-[length:var(--type-sm)] text-status-active-fg">
              {t('member.noOutstanding')}
            </span>
          )}
        </Card>

        <Card className="flex flex-col p-6">
          <span className="flex items-center gap-2 text-[length:var(--type-sm)] text-text-muted">
            <CalendarClock className="size-4" aria-hidden />
            {t('member.nextRenewal')}
          </span>
          <span className="mt-3 text-[length:var(--type-2xl)] font-bold text-text-primary" data-numeric>
            {formatDate(renewal.dueAt, typed)}
          </span>
          <Link
            href={href(typed, 'dashboard/renewal')}
            className="mt-4 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-border-default px-5 text-[length:var(--type-sm)] font-semibold text-text-brand transition-colors hover:bg-surface-sunken"
          >
            <RefreshCw className="size-4" aria-hidden />
            {t('member.renewal')}
          </Link>
        </Card>
      </div>

      {/* Identity strip */}
      <Card className="mt-4 grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label={t('member.membershipNumber')} value={profile.membershipNumber} mono />
        <Fact label={t('member.licenseNumber')} value={profile.licenseNumber} mono />
        <Fact label={t('member.memberSince')} value={formatDate(profile.joinedAt, typed)} numeric />
        <Fact
          label={t('member.licenseExpires')}
          value={formatDate(profile.licenseExpiresAt, typed)}
          numeric
        />
      </Card>

      {/* Recent invoices */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">
            {t('member.recentActivity')}
          </h2>
          <Link
            href={href(typed, 'dashboard/subscriptions')}
            className="text-[length:var(--type-sm)] font-medium text-text-brand hover:underline"
          >
            {t('member.subscriptions')}
          </Link>
        </div>
        <div className="space-y-3">
          {invoices.slice(0, 3).map((inv) => (
            <Link key={inv.id} href={href(typed, `dashboard/invoices/${inv.id}`)} className="block">
              <Card interactive className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary">
                    <Mono>{inv.invoiceNumber}</Mono>
                  </p>
                  <p className="mt-0.5 text-[length:var(--type-xs)] text-text-muted" data-numeric>
                    {formatDate(inv.issuedAt, typed)}
                  </p>
                </div>
                <span className="font-semibold text-text-primary">
                  <Mono>{formatMoney(invoiceTotalFils(inv), typed)}</Mono>
                </span>
                <InvoiceStatusBadge status={inv.status} label={t(INVOICE_STATUS_KEY[inv.status])} />
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="mt-8">
        <h2 className="mb-4 text-[length:var(--type-lg)] font-semibold text-text-primary">
          {t('member.quickActions')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickAction
            href={href(typed, 'dashboard/renewal')}
            icon={<RefreshCw className="size-5" aria-hidden />}
            label={t('member.renewal')}
          />
          <QuickAction
            href={href(typed, 'dashboard/certificates')}
            icon={<Award className="size-5" aria-hidden />}
            label={t('member.certificates')}
          />
          <QuickAction
            href={href(typed, 'dashboard/complaints')}
            icon={<Wallet className="size-5" aria-hidden />}
            label={t('member.complaints')}
          />
        </div>
      </section>
    </div>
  )
}

function Fact({
  label,
  value,
  mono,
  numeric,
}: {
  label: string
  value: string
  mono?: boolean
  numeric?: boolean
}) {
  return (
    <div>
      <p className="text-[length:var(--type-xs)] text-text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text-primary">
        {mono ? <Mono>{value}</Mono> : numeric ? <span data-numeric>{value}</span> : value}
      </p>
    </div>
  )
}

function QuickAction({ href: url, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={url} className="block">
      <Card interactive className="flex items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-lg bg-surface-brand-subtle text-text-brand">
          {icon}
        </span>
        <span className="font-medium text-text-primary">{label}</span>
      </Card>
    </Link>
  )
}
