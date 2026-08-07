import { notFound, redirect } from 'next/navigation'
import { Lock } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDateTime } from '@/i18n/format'
import { can } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { listAuditRows } from '@/lib/data/store'
import { Card, Mono, Tag } from '@/components/ui/primitives'

/**
 * The audit log viewer.
 *
 * `super_admin` only, and deliberately so — docs/08-security.md §4. An officer
 * who can read the audit log can see what they need to avoid.
 *
 * Read-only by construction: `store.ts` exposes an append function and a list
 * function, and nothing else. There is no update or delete path anywhere in
 * the application, which is the point.
 */
export default async function AuditPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  if (!(await can('audit', 'read'))) {
    redirect(href(typed, 'admin'))
  }

  const t = createTranslator(getDictionary(typed))
  const rows = listAuditRows(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[length:var(--type-3xl)] font-bold text-text-primary">
          {t('admin.auditTitle')}
        </h1>
        <p className="prose-measure mt-2 text-[length:var(--type-sm)] text-text-muted">
          {t('admin.auditIntro')}
        </p>
      </div>

      <p className="flex items-center gap-2 rounded-lg border border-status-pending-border bg-status-pending-bg px-4 py-2.5 text-[length:var(--type-xs)] font-medium text-status-pending-fg">
        <Lock className="size-4 shrink-0" aria-hidden />
        {t('admin.auditAppendOnly')}
      </p>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-text-muted">{t('admin.auditEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-sunken text-[length:var(--type-xs)] text-text-muted">
                  <th className="p-3 font-semibold">{t('admin.auditWhen')}</th>
                  <th className="p-3 font-semibold">{t('admin.auditActor')}</th>
                  <th className="p-3 font-semibold">{t('admin.auditAction')}</th>
                  <th className="p-3 font-semibold">{t('admin.auditEntity')}</th>
                  <th className="p-3 font-semibold">{t('admin.auditReason')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border-subtle text-[length:var(--type-sm)] last:border-0"
                  >
                    <td className="whitespace-nowrap p-3 text-text-secondary" data-numeric>
                      {formatDateTime(row.createdAt, typed)}
                    </td>
                    <td className="p-3">
                      <span className="text-text-primary">{row.actorUserId}</span>
                      {/* The role is a SNAPSHOT taken at the time of the action.
                          Roles change; the log must not. */}
                      <span className="ms-2">
                        <Tag>{row.actorRole}</Tag>
                      </span>
                    </td>
                    <td className="p-3">
                      <Mono className="font-medium text-text-brand">{row.action}</Mono>
                    </td>
                    <td className="p-3 text-text-secondary">
                      <Mono>
                        {row.entityType}:{row.entityId}
                      </Mono>
                    </td>
                    <td className="p-3 text-text-secondary">{row.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
