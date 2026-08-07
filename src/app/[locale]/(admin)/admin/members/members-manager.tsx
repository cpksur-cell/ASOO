'use client'

import { useMemo, useState, useTransition } from 'react'
import { Ban, CheckCircle2, RotateCcw, Search, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { normalizeArabic } from '@/i18n/format'
import { Card, Mono } from '@/components/ui/primitives'
import { GenericStatusBadge } from '@/components/features/member-ui'
import type { AdminMemberStatus } from '@/lib/data/store'
import { reactivateMemberAction, suspendMemberAction } from './actions'

interface Row {
  id: string
  licenseNumber: string
  membershipNumber: string
  status: AdminMemberStatus
  fullName: string
  officeName: string
  governorate: string
}

export interface MembersLabels {
  title: string
  intro: string
  demoNotice: string
  search: string
  allStatuses: string
  statusActive: string
  statusSuspended: string
  statusExpired: string
  statusWithdrawn: string
  colName: string
  colOffice: string
  colLicense: string
  colGov: string
  colStatus: string
  colActions: string
  suspend: string
  reactivate: string
  suspendTitle: string
  suspendReason: string
  suspendReasonHint: string
  reasonRequired: string
  confirmSuspend: string
  cancel: string
  suspended: string
  reactivated: string
  noPermission: string
  saveFailed: string
  empty: string
  resultsCountTemplate: string
}

const STATUS_TONE: Record<AdminMemberStatus, 'active' | 'overdue' | 'neutral'> = {
  active: 'active',
  suspended: 'overdue',
  expired: 'neutral',
  withdrawn: 'neutral',
}

export function MembersManager({
  labels,
  members,
  canSuspend,
}: {
  labels: MembersLabels
  members: Row[]
  canSuspend: boolean
}) {
  const [rows, setRows] = useState(members)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AdminMemberStatus>('all')
  const [suspending, setSuspending] = useState<Row | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const statusLabel: Record<AdminMemberStatus, string> = {
    active: labels.statusActive,
    suspended: labels.statusSuspended,
    expired: labels.statusExpired,
    withdrawn: labels.statusWithdrawn,
  }

  // Arabic-normalised search — "احمد" must find "أحمد". docs/03-data-model §9.
  const filtered = useMemo(() => {
    const needle = normalizeArabic(query)
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!needle) return true
      const hay = normalizeArabic(`${r.fullName} ${r.officeName} ${r.licenseNumber} ${r.membershipNumber}`)
      return hay.includes(needle)
    })
  }, [rows, query, statusFilter])

  function reactivate(row: Row) {
    startTransition(async () => {
      const result = await reactivateMemberAction({ id: row.id })
      if (!result.ok) {
        setNotice({ tone: 'bad', text: result.error === 'UNAUTHORIZED' ? labels.noPermission : labels.saveFailed })
        return
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: 'active' } : r)))
      setNotice({ tone: 'ok', text: labels.reactivated })
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[length:var(--type-3xl)] font-bold text-text-primary">{labels.title}</h1>
        <p className="mt-2 text-[length:var(--type-sm)] text-text-muted">{labels.intro}</p>
      </div>

      <p className="rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-2.5 text-[length:var(--type-xs)] font-medium text-status-warning-fg">
        {labels.demoNotice}
      </p>

      {notice && (
        <p
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[length:var(--type-sm)]',
            notice.tone === 'ok'
              ? 'border-status-active-border bg-status-active-bg text-status-active-fg'
              : 'border-status-overdue-border bg-status-overdue-bg text-status-overdue-fg',
          )}
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {notice.text}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="member-search" className="sr-only">
            {labels.search}
          </label>
          <Search
            className="pointer-events-none absolute inset-inline-start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            id="member-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.search}
            className="min-h-11 w-full rounded-lg border border-border-default bg-surface-default ps-10 pe-3 text-[length:var(--type-sm)] text-text-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | AdminMemberStatus)}
          aria-label={labels.colStatus}
          className="min-h-11 rounded-lg border border-border-default bg-surface-default px-3 text-[length:var(--type-sm)] text-text-primary sm:w-48"
        >
          <option value="all">{labels.allStatuses}</option>
          <option value="active">{labels.statusActive}</option>
          <option value="suspended">{labels.statusSuspended}</option>
          <option value="expired">{labels.statusExpired}</option>
          <option value="withdrawn">{labels.statusWithdrawn}</option>
        </select>
      </div>

      <p className="text-[length:var(--type-xs)] text-text-muted">
        {labels.resultsCountTemplate.replace('{count}', String(filtered.length))}
      </p>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-10 text-center text-text-muted">{labels.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-sunken text-[length:var(--type-xs)] text-text-muted">
                  <th className="p-3 text-start font-semibold">{labels.colName}</th>
                  <th className="p-3 text-start font-semibold">{labels.colOffice}</th>
                  <th className="p-3 text-start font-semibold">{labels.colLicense}</th>
                  <th className="p-3 text-start font-semibold">{labels.colGov}</th>
                  <th className="p-3 text-start font-semibold">{labels.colStatus}</th>
                  {canSuspend && <th className="p-3 text-start font-semibold">{labels.colActions}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border-subtle text-[length:var(--type-sm)] last:border-0"
                  >
                    <td className="p-3 font-medium text-text-primary">{row.fullName}</td>
                    <td className="p-3 text-text-secondary">{row.officeName}</td>
                    <td className="p-3">
                      <Mono className="text-text-primary">{row.licenseNumber}</Mono>
                    </td>
                    <td className="p-3 text-text-secondary">{row.governorate}</td>
                    <td className="p-3">
                      <GenericStatusBadge tone={STATUS_TONE[row.status]} label={statusLabel[row.status]} />
                    </td>
                    {canSuspend && (
                      <td className="p-3">
                        {row.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => setSuspending(row)}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[length:var(--type-sm)] font-semibold text-status-overdue-fg transition-colors hover:bg-surface-sunken"
                          >
                            <Ban className="size-4" aria-hidden />
                            {labels.suspend}
                          </button>
                        ) : row.status === 'suspended' ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => reactivate(row)}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[length:var(--type-sm)] font-semibold text-status-active-fg transition-colors hover:bg-surface-sunken disabled:opacity-50"
                          >
                            <RotateCcw className="size-4" aria-hidden />
                            {labels.reactivate}
                          </button>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {suspending && (
        <SuspendDialog
          labels={labels}
          member={suspending}
          pending={pending}
          onCancel={() => setSuspending(null)}
          onConfirm={(reason) => {
            startTransition(async () => {
              const result = await suspendMemberAction({ id: suspending.id, reason })
              if (!result.ok) {
                setNotice({
                  tone: 'bad',
                  text: result.error === 'UNAUTHORIZED' ? labels.noPermission : labels.saveFailed,
                })
                return
              }
              setRows((prev) =>
                prev.map((r) => (r.id === suspending.id ? { ...r, status: 'suspended' } : r)),
              )
              setSuspending(null)
              setNotice({ tone: 'ok', text: labels.suspended })
            })
          }}
        />
      )}
    </div>
  )
}

function SuspendDialog({
  labels,
  member,
  pending,
  onCancel,
  onConfirm,
}: {
  labels: MembersLabels
  member: Row
  pending: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const valid = reason.trim().length > 0

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-primary-950/60 backdrop-blur-[2px]" onClick={onCancel} aria-hidden />
      <Card role="alertdialog" aria-modal="true" aria-label={labels.suspendTitle} className="relative z-10 w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">
            {labels.suspendTitle}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={labels.cancel}
            className="inline-flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-sunken"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <p className="mt-2 font-medium text-text-primary">{member.fullName}</p>
        <p className="text-[length:var(--type-sm)] text-text-muted">
          <Mono>{member.licenseNumber}</Mono>
        </p>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (valid) onConfirm(reason.trim())
          }}
        >
          <label htmlFor="suspend-reason" className="block text-[length:var(--type-xs)] font-medium text-text-secondary">
            {labels.suspendReason}
          </label>
          <textarea
            id="suspend-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && !valid}
            className={cn(
              'mt-1.5 w-full rounded-lg border bg-surface-default px-3 py-2.5 text-[length:var(--type-sm)] text-text-primary',
              touched && !valid ? 'border-status-overdue-border' : 'border-border-default',
            )}
          />
          {touched && !valid ? (
            <p role="alert" className="mt-1 text-[length:var(--type-xs)] text-status-overdue-fg">
              {labels.reasonRequired}
            </p>
          ) : (
            <p className="mt-1 text-[length:var(--type-xs)] text-text-muted">{labels.suspendReasonHint}</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-semibold text-text-secondary hover:bg-surface-sunken"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={pending || !valid}
              aria-busy={pending}
              className="min-h-11 rounded-lg bg-red-600 px-5 text-[length:var(--type-sm)] font-semibold text-neutral-0 hover:bg-red-500 disabled:opacity-50"
            >
              {labels.confirmSuspend}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
