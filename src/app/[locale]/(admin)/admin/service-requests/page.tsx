import { notFound, redirect } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate } from '@/i18n/format'
import { can } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { listClosedRequests, listOpenRequests } from '@/lib/data/service-requests'
import { serviceRequestKey } from '@/lib/service-requests'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { serviceRequestStatusKey } from '@/components/features/service-request-status'

import { ServiceRequestQueue, type QueueLabels } from './request-queue'

export default async function AdminServiceRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  // Layer 2. The nav already hid this from roles without the permission; that
  // was presentation. This is the check that refuses.
  if (!(await can('requests', 'read'))) {
    redirect(href(typed, 'admin'))
  }

  const t = createTranslator(getDictionary(typed))
  const [open, closed] = await Promise.all([listOpenRequests(), listClosedRequests()])

  const labels: QueueLabels = {
    title: t('serviceRequests.queueTitle'),
    intro: t('serviceRequests.queueIntro'),
    // Empty when a real database is behind the queue; the component omits the
    // banner entirely rather than rendering an empty box.
    demoNotice: isSupabaseConfigured() ? '' : t('admin.demoDataNotice'),
    empty: t('serviceRequests.queueEmpty'),
    closedHeading: t('serviceRequests.queueClosed'),
    requester: t('serviceRequests.requester'),
    service: t('serviceRequests.service'),
    dlsKey: t('serviceRequests.dlsKey'),
    requestedOn: t('serviceRequests.requestedOn'),
    answer: t('serviceRequests.answer'),
    answerTitle: t('serviceRequests.answerTitle'),
    take: t('serviceRequests.take'),
    takenDone: t('serviceRequests.takenDone'),
    responseData: t('serviceRequests.responseData'),
    responseDataHint: t('serviceRequests.responseDataHint'),
    rejectReason: t('serviceRequests.rejectReason'),
    fulfil: t('serviceRequests.fulfil'),
    reject: t('serviceRequests.reject'),
    fulfilledDone: t('serviceRequests.fulfilledDone'),
    rejectedDone: t('serviceRequests.rejectedDone'),
    dataRequired: t('serviceRequests.dataRequired'),
    reasonRequired: t('serviceRequests.reasonRequired'),
    close: t('serviceRequests.close'),
    cancel: t('serviceRequests.cancel'),
    noPermission: t('serviceRequests.noPermission'),
    actionFailed: t('serviceRequests.actionFailed'),
  }

  return (
    <ServiceRequestQueue
      labels={labels}
      open={open.map((r) => ({
        id: r.id,
        requestNumber: r.requestNumber,
        serviceLabel: t(serviceRequestKey(r.type, 'Title')),
        statusLabel: t(serviceRequestStatusKey(r.status)),
        dlsKey: r.dlsKey,
        note: r.note,
        requesterName: r.requesterName,
        requesterEmail: r.requesterEmail,
        requestedOn: formatDate(r.createdAt, typed),
        inProgress: r.status === 'in_progress',
      }))}
      closed={closed.map((r) => ({
        id: r.id,
        requestNumber: r.requestNumber,
        serviceLabel: t(serviceRequestKey(r.type, 'Title')),
        statusLabel: t(serviceRequestStatusKey(r.status)),
        dlsKey: r.dlsKey,
        fulfilled: r.status === 'fulfilled',
      }))}
    />
  )
}
