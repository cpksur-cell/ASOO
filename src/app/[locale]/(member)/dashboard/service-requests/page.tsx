import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { FileSearch, Inbox, Plus } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { listRequestsForUser } from '@/lib/data/service-requests'
import { serviceRequestKey, SERVICE_REQUEST_SLUGS } from '@/lib/service-requests'
import { Card, EmptyState, Mono } from '@/components/ui/primitives'
import {
  ServiceRequestStatusBadge,
  serviceRequestStatusKey,
} from '@/components/features/service-request-status'

export default async function MemberServiceRequestsPage({
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

  /*
   * Scoped to the SESSION's uid, not to anything the URL carries. There is no
   * id in this route to tamper with, and that is deliberate — a member's list
   * is derived from who they are, so there is nothing to authorize beyond
   * being signed in.
   */
  const requests = await listRequestsForUser(session.uid)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--type-2xl)] font-bold text-text-primary">
            {t('serviceRequests.myTitle')}
          </h1>
          <p className="prose-measure mt-2 text-[length:var(--type-sm)] text-text-muted">
            {t('serviceRequests.myIntro')}
          </p>
        </div>
        <Link
          href={href(typed, `services/${SERVICE_REQUEST_SLUGS.electronic_plate}`)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-brand px-4 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
        >
          <Plus className="size-4" aria-hidden />
          {t('serviceRequests.newRequest')}
        </Link>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title={t('serviceRequests.myEmpty')}
          body={t('serviceRequests.sectionIntro')}
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Mono className="font-semibold text-text-primary">
                        {request.requestNumber}
                      </Mono>
                      <ServiceRequestStatusBadge
                        status={request.status}
                        label={t(serviceRequestStatusKey(request.status))}
                      />
                    </div>
                    <p className="mt-1.5 text-text-primary">
                      {t(serviceRequestKey(request.type, 'Title'))}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[length:var(--type-xs)] text-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <FileSearch className="size-3.5" aria-hidden />
                        {t('serviceRequests.dlsKey')}:{' '}
                        <Mono className="text-text-secondary">{request.dlsKey}</Mono>
                      </span>
                      <span>
                        {t('serviceRequests.requestedOn')}:{' '}
                        <span data-numeric>{formatDate(request.createdAt, typed)}</span>
                      </span>
                    </div>
                    {request.note && (
                      <p className="mt-2 text-[length:var(--type-sm)] text-text-secondary">
                        {request.note}
                      </p>
                    )}
                  </div>
                </div>

                {/*
                  The answer, verbatim. `whitespace-pre-wrap` because the
                  department's data arrives as lines that carry meaning —
                  collapsing them would make a parcel record unreadable.
                */}
                {request.responseData ? (
                  <div className="mt-4 rounded-lg border border-status-active-border bg-status-active-bg p-4">
                    <p className="text-[length:var(--type-xs)] font-semibold text-status-active-fg">
                      {t('serviceRequests.response')}
                    </p>
                    <p
                      dir="auto"
                      className="mt-2 whitespace-pre-wrap font-mono text-[length:var(--type-sm)] text-text-primary"
                    >
                      {request.responseData}
                    </p>
                  </div>
                ) : request.status === 'rejected' ? null : (
                  <p className="mt-4 border-t border-border-subtle pt-3 text-[length:var(--type-xs)] text-text-muted">
                    {t('serviceRequests.awaitingResponse')}
                  </p>
                )}

                {request.responseNote && (
                  <p className="mt-3 text-[length:var(--type-sm)] text-text-secondary">
                    <span className="text-text-muted">{t('serviceRequests.responseNote')}: </span>
                    {request.responseNote}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
