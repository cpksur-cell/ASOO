import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Info, Receipt } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatMoney, formatDate } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { getMemberInvoice } from '@/lib/data/member'
import { invoiceTotalFils } from '@/lib/data/member-demo'
import { Card, Mono } from '@/components/ui/primitives'
import { DemoBanner, InvoiceStatusBadge, MemberPageHeader } from '@/components/features/member-ui'
import { PayPanel } from './pay-panel'

const STATUS_KEY = {
  overdue: 'member.invStatusOverdue',
  issued: 'member.invStatusIssued',
  partially_paid: 'member.invStatusPartial',
  paid: 'member.invStatusPaid',
} as const

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  const session = await getUserSession()
  if (!session) redirect(href(typed, 'login'))

  const invoice = getMemberInvoice(session.uid, id)
  if (!invoice) notFound()

  const total = invoiceTotalFils(invoice)
  const remaining = total - invoice.paidFils
  const payable =
    invoice.status === 'overdue' ||
    invoice.status === 'issued' ||
    invoice.status === 'partially_paid'
  const hasPenalty = invoice.lines.some((l) => l.descriptionKey === 'lineLatePenalty')

  return (
    <div>
      <Link
        href={href(typed, 'dashboard/subscriptions')}
        className="mb-4 inline-flex items-center gap-1.5 text-[length:var(--type-sm)] font-medium text-text-muted hover:text-text-brand"
      >
        <ArrowLeft className="size-4" data-mirror="true" aria-hidden />
        {t('member.subscriptions')}
      </Link>

      <MemberPageHeader
        title={invoice.invoiceNumber}
        action={<InvoiceStatusBadge status={invoice.status} label={t(STATUS_KEY[invoice.status])} />}
      />
      <DemoBanner label={t('member.demoNotice')} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-border-subtle p-6">
            <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">
              {t('member.lineItems')}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[length:var(--type-xs)] text-text-muted">
                  <th className="p-4 text-start font-semibold">{t('member.description')}</th>
                  <th className="p-4 text-end font-semibold">{t('member.quantity')}</th>
                  <th className="p-4 text-end font-semibold">{t('member.unitPrice')}</th>
                  <th className="p-4 text-end font-semibold">{t('member.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line, i) => (
                  <tr key={i} className="border-b border-border-subtle last:border-0">
                    <td className="p-4 text-text-primary">{t(`member.${line.descriptionKey}`)}</td>
                    <td className="p-4 text-end text-text-secondary" data-numeric>
                      {line.quantity}
                    </td>
                    <td className="p-4 text-end text-text-secondary">
                      <Mono>{formatMoney(line.unitAmountFils, typed)}</Mono>
                    </td>
                    <td className="p-4 text-end font-medium text-text-primary">
                      <Mono>{formatMoney(line.unitAmountFils * line.quantity, typed)}</Mono>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-sunken">
                  <td colSpan={3} className="p-4 text-end font-semibold text-text-primary">
                    {t('member.total')}
                  </td>
                  <td className="p-4 text-end text-[length:var(--type-lg)] font-bold text-text-primary">
                    <Mono>{formatMoney(total, typed)}</Mono>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* A penalty is never a silent surcharge — the rule is stated. */}
          {hasPenalty && (
            <p className="flex items-start gap-2.5 border-t border-border-subtle p-4 text-[length:var(--type-xs)] text-text-secondary">
              <Info className="mt-0.5 size-4 shrink-0 text-status-warning-fg" aria-hidden />
              {t('member.penaltyExplain')}
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <dl className="space-y-3 text-[length:var(--type-sm)]">
              <Row label={t('member.reference')}>
                <Mono>{invoice.publicReference}</Mono>
              </Row>
              <Row label={t('member.issued')}>
                <span data-numeric>{formatDate(invoice.issuedAt, typed)}</span>
              </Row>
              <Row label={t('member.dueDate')}>
                <span data-numeric>{formatDate(invoice.dueAt, typed)}</span>
              </Row>
              {invoice.settledAt && (
                <Row label={t('member.settledOn')}>
                  <span data-numeric>{formatDate(invoice.settledAt, typed)}</span>
                </Row>
              )}
              {invoice.paidFils > 0 && invoice.status !== 'paid' && (
                <Row label={t('member.paid')}>
                  <Mono>{formatMoney(invoice.paidFils, typed)}</Mono>
                </Row>
              )}
              {payable && (
                <Row label={t('member.remaining')} emphasis>
                  <Mono>{formatMoney(remaining, typed)}</Mono>
                </Row>
              )}
            </dl>
          </Card>

          {payable ? (
            <PayPanel
              invoiceId={invoice.id}
              amountLabel={formatMoney(remaining, typed)}
              invoiceNumber={invoice.invoiceNumber}
              labels={{
                payNow: t('member.payNow'),
                payTitle: t('member.payTitle'),
                confirm: t('member.payConfirm', {
                  amount: formatMoney(remaining, typed),
                  number: invoice.invoiceNumber,
                }),
                proceed: t('member.payProceed'),
                cancel: t('admin.cancel'),
                pending: t('member.payPending'),
                pendingNote: t('member.payPendingNote'),
              }}
            />
          ) : (
            <Card className="flex items-center gap-2 p-5 text-[length:var(--type-sm)] font-medium text-text-muted">
              <Receipt className="size-4" aria-hidden />
              {t('member.downloadReceipt')}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  children,
  emphasis,
}: {
  label: string
  children: React.ReactNode
  emphasis?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className={emphasis ? 'font-bold text-text-primary' : 'font-medium text-text-primary'}>
        {children}
      </dd>
    </div>
  )
}
