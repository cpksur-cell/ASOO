import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Award, BadgeCheck, Download, ShieldAlert } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { getMemberCertificates, isInGoodStanding } from '@/lib/data/member'
import { Card, EmptyState, Mono } from '@/components/ui/primitives'
import { DemoBanner, GenericStatusBadge, MemberPageHeader } from '@/components/features/member-ui'
import type { CertificateRequestStatus } from '@/lib/data/member-demo'

const REQ_STATUS: Record<CertificateRequestStatus, { key: string; tone: 'active' | 'pending' | 'overdue' | 'neutral' }> = {
  issued: { key: 'member.certStatusIssued', tone: 'active' },
  under_review: { key: 'member.certStatusUnderReview', tone: 'pending' },
  submitted: { key: 'member.certStatusSubmitted', tone: 'pending' },
  rejected: { key: 'member.certStatusRejected', tone: 'overdue' },
}

export default async function CertificatesPage({
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

  const certificates = getMemberCertificates(session.uid)
  const goodStanding = isInGoodStanding(session.uid)

  return (
    <div>
      <MemberPageHeader title={t('member.certificates')} />
      <DemoBanner label={t('member.demoNotice')} />

      {/* Good standing is the correct gate for a certificate: unlike payment,
          a good-standing certificate for someone not in good standing would be
          a false statement by the syndicate. docs/06-ux-flows.md §4. */}
      {goodStanding ? (
        <button
          type="button"
          className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-brand px-5 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
        >
          <Award className="size-4" aria-hidden />
          {t('member.requestCertificate')}
        </button>
      ) : (
        <Card className="mb-6 flex items-start gap-3 border-status-warning-border bg-status-warning-bg p-5">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-status-warning-fg" aria-hidden />
          <div>
            <p className="font-semibold text-status-warning-fg">{t('member.certGatedTitle')}</p>
            <p className="mt-1 text-[length:var(--type-sm)] text-text-secondary">
              {t('member.certGatedBody')}
            </p>
            <Link
              href={href(typed, 'dashboard/subscriptions')}
              className="mt-3 inline-flex text-[length:var(--type-sm)] font-semibold text-text-brand hover:underline"
            >
              {t('member.subscriptions')}
            </Link>
          </div>
        </Card>
      )}

      {certificates.length === 0 ? (
        <EmptyState icon={<Award />} title={t('member.noCertificates')} />
      ) : (
        <div className="space-y-3">
          {certificates.map((cert) => {
            const req = REQ_STATUS[cert.status]
            return (
              <Card key={cert.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-text-primary">
                      {t(`member.certType${cert.typeKey === 'goodStanding' ? 'GoodStanding' : cert.typeKey === 'membership' ? 'Membership' : 'NoObjection'}`)}
                    </h3>
                    <p className="mt-1 text-[length:var(--type-xs)] text-text-muted">
                      {t('member.requestedOn')}:{' '}
                      <span data-numeric>{formatDate(cert.requestedAt, typed)}</span>
                    </p>
                  </div>
                  <GenericStatusBadge tone={req.tone} label={t(req.key)} />
                </div>

                {cert.status === 'issued' && cert.verificationCode && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                    <div className="text-[length:var(--type-xs)]">
                      <span className="text-text-muted">{t('member.verificationCode')}: </span>
                      <Mono className="font-medium text-text-primary">{cert.verificationCode}</Mono>
                      {cert.expiresAt && (
                        <span className="ms-3 text-text-muted">
                          {t('member.validUntil')}:{' '}
                          <span data-numeric>{formatDate(cert.expiresAt, typed)}</span>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-semibold text-text-brand transition-colors hover:bg-surface-sunken"
                    >
                      <Download className="size-4" aria-hidden />
                      {t('member.download')}
                    </button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {goodStanding && (
        <p className="mt-6 inline-flex items-center gap-2 text-[length:var(--type-xs)] text-status-active-fg">
          <BadgeCheck className="size-4" aria-hidden />
          {t('member.statusActive')}
        </p>
      )}
    </div>
  )
}
