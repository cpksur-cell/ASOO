import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { getMemberComplaint } from '@/lib/data/member'
import { cn } from '@/lib/cn'
import { Card, Mono } from '@/components/ui/primitives'
import { DemoBanner, GenericStatusBadge, MemberPageHeader } from '@/components/features/member-ui'
import type { ComplaintStatus } from '@/lib/data/member-demo'

const STATUS: Record<ComplaintStatus, { key: string; tone: 'active' | 'pending' | 'neutral' }> = {
  submitted: { key: 'member.cmpStatusSubmitted', tone: 'pending' },
  triaged: { key: 'member.cmpStatusTriaged', tone: 'pending' },
  in_progress: { key: 'member.cmpStatusInProgress', tone: 'pending' },
  resolved: { key: 'member.cmpStatusResolved', tone: 'active' },
  closed: { key: 'member.cmpStatusClosed', tone: 'neutral' },
}

export default async function ComplaintDetailPage({
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

  const complaint = getMemberComplaint(session.uid, id)
  if (!complaint) notFound()

  const status = STATUS[complaint.status]

  return (
    <div>
      <Link
        href={href(typed, 'dashboard/complaints')}
        className="mb-4 inline-flex items-center gap-1.5 text-[length:var(--type-sm)] font-medium text-text-muted hover:text-text-brand"
      >
        <ArrowLeft className="size-4" data-mirror="true" aria-hidden />
        {t('member.complaints')}
      </Link>

      <MemberPageHeader
        title={complaint.subject}
        action={<GenericStatusBadge tone={status.tone} label={t(status.key)} />}
      />
      <DemoBanner label={t('member.demoNotice')} />

      <p className="mb-6 text-[length:var(--type-sm)] text-text-muted">
        {t('member.complaintNumber')}: <Mono className="text-text-primary">{complaint.complaintNumber}</Mono>
      </p>

      <h2 className="mb-4 text-[length:var(--type-lg)] font-semibold text-text-primary">
        {t('member.conversation')}
      </h2>

      <div className="space-y-4">
        {complaint.messages.map((msg) => {
          const fromStaff = msg.authorKey === 'staff'
          return (
            <div
              key={msg.id}
              className={cn('flex', fromStaff ? 'justify-start' : 'justify-end')}
            >
              <Card
                className={cn(
                  'max-w-[85%] p-4',
                  fromStaff ? 'bg-surface-brand-subtle' : 'bg-surface-default',
                )}
              >
                <p className="mb-1.5 text-[length:var(--type-xs)] font-semibold text-text-muted">
                  {fromStaff ? t('member.staffReply') : t('member.you')}
                  <span className="ms-2 font-normal" data-numeric>
                    {formatDate(msg.createdAt, typed)}
                  </span>
                </p>
                <p className="text-[length:var(--type-sm)] leading-relaxed text-text-primary">
                  {msg.body}
                </p>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
