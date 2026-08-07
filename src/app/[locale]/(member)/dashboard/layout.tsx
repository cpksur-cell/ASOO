import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import {
  getMemberProfile,
  getMemberOutstandingFils,
  getMemberUnreadCount,
} from '@/lib/data/member'
import { StationMark } from '@/components/ui/station-mark'
import { MemberSidebar, type MemberNavItem } from '@/components/layout/member-sidebar'
import { MemberStatusPill } from '@/components/features/member-status-pill'

export default async function MemberLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  /*
   * Layer 2. Middleware bounced anyone without a session; this confirms the
   * session is a MEMBER. Staff who wander here are sent to their own area
   * rather than shown an empty member shell.
   */
  const session = await getUserSession()
  if (!session) redirect(href(typed, 'login'))
  if (session.role !== 'member') redirect(href(typed, 'admin'))

  const profile = getMemberProfile(session.uid)
  const outstanding = getMemberOutstandingFils(session.uid)
  const unread = getMemberUnreadCount(session.uid)

  // "Expiring soon" = licence lapses within 60 days. docs/06-ux-flows.md §3.
  const daysToExpiry = Math.ceil(
    (new Date(profile.licenseExpiresAt).getTime() - Date.now()) / 86_400_000,
  )

  const nav: MemberNavItem[] = [
    { key: 'overview', label: t('member.overview'), href: href(typed, 'dashboard'), exact: true },
    { key: 'subscriptions', label: t('member.subscriptions'), href: href(typed, 'dashboard/subscriptions') },
    { key: 'reports', label: t('reports.navMember'), href: href(typed, 'dashboard/reports') },
    { key: 'profile', label: t('member.profile'), href: href(typed, 'dashboard/profile') },
    { key: 'renewal', label: t('member.renewal'), href: href(typed, 'dashboard/renewal') },
    { key: 'certificates', label: t('member.certificates'), href: href(typed, 'dashboard/certificates') },
    { key: 'complaints', label: t('member.complaints'), href: href(typed, 'dashboard/complaints') },
    {
      key: 'notifications',
      label: t('member.notifications'),
      href: href(typed, 'dashboard/notifications'),
      count: unread,
    },
  ]

  return (
    <div className="min-h-dvh bg-surface-sunken">
      {/* Top bar carries the identity and the persistent status pill. */}
      <div className="border-b border-border-subtle bg-surface-default">
        <div className="container-page flex flex-wrap items-center gap-4 py-4">
          <Link href={href(typed)} className="flex items-center gap-2.5 text-text-primary">
            <StationMark className="size-9 shrink-0" />
            <span className="font-display text-[length:var(--type-base)] font-semibold">
              {t('member.dashboard')}
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-4">
            <MemberStatusPill
              hasOverdue={outstanding > 0}
              expiringSoon={daysToExpiry <= 60 && daysToExpiry > 0}
              labels={{
                active: t('member.statusActive'),
                overdue: t('member.statusOverdue'),
                expiring: t('member.statusExpiring'),
              }}
            />
            <span className="hidden text-end sm:block">
              <span className="block text-[length:var(--type-sm)] font-semibold text-text-primary">
                {profile.fullName[typed]}
              </span>
              <span className="block text-[length:var(--type-xs)] text-text-muted" data-numeric>
                {profile.membershipNumber}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="container-page flex flex-col gap-6 py-6 lg:flex-row">
        {/* Sidebar: a left column on desktop, a horizontal scroll strip on
            mobile. Anchored inline-start so it sits on the right in Arabic. */}
        <aside className="lg:w-64 lg:shrink-0">
          <nav aria-label={t('member.nav')}>
            <div className="lg:sticky lg:top-6">
              <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
                <div className="min-w-max lg:min-w-0">
                  <MemberSidebar items={nav} />
                </div>
              </div>

              <div className="mt-4 border-t border-border-subtle pt-4">
                <Link
                  href={href(typed)}
                  className="flex min-h-11 items-center justify-between rounded-lg px-3 text-[length:var(--type-xs)] font-semibold text-text-muted hover:text-text-brand"
                >
                  <span>{t('member.backToSite')}</span>
                  <ArrowLeft className="size-3.5" data-mirror="true" aria-hidden />
                </Link>
              </div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
