import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BadgeCheck, ShieldX, XCircle } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate } from '@/i18n/format'
import { href } from '@/lib/routes'
import { getApprovalByCode, getOrder, getSubmission } from '@/lib/data/reports-source'
import { members as seedMembers } from '@/lib/data/seed'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Card, Mono, PageHeader } from '@/components/ui/primitives'
import { ReportQR } from '@/components/features/report-qr'

export function generateMetadata(): Metadata {
  // A verification result is not an indexable surface.
  return { robots: { index: false, follow: false } }
}

export default async function VerifyReportPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>
}) {
  const { locale, code } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  const approval = await getApprovalByCode(code)
  const order = approval ? await getOrder(approval.orderId) : null
  const submission = approval ? await getSubmission(approval.submissionId) : null
  const member = seedMembers[0] // demo: the mock member

  const state: 'valid' | 'revoked' | 'not_found' =
    !approval ? 'not_found' : approval.status === 'revoked' ? 'revoked' : 'valid'

  return (
    <>
      <Breadcrumbs
        locale={typed}
        items={[
          { label: t('services.title'), path: 'services' },
          { label: t('reports.verifyTitle') },
        ]}
      />
      <PageHeader title={t('reports.verifyTitle')} />

      <div className="container-page py-12">
        <div className="mx-auto max-w-xl">
          {/*
            A verification page reveals the MINIMUM — validity, order number,
            report title, member name, approval date. Never the file, never PII.
            docs/08-security.md §8.
          */}
          {state === 'not_found' && (
            <Card className="flex flex-col items-center p-10 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-status-neutral-bg text-text-muted">
                <XCircle className="size-8" aria-hidden />
              </span>
              <p className="mt-5 text-[length:var(--type-lg)] font-semibold text-text-primary">
                {t('reports.verifyNotFound')}
              </p>
              <p className="mt-2 text-[length:var(--type-sm)] text-text-muted">
                <Mono>{code}</Mono>
              </p>
            </Card>
          )}

          {state === 'revoked' && (
            <Card className="border-status-overdue-border bg-status-overdue-bg p-8 text-center">
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-surface-default text-status-overdue-fg">
                <ShieldX className="size-8" aria-hidden />
              </span>
              <p className="mt-5 text-[length:var(--type-xl)] font-bold text-status-overdue-fg">
                {t('reports.verifyRevoked')}
              </p>
              {approval && (
                <p className="mt-2 text-[length:var(--type-sm)] text-text-secondary">
                  <Mono>{approval.approvalNumber}</Mono>
                </p>
              )}
            </Card>
          )}

          {state === 'valid' && approval && (
            <Card className="overflow-hidden">
              <div className="flex flex-col items-center border-b border-status-active-border bg-status-active-bg p-8 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-surface-default text-status-active-fg">
                  <BadgeCheck className="size-9" aria-hidden />
                </span>
                <p className="mt-4 text-[length:var(--type-xl)] font-bold text-status-active-fg">
                  {t('reports.verifyValid')}
                </p>
                <p className="mt-1">
                  <Mono className="font-semibold text-text-primary">{approval.approvalNumber}</Mono>
                </p>
              </div>

              <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
                <dl className="space-y-3 text-[length:var(--type-sm)]">
                  <Row label={t('reports.verifyOrderNumber')}>
                    <Mono>{order?.orderNumber ?? '—'}</Mono>
                  </Row>
                  <Row label={t('reports.verifyReport')}>{order?.title ?? '—'}</Row>
                  <Row label={t('reports.verifyMember')}>{member?.fullName[typed] ?? '—'}</Row>
                  <Row label={t('reports.verifyIssuedAt')}>
                    <span data-numeric>{formatDate(approval.issuedAt, typed)}</span>
                  </Row>
                  {/* Only what the reviewer actually recorded. A verification
                      page must not imply a field was certified when it was
                      left blank. */}
                  {approval.dlsReference && (
                    <Row label={t('reports.dlsReference')}>
                      <Mono>{approval.dlsReference}</Mono>
                    </Row>
                  )}
                  {approval.basin && (
                    <Row label={t('reports.basin')}>{approval.basin}</Row>
                  )}
                  {approval.plot && <Row label={t('reports.plot')}>{approval.plot}</Row>}
                  {approval.surveyMethod && (
                    <Row label={t('reports.surveyMethod')}>{approval.surveyMethod}</Row>
                  )}
                  {submission && (
                    <Row label={t('reports.fileName')}>
                      <span dir="ltr" className="text-text-secondary">
                        {submission.fileName}
                      </span>
                    </Row>
                  )}
                </dl>

                <div className="flex flex-col items-center gap-2 justify-self-center rounded-lg border border-border-subtle p-4">
                  <ReportQR code={approval.verificationCode} locale={typed} size={140} />
                  <Mono className="text-[length:var(--type-xs)] text-text-muted">
                    {approval.verificationCode}
                  </Mono>
                </div>
              </div>
            </Card>
          )}

          <p className="mt-6 text-center text-[length:var(--type-sm)]">
            <a href={href(typed, 'services/verify-report')} className="text-text-brand hover:underline">
              {t('reports.verifyTitle')}
            </a>
          </p>
        </div>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-2 last:border-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium text-text-primary">{children}</dd>
    </div>
  )
}
