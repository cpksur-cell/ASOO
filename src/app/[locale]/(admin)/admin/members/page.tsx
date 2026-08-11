import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { can } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { listAdminMembers, listMemberCategories } from '@/lib/data/admin-members'
import { listGovernorates } from '@/lib/data/members-source'
import { Card } from '@/components/ui/primitives'
import { BulkEditor, type EditorLabels } from './bulk-editor'

const PER_PAGE = 25
const STATUSES = ['active', 'pending', 'suspended', 'expired', 'withdrawn']

/**
 * Member administration.
 *
 * Reads from Postgres rather than the demonstration store, because the records
 * that need attention are the several hundred loaded from the syndicate's
 * roster — names only, no governorate, no licence number. Search, the status
 * and governorate filters, and the "incomplete only" toggle all run in the
 * database, so the screen stays usable at that size.
 */
export default async function AdminMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    q?: string
    status?: string
    governorate?: string
    incomplete?: string
    page?: string
  }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  if (!(await can('members', 'read'))) {
    redirect(href(typed, 'admin'))
  }

  const t = createTranslator(getDictionary(typed))
  const canEdit = await can('members', 'update')

  const sp = await searchParams
  const q = sp.q ?? ''
  const status = sp.status ?? 'all'
  const governorate = sp.governorate ?? 'all'
  const incompleteOnly = sp.incomplete === '1'
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  const [governorates, categories, result] = await Promise.all([
    listGovernorates(typed),
    listMemberCategories(typed),
    listAdminMembers({ q, status, governorate, incompleteOnly, page, perPage: PER_PAGE }),
  ])

  const statusLabels: Record<string, string> = {
    active: t('admin.mStatusActive'),
    suspended: t('admin.mStatusSuspended'),
    expired: t('admin.mStatusExpired'),
    withdrawn: t('admin.mStatusWithdrawn'),
    pending: t('admin.mStatusActive'),
  }

  const labels: EditorLabels = {
    colName: t('admin.memberName'),
    colOffice: t('admin.memberOffice'),
    colLicense: t('admin.memberLicense'),
    colGov: t('admin.memberGov'),
    colStatus: t('admin.status'),
    colActions: t('admin.actions'),
    edit: t('admin.edit'),
    editMember: t('admin.editMember'),
    save: t('admin.save'),
    saving: t('admin.saving'),
    saved: t('admin.saved'),
    cancel: t('admin.cancel'),
    close: t('admin.close'),
    fullNameAr: t('admin.fullNameAr'),
    fullNameEn: t('admin.fullNameEn'),
    officeNameAr: t('admin.officeNameAr'),
    officeNameEn: t('admin.officeNameEn'),
    memberLicense: t('admin.memberLicense'),
    memberGov: t('admin.memberGov'),
    category: t('admin.category'),
    directoryVisible: t('admin.directoryVisible'),
    notSet: t('admin.notSet'),
    incompleteBadge: t('admin.incompleteBadge'),
    incompleteHint: t('admin.incompleteHint'),
    // Templates with placeholders — a function cannot cross the server→client
    // boundary, so the client interpolates the count itself.
    selected: t('admin.selected', { count: '{count}' }),
    selectAll: t('admin.selectAll'),
    clearSelection: t('admin.clearSelection'),
    bulkTitle: t('admin.bulkTitle'),
    bulkApply: t('admin.bulkApply'),
    bulkApplied: t('admin.bulkApplied', { count: '{count}' }),
    bulkNothing: t('admin.bulkNothing'),
    bulkWarning: t('admin.bulkWarning'),
    leaveUnchanged: t('admin.leaveUnchanged'),
    showInDirectory: t('admin.showInDirectory'),
    hideFromDirectory: t('admin.hideFromDirectory'),
    empty: t('admin.noMembers'),
    saveFailed: t('admin.saveFailed'),
    noPermission: t('admin.noPermission'),
    transliterationNote: t('admin.transliterationNote'),
    importedFrom: t('admin.importedFrom', { source: '{source}' }),
    statusLabels,
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PER_PAGE))
  const pageHref = (next: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status !== 'all') params.set('status', status)
    if (governorate !== 'all') params.set('governorate', governorate)
    if (incompleteOnly) params.set('incomplete', '1')
    if (next > 1) params.set('page', String(next))
    const qs = params.toString()
    return href(typed, `admin/members${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[length:var(--type-3xl)] font-bold text-text-primary">
          {t('admin.membersTitle')}
        </h1>
        <p className="mt-2 text-[length:var(--type-sm)] text-text-muted">
          {t('admin.membersIntro')}
        </p>
      </div>

      {/* Filters are a plain GET form, so every view is a shareable URL and the
          back button behaves — there is no client state to lose. */}
      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="min-w-56 flex-1">
            <span className="block text-[length:var(--type-xs)] font-medium text-text-secondary">
              {t('admin.searchMembers')}
            </span>
            <input
              name="q"
              defaultValue={q}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-border-default bg-surface-default px-3 text-[length:var(--type-sm)] text-text-primary"
            />
          </label>

          <label>
            <span className="block text-[length:var(--type-xs)] font-medium text-text-secondary">
              {t('admin.status')}
            </span>
            <select
              name="status"
              defaultValue={status}
              className="mt-1.5 min-h-11 rounded-lg border border-border-default bg-surface-default px-3 text-[length:var(--type-sm)] text-text-primary"
            >
              <option value="all">{t('admin.allStatuses')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s] ?? s}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="block text-[length:var(--type-xs)] font-medium text-text-secondary">
              {t('admin.memberGov')}
            </span>
            <select
              name="governorate"
              defaultValue={governorate}
              className="mt-1.5 min-h-11 rounded-lg border border-border-default bg-surface-default px-3 text-[length:var(--type-sm)] text-text-primary"
            >
              <option value="all">{t('common.all')}</option>
              {governorates.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="incomplete"
              value="1"
              defaultChecked={incompleteOnly}
              className="size-4 accent-[var(--color-surface-brand)]"
            />
            <span className="text-[length:var(--type-sm)] text-text-secondary">
              {t('admin.incompleteOnly')}
            </span>
          </label>

          <button
            type="submit"
            className="min-h-11 rounded-lg bg-surface-brand px-5 text-[length:var(--type-sm)] font-semibold text-text-on-brand hover:bg-primary-600"
          >
            {t('common.search')}
          </button>
        </form>
      </Card>

      <p className="text-[length:var(--type-sm)] text-text-muted">
        {t('admin.resultsCount', { count: result.total })}
      </p>

      <BulkEditor
        members={result.items}
        governorates={governorates.map((g) => ({ code: g.code, name: g.name }))}
        categories={categories}
        statuses={STATUSES}
        labels={labels}
        canEdit={canEdit}
      />

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label={t('common.page')}>
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="inline-flex min-h-11 items-center rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-medium text-text-secondary hover:bg-surface-sunken"
            >
              {t('admin.prevPage')}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[length:var(--type-sm)] text-text-muted">
            <span data-numeric>{page}</span> / <span data-numeric>{totalPages}</span>
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="inline-flex min-h-11 items-center rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-medium text-text-secondary hover:bg-surface-sunken"
            >
              {t('admin.nextPage')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}
