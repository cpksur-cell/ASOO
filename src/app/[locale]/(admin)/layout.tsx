import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, FileSliders, LayoutDashboard, Newspaper, ScrollText, ShieldCheck, Users } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { can, getUserSession } from '@/lib/auth/server'
import { STAFF_ROLES } from '@/lib/auth/roles'
import { href } from '@/lib/routes'

export default async function AdminLayout({
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
   * Layer 2 of the three-layer model. Middleware already rejected requests
   * carrying no session at all; this is the check that knows the role.
   * docs/08-security.md §3.
   */
  const session = await getUserSession()
  const isStaff = session && (STAFF_ROLES as readonly string[]).includes(session.role)

  if (!isStaff) {
    redirect(href(typed, 'login'))
  }

  /*
   * A nav item appears only if its role actually holds the permission behind
   * it. docs/04-site-architecture.md §5.4: "A content editor never sees a
   * finance menu item they cannot use."
   *
   * This is presentation, not access control — each page re-checks. Hiding a
   * link stops a colleague wasting a click; it does not stop an attacker.
   */
  const candidates = [
    { key: 'dashboard', label: t('admin.dashboard'), path: 'admin', icon: LayoutDashboard, permission: null },
    { key: 'members', label: t('admin.members'), path: 'admin/members', icon: Users, permission: ['members', 'read'] as const },
    { key: 'reviews', label: t('reports.navAdmin'), path: 'admin/reviews', icon: ClipboardCheck, permission: ['reports', 'review'] as const },
    { key: 'homepage', label: t('admin.homepageComposer'), path: 'admin/cms/homepage', icon: FileSliders, permission: ['layout', 'manage'] as const },
    { key: 'news', label: t('admin.newsManager'), path: 'admin/cms/news', icon: Newspaper, permission: ['posts', 'write'] as const },
    { key: 'audit', label: t('admin.audit'), path: 'admin/audit', icon: ScrollText, permission: ['audit', 'read'] as const },
  ]

  const navItems = (
    await Promise.all(
      candidates.map(async (item) =>
        !item.permission || (await can(item.permission[0], item.permission[1])) ? item : null,
      ),
    )
  ).filter((item): item is (typeof candidates)[number] => item !== null)

  return (
    <div className="flex min-h-dvh flex-col bg-surface-sunken lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-6 border-e border-border-subtle bg-surface-default p-6 lg:w-64">
        <div className="flex items-center gap-2 border-b border-border-subtle pb-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-status-active-bg text-status-active-fg">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col leading-none">
            <span className="text-[length:var(--type-base)] font-semibold text-text-primary">
              {t('admin.portal')}
            </span>
            <span className="mt-1 truncate text-[length:var(--type-xs)] text-text-muted">
              {session.displayName}
            </span>
          </div>
        </div>

        <nav aria-label={t('admin.nav')} className="flex-1">
          <ul className="space-y-1.5 lg:space-y-1">
            {navItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={href(typed, item.path)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[length:var(--type-sm)] font-medium text-text-secondary transition-colors hover:bg-surface-brand-subtle hover:text-text-brand"
                >
                  <item.icon className="size-4" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-border-subtle pt-4">
          <Link
            href={href(typed)}
            className="flex min-h-11 items-center justify-between text-[length:var(--type-xs)] font-semibold text-text-muted hover:text-text-brand"
          >
            <span>{t('admin.backToSite')}</span>
            <ArrowLeft className="size-3.5" data-mirror="true" aria-hidden />
          </Link>
        </div>
      </aside>

      <main className="max-w-7xl flex-1 p-6 md:p-10">{children}</main>
    </div>
  )
}
