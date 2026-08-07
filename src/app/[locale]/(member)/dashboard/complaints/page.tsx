import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquareWarning, Plus } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { getMemberComplaints } from '@/lib/data/member'
import { Card, EmptyState, Mono } from '@/components/ui/primitives'
import { DemoBanner, GenericStatusBadge, MemberPageHeader } from '@/components/features/member-ui'
import type { ComplaintStatus } from '@/lib/data/member-demo'

const STATUS: Record<ComplaintStatus, { key: string; tone: 'active' | 'pending' | 'neutral' }> = {
  submitted: { key: 'member.cmpStatusSubmitted', tone: 'pending' },
  triaged: { key: 'member.cmpStatusTriaged', tone: 'pending' },
  in_progress: { key: 'member.cmpStatusInProgress', tone: 'pending' },
  resolved: { key: 'member.cmpStatusResolved', tone: 'active' },
  closed: { key: 'member.cmpStatusClosed', tone: 'neutral' },
}

const TYPE_KEY: Record<string, string> = {
  boundaryDispute: 'member.cmpTypeBoundary',
  technical: 'member.cmpTypeTechnical',
  conduct: 'member.cmpTypeConduct',
  admin: 'member.cmpTypeAdmin',
}

export default async function ComplaintsPage({
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

  const complaints = getMemberComplaints(session.uid)

  return (
    <div>
      <MemberPageHeader
        title={t('member.complaints')}
        action={
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-brand px-4 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
          >
            <Plus className="size-4" aria-hidden />
            {t('member.fileComplaint')}
          </button>
        }
      />
      <DemoBanner label={t('member.demoNotice')} />

      {complaints.length === 0 ? (
        <EmptyState icon={<MessageSquareWarning />} title={t('member.noComplaints')} />
      ) : (
        <div className="space-y-3">
          {complaints.map((cmp) => {
            const status = STATUS[cmp.status]
            return (
              <Link key={cmp.id} href={href(typed, `dashboard/complaints/${cmp.id}`)} className="block">
                <Card interactive className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-text-primary">
                          <Mono>{cmp.complaintNumber}</Mono>
                        </span>
                        <span className="text-[length:var(--type-xs)] text-text-muted">
                          · {t(TYPE_KEY[cmp.typeKey] ?? 'member.cmpTypeAdmin')}
                        </span>
                      </div>
                      <p className="mt-1.5 text-text-primary">{cmp.subject}</p>
                      <p className="mt-1 text-[length:var(--type-xs)] text-text-muted" data-numeric>
                        {formatDate(cmp.updatedAt, typed)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <GenericStatusBadge tone={status.tone} label={t(status.key)} />
                      <ArrowLeft className="size-4 text-text-muted" data-mirror="true" aria-hidden />
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
