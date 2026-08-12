import { notFound, redirect } from 'next/navigation'
import { Award, FileText } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate, formatFileSize } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import {
  getApprovalForSubmission,
  listOrdersForUser,
  listSubmissionsForOrder,
} from '@/lib/data/reports-source'
import { SUBMISSION_LABEL_KEY, SUBMISSION_TONE } from '@/lib/reports'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { Card, EmptyState, Mono } from '@/components/ui/primitives'
import { GenericStatusBadge, MemberPageHeader, DemoBanner } from '@/components/features/member-ui'
import { ReportQR } from '@/components/features/report-qr'
import { ReportUploader } from './report-uploader'

export default async function ReportsPage({
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

  const orders = await Promise.all(
    (await listOrdersForUser(session.uid)).map(async (o) => {
      const submissions = await listSubmissionsForOrder(o.id)
      const latest = submissions[0] ?? null
      const approval = latest ? await getApprovalForSubmission(latest.id) : null
      return { order: o, submissions, latest, approval }
    }),
  )

  return (
    <div>
      <MemberPageHeader
        title={t('reports.title')}
        intro={t('reports.intro')}
        action={
          <ReportUploader
            orders={orders.map((o) => ({ number: o.order.orderNumber, title: o.order.title }))}
            labels={{
              upload: t('reports.upload'),
              uploadTitle: t('reports.uploadTitle'),
              orderNumber: t('reports.orderNumber'),
              selectOrder: t('reports.selectOrder'),
              file: t('reports.file'),
              fileHint: t('reports.fileHint'),
              note: t('reports.note'),
              submit: t('reports.submit'),
              submitting: t('reports.submitting'),
              cancel: t('reports.cancel'),
              uploaded: t('reports.uploaded'),
              uploadFailed: t('reports.uploadFailed'),
              orderNotFound: t('reports.orderNotFound'),
              fileTooBig: t('reports.fileTooBig'),
              fileTypeNotAllowed: t('reports.fileTypeNotAllowed'),
              fileContentMismatch: t('reports.fileContentMismatch'),
              noPermission: t('reports.noPermission'),
            }}
          />
        }
      />
      {/*
        Only warn about demonstration data while the reports actually ARE
        demonstration data. Once Supabase is configured these rows come from
        Postgres, and a banner claiming otherwise is simply false — worse on a
        government portal than no banner at all.
      */}
      {!isSupabaseConfigured() && <DemoBanner label={t('member.demoNotice')} />}

      {orders.length === 0 ? (
        <EmptyState icon={<FileText />} title={t('reports.noReports')} />
      ) : (
        <div className="space-y-4">
          {orders.map(({ order, latest, approval }) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono className="font-semibold text-text-primary">{order.orderNumber}</Mono>
                    <span className="text-[length:var(--type-xs)] text-text-muted">
                      · {t(`reports.orderType_${order.type}`)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-text-primary">{order.title}</p>
                  <p className="mt-1 text-[length:var(--type-xs)] text-text-muted">
                    {order.parcelReference}
                  </p>
                </div>
                {latest && (
                  <GenericStatusBadge
                    tone={SUBMISSION_TONE[latest.status]}
                    label={t(SUBMISSION_LABEL_KEY[latest.status])}
                  />
                )}
              </div>

              {latest && (
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border-subtle pt-4 text-[length:var(--type-xs)] text-text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="size-3.5" aria-hidden />
                    <span dir="ltr">{latest.fileName}</span>
                  </span>
                  <span>
                    {t('reports.version')} <span data-numeric>{latest.version}</span>
                  </span>
                  <span>{formatFileSize(latest.fileSize, typed)}</span>
                  <span data-numeric>{formatDate(latest.createdAt, typed)}</span>
                </div>
              )}

              {latest?.reviewComment && (
                <p className="mt-3 rounded-md border border-border-subtle bg-surface-sunken p-3 text-[length:var(--type-sm)] text-text-secondary">
                  <span className="font-medium text-text-primary">{t('reports.reviewComment')}: </span>
                  {latest.reviewComment}
                </p>
              )}

              {/* Approved report: show the issued approval and its QR. */}
              {approval && approval.status === 'valid' && (
                <div className="mt-4 flex flex-wrap items-center gap-5 rounded-lg border border-status-active-border bg-status-active-bg p-4">
                  <ReportQR code={approval.verificationCode} locale={typed} size={120} />
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-2 font-semibold text-status-active-fg">
                      <Award className="size-4" aria-hidden />
                      {t('reports.approvalIssued')}
                    </p>
                    <p className="mt-2 text-[length:var(--type-sm)] text-text-secondary">
                      {t('reports.approvalNumber')}:{' '}
                      <Mono className="text-text-primary">{approval.approvalNumber}</Mono>
                    </p>
                    <p className="mt-1 text-[length:var(--type-sm)] text-text-secondary">
                      {t('reports.verificationCode')}:{' '}
                      <Mono className="text-text-primary">{approval.verificationCode}</Mono>
                    </p>
                    <p className="mt-2 text-[length:var(--type-xs)] text-text-muted">
                      {t('reports.scanToVerify')}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
