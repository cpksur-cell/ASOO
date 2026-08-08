import { notFound, redirect } from 'next/navigation'

import { formatFileSize } from '@/i18n/format'
import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { can } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { getOrder, listReviewQueue } from '@/lib/data/reports-source'
import { members as seedMembers } from '@/lib/data/seed'

import { ReviewQueue, type ReviewLabels } from './review-queue'

export default async function AdminReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  if (!(await can('reports', 'review'))) {
    redirect(href(typed, 'admin'))
  }

  const t = createTranslator(getDictionary(typed))

  // Demo: every submission belongs to the mock member. Phase 3 joins the
  // submission's user to the member record for the real name.
  const demoMemberName = seedMembers[0]!.fullName[typed]

  const items = await Promise.all(
    (await listReviewQueue()).map(async (s) => {
    const order = await getOrder(s.orderId)
    return {
      id: s.id,
      orderNumber: order?.orderNumber ?? s.orderId,
      orderTitle: order?.title ?? '',
      orderType: order ? t(`reports.orderType_${order.type}`) : '',
      memberName: demoMemberName,
      fileType: s.fileType.toUpperCase(),
      fileName: s.fileName,
      fileSize: formatFileSize(s.fileSize, typed),
      version: s.version,
      note: s.note,
    }
    }),
  )

  const labels: ReviewLabels = {
    title: t('reports.queueTitle'),
    intro: t('reports.queueIntro'),
    demoNotice: t('admin.demoDataNotice'),
    empty: t('reports.queueEmpty'),
    member: t('reports.member'),
    order: t('reports.order'),
    file: t('reports.file'),
    version: t('reports.version'),
    review: t('reports.review'),
    reviewTitle: t('reports.reviewTitle'),
    approve: t('reports.approve'),
    reject: t('reports.reject'),
    requestRevision: t('reports.requestRevision'),
    decisionComment: t('reports.decisionComment'),
    commentRequired: t('reports.commentRequired'),
    confirmApprove: t('reports.confirmApprove'),
    approvedDone: t('reports.approvedDone'),
    rejectedDone: t('reports.rejectedDone'),
    revisionDone: t('reports.revisionDone'),
    downloadFile: t('reports.downloadFile'),
    verificationCode: t('reports.verificationCode'),
    scanToVerify: t('reports.scanToVerify'),
    cancel: t('reports.cancel'),
    close: t('admin.close'),
    noPermission: t('reports.noPermission'),
    actionFailed: t('reports.actionFailed'),
  }

  return <ReviewQueue locale={typed} labels={labels} items={items} />
}
