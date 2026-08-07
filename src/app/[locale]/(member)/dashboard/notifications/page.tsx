import { notFound, redirect } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { getMemberNotifications } from '@/lib/data/member'
import { MemberPageHeader, DemoBanner } from '@/components/features/member-ui'
import { NotificationList } from './notification-list'

export default async function NotificationsPage({
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

  const notifications = getMemberNotifications(session.uid).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: t(`member.${n.titleKey}`),
    createdAt: n.createdAt,
    read: n.read,
  }))

  return (
    <div>
      <MemberPageHeader title={t('member.notifications')} />
      <DemoBanner label={t('member.demoNotice')} />
      <NotificationList
        initial={notifications}
        labels={{ markAllRead: t('member.markAllRead'), empty: t('member.noNotifications') }}
      />
    </div>
  )
}
