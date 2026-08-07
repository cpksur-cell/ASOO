import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Receipt } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatMoney, formatDate } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { getMemberInvoices } from '@/lib/data/member'
import { invoiceTotalFils } from '@/lib/data/member-demo'
import { Card, EmptyState, Mono } from '@/components/ui/primitives'
import { DemoBanner, InvoiceStatusBadge, MemberPageHeader } from '@/components/features/member-ui'

const STATUS_KEY = {
  overdue: 'member.invStatusOverdue',
  issued: 'member.invStatusIssued',
  partially_paid: 'member.invStatusPartial',
  paid: 'member.invStatusPaid',
} as const

const TYPE_KEY = {
  subscription: 'member.invTypeSubscription',
  renewal: 'member.invTypeRenewal',
  certificate: 'member.invTypeCertificate',
  penalty: 'member.invTypePenalty',
} as const

export default async function SubscriptionsPage({
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

  // Already sorted overdue-first by the facade.
  const invoices = getMemberInvoices(session.uid)

  return (
    <div>
      <MemberPageHeader title={t('member.subscriptions')} />
      <DemoBanner label={t('member.demoNotice')} />

      {invoices.length === 0 ? (
        <EmptyState icon={<Receipt />} title={t('member.noInvoices')} />
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const total = invoiceTotalFils(inv)
            return (
              <Card key={inv.id} interactive className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">
                        <Mono>{inv.invoiceNumber}</Mono>
                      </span>
                      <span className="text-[length:var(--type-xs)] text-text-muted">
                        · {t(TYPE_KEY[inv.type])}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[length:var(--type-xs)] text-text-muted">
                      <span>
                        {t('member.issued')}:{' '}
                        <span data-numeric>{formatDate(inv.issuedAt, typed)}</span>
                      </span>
                      <span>
                        {t('member.dueDate')}:{' '}
                        <span data-numeric>{formatDate(inv.dueAt, typed)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[length:var(--type-lg)] font-bold text-text-primary">
                      <Mono>{formatMoney(total, typed)}</Mono>
                    </span>
                    <InvoiceStatusBadge status={inv.status} label={t(STATUS_KEY[inv.status])} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
                  <Link
                    href={href(typed, `dashboard/invoices/${inv.id}`)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-semibold text-text-brand transition-colors hover:bg-surface-sunken"
                  >
                    {t('member.viewInvoice')}
                    <ArrowLeft className="size-4" data-mirror="true" aria-hidden />
                  </Link>
                  {(inv.status === 'overdue' ||
                    inv.status === 'issued' ||
                    inv.status === 'partially_paid') && (
                    <Link
                      href={href(typed, `dashboard/invoices/${inv.id}`)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-accent px-4 text-[length:var(--type-sm)] font-semibold text-text-on-accent transition-colors hover:bg-accent-300"
                    >
                      {t('member.payNow')}
                    </Link>
                  )}
                  {inv.status === 'paid' && (
                    <span className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-[length:var(--type-sm)] font-medium text-text-muted">
                      <Receipt className="size-4" aria-hidden />
                      {t('member.downloadReceipt')}
                    </span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
