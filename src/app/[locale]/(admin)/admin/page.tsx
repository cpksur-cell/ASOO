import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileSliders, Newspaper, ShieldAlert, Sparkles } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { Card } from '@/components/ui/primitives'

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  /*
   * PLACEHOLDER FIGURES — not wired to the database.
   * Phase 3 replaces these with real aggregates from the finance and
   * membership tables. They are marked as demonstration data in the UI so no
   * one mistakes them for the syndicate's actual numbers.
   */
  const stats = [
    { label: t('admin.activeMembers'), value: '450', change: `+3 ${t('admin.thisMonth')}` },
    { label: t('admin.newApplications'), value: '12', change: t('admin.needsReview') },
    { label: t('admin.unpaidInvoices'), value: '32', change: t('admin.overdue') },
  ]

  const quickLinks = [
    {
      title: t('admin.homepageComposer'),
      desc: t('admin.homepageComposerDesc'),
      path: 'admin/cms/homepage',
      icon: <FileSliders className="size-6 text-text-brand" aria-hidden />,
    },
    {
      title: t('admin.newsManager'),
      desc: t('admin.newsManagerDesc'),
      path: 'admin/cms/news',
      icon: <Newspaper className="size-6 text-text-accent" aria-hidden />,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[length:var(--type-3xl)] font-bold text-text-primary">
          {t('admin.dashboardTitle')}
        </h1>
        <p className="mt-2 text-[length:var(--type-sm)] text-text-muted">
          {t('admin.dashboardIntro')}
        </p>
      </div>

      <p className="rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-2.5 text-[length:var(--type-xs)] font-medium text-status-warning-fg">
        {t('admin.demoDataNotice')}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <p className="text-[length:var(--type-sm)] font-medium text-text-muted">{stat.label}</p>
            <p className="mt-3 text-[length:var(--type-3xl)] font-bold text-text-primary" data-numeric>
              {stat.value}
            </p>
            <p className="mt-2 flex items-center gap-1 text-[length:var(--type-xs)] font-semibold text-text-accent">
              <Sparkles className="size-3" aria-hidden />
              {stat.change}
            </p>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-[length:var(--type-xl)] font-semibold text-text-primary">
          {t('admin.quickLinks')}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {quickLinks.map((link) => (
            <Card key={link.path} className="flex items-start gap-4 p-6">
              <span className="rounded-xl bg-surface-sunken p-3">{link.icon}</span>
              <div className="flex-1 space-y-2">
                <h3 className="text-[length:var(--type-base)] font-bold text-text-primary">
                  {link.title}
                </h3>
                <p className="text-[length:var(--type-sm)] text-text-muted">{link.desc}</p>
                <Link
                  href={href(typed, link.path)}
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[length:var(--type-sm)] font-semibold text-text-brand hover:underline"
                >
                  {t('admin.enterSection')}
                  <ArrowLeft className="size-4" data-mirror="true" aria-hidden />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-status-pending-border bg-status-pending-bg p-4">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-status-pending-fg" aria-hidden />
        <div className="space-y-1">
          <p className="text-[length:var(--type-sm)] font-semibold text-status-pending-fg">
            {t('admin.securityNoticeTitle')}
          </p>
          <p className="text-[length:var(--type-xs)] leading-relaxed text-text-secondary">
            {t('admin.securityNoticeBody')}
          </p>
        </div>
      </div>
    </div>
  )
}
