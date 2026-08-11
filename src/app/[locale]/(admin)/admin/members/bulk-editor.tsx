'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Pencil, Users } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Card, Mono, Tag } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/modal'
import { bulkUpdateMembersAction, updateMemberAction } from './bulk-actions'

export interface EditorMember {
  id: string
  membershipNumber: string
  licenseNumber: string | null
  status: string
  isDirectoryVisible: boolean
  governorateCode: string | null
  categoryCode: string | null
  officeName: string | null
  fullNameAr: string
  fullNameEn: string
  importSource: string | null
  incomplete: boolean
}

export interface EditorLabels {
  colName: string
  colOffice: string
  colLicense: string
  colGov: string
  colStatus: string
  colActions: string
  edit: string
  editMember: string
  save: string
  saving: string
  saved: string
  cancel: string
  close: string
  fullNameAr: string
  fullNameEn: string
  officeNameAr: string
  officeNameEn: string
  memberLicense: string
  memberGov: string
  category: string
  directoryVisible: string
  notSet: string
  incompleteBadge: string
  incompleteHint: string
  selected: string
  selectAll: string
  clearSelection: string
  bulkTitle: string
  bulkApply: string
  bulkApplied: string
  bulkNothing: string
  bulkWarning: string
  leaveUnchanged: string
  showInDirectory: string
  hideFromDirectory: string
  empty: string
  saveFailed: string
  noPermission: string
  transliterationNote: string
  importedFrom: string
  statusLabels: Record<string, string>
}

interface Option {
  code: string
  name: string
}

/**
 * The screen for repairing the imported roster.
 *
 * The spreadsheet supplied names and nothing else, so several hundred members
 * are missing the governorate and licence number the directory needs, and
 * their English names are machine transliterations. Fixing that one member at
 * a time would be unreasonable, so this offers two paths: edit one record in
 * full, or apply a single field to a whole selection at once.
 *
 * Every change goes through an audited server action — bulk included, which is
 * recorded as ONE action carrying the affected ids, so a sweeping edit stays
 * reconstructable afterwards.
 */
export function BulkEditor({
  members,
  governorates,
  categories,
  statuses,
  labels,
  canEdit,
}: {
  members: EditorMember[]
  governorates: Option[]
  categories: Option[]
  statuses: string[]
  labels: EditorLabels
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<EditorMember | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const govName = useMemo(
    () => new Map(governorates.map((g) => [g.code, g.name])),
    [governorates],
  )

  const allOnPageSelected =
    members.length > 0 && members.every((m) => selected.has(m.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      allOnPageSelected ? new Set() : new Set([...prev, ...members.map((m) => m.id)]),
    )
  }

  function fill(template: string, count: number) {
    return template.replace('{count}', String(count))
  }

  return (
    <div className="space-y-4">
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

      {/* Selection toolbar — only present once something is selected, so it
          never competes with the table for attention. */}
      {canEdit && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-brand bg-surface-brand-subtle px-4 py-3">
          <Users className="size-4 text-text-brand" aria-hidden />
          <span className="text-[length:var(--type-sm)] font-semibold text-text-brand">
            {fill(labels.selected, selected.size)}
          </span>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="min-h-11 rounded-lg bg-surface-brand px-4 text-[length:var(--type-sm)] font-semibold text-text-on-brand hover:bg-primary-600"
          >
            {labels.bulkApply}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="min-h-11 px-3 text-[length:var(--type-sm)] font-medium text-text-secondary hover:underline"
          >
            {labels.clearSelection}
          </button>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-[length:var(--type-sm)]">
            <thead className="border-b border-border-subtle bg-surface-sunken">
              <tr>
                {canEdit && (
                  <th scope="col" className="p-3 ps-4">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      aria-label={labels.selectAll}
                      className="size-4 accent-[var(--color-surface-brand)]"
                    />
                  </th>
                )}
                <th scope="col" className="p-3 text-start font-semibold text-text-secondary">
                  {labels.colName}
                </th>
                <th scope="col" className="p-3 text-start font-semibold text-text-secondary">
                  {labels.colLicense}
                </th>
                <th scope="col" className="p-3 text-start font-semibold text-text-secondary">
                  {labels.colGov}
                </th>
                <th scope="col" className="p-3 text-start font-semibold text-text-secondary">
                  {labels.colStatus}
                </th>
                <th scope="col" className="p-3 pe-4 text-end font-semibold text-text-secondary">
                  {labels.colActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="p-10 text-center text-text-muted">
                    {labels.empty}
                  </td>
                </tr>
              )}

              {members.map((m) => (
                <tr key={m.id} className="border-b border-border-subtle last:border-0">
                  {canEdit && (
                    <td className="p-3 ps-4">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggle(m.id)}
                        aria-label={m.fullNameAr || m.membershipNumber}
                        className="size-4 accent-[var(--color-surface-brand)]"
                      />
                    </td>
                  )}
                  <td className="p-3">
                    <div className="font-medium text-text-primary">{m.fullNameAr}</div>
                    <div className="text-[length:var(--type-xs)] text-text-muted" dir="ltr">
                      {m.fullNameEn}
                    </div>
                    {m.incomplete && (
                      <span title={labels.incompleteHint} className="mt-1 inline-block">
                        <Tag className="bg-status-warning-bg text-status-warning-fg">
                          {labels.incompleteBadge}
                        </Tag>
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {m.licenseNumber ? (
                      <Mono className="text-text-primary">{m.licenseNumber}</Mono>
                    ) : (
                      <Mono className="text-text-muted">{m.membershipNumber}</Mono>
                    )}
                  </td>
                  <td className="p-3 text-text-secondary">
                    {m.governorateCode ? (
                      (govName.get(m.governorateCode) ?? m.governorateCode)
                    ) : (
                      <span className="text-text-muted">{labels.notSet}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 text-text-secondary">
                      {m.isDirectoryVisible ? (
                        <Eye className="size-3.5 text-status-active-fg" aria-hidden />
                      ) : (
                        <EyeOff className="size-3.5 text-text-muted" aria-hidden />
                      )}
                      {labels.statusLabels[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="p-3 pe-4 text-end">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditing(m)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border-default px-3 font-medium text-text-secondary hover:bg-surface-sunken"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        {labels.edit}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ------------------------------------------------------- single edit */}
      {editing && (
        <EditDialog
          key={editing.id}
          member={editing}
          governorates={governorates}
          categories={categories}
          statuses={statuses}
          labels={labels}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            startTransition(async () => {
              const result = await updateMemberAction({ id: editing.id, ...patch })
              if (!result.ok) {
                setNotice({
                  tone: 'bad',
                  text:
                    result.error === 'UNAUTHORIZED' || result.error === 'UNAUTHENTICATED'
                      ? labels.noPermission
                      : labels.saveFailed,
                })
                return
              }
              setNotice({ tone: 'ok', text: labels.saved })
              setEditing(null)
              router.refresh()
            })
          }}
        />
      )}

      {/* --------------------------------------------------------- bulk edit */}
      {bulkOpen && (
        <BulkDialog
          count={selected.size}
          governorates={governorates}
          categories={categories}
          statuses={statuses}
          labels={labels}
          pending={pending}
          onClose={() => setBulkOpen(false)}
          onApply={(patch) => {
            startTransition(async () => {
              const result = await bulkUpdateMembersAction({ ids: [...selected], ...patch })
              if (!result.ok) {
                setNotice({
                  tone: 'bad',
                  text:
                    result.error === 'NOTHING'
                      ? labels.bulkNothing
                      : result.error === 'UNAUTHORIZED' || result.error === 'UNAUTHENTICATED'
                        ? labels.noPermission
                        : labels.saveFailed,
                })
                return
              }
              setNotice({ tone: 'ok', text: fill(labels.bulkApplied, result.count) })
              setBulkOpen(false)
              setSelected(new Set())
              router.refresh()
            })
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------- edit dialog */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[length:var(--type-xs)] font-medium text-text-secondary">
        {label}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-lg border border-border-default bg-surface-default px-3 text-[length:var(--type-sm)] text-text-primary'

function EditDialog({
  member,
  governorates,
  categories,
  statuses,
  labels,
  pending,
  onClose,
  onSave,
}: {
  member: EditorMember
  governorates: Option[]
  categories: Option[]
  statuses: string[]
  labels: EditorLabels
  pending: boolean
  onClose: () => void
  onSave: (patch: Record<string, unknown>) => void
}) {
  const [fullNameAr, setFullNameAr] = useState(member.fullNameAr)
  const [fullNameEn, setFullNameEn] = useState(member.fullNameEn)
  const [officeNameAr, setOfficeNameAr] = useState(member.officeName ?? '')
  const [licenseNumber, setLicenseNumber] = useState(member.licenseNumber ?? '')
  const [governorateCode, setGovernorateCode] = useState(member.governorateCode ?? '')
  const [categoryCode, setCategoryCode] = useState(member.categoryCode ?? '')
  const [status, setStatus] = useState(member.status)
  const [visible, setVisible] = useState(member.isDirectoryVisible)

  return (
    <Modal
      open
      onClose={onClose}
      title={labels.editMember}
      subtitle={<Mono>{member.membershipNumber}</Mono>}
      closeLabel={labels.close}
      className="max-w-xl"
    >
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSave({
            fullNameAr,
            fullNameEn,
            officeNameAr,
            officeNameEn: officeNameAr, // one office name until staff supply both
            licenseNumber,
            governorateCode,
            categoryCode,
            status,
            isDirectoryVisible: visible,
          })
        }}
      >
        {member.importSource && (
          <p className="rounded-lg border border-border-subtle bg-surface-sunken p-3 text-[length:var(--type-xs)] text-text-secondary">
            {labels.importedFrom.replace('{source}', member.importSource)} —{' '}
            {labels.transliterationNote}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.fullNameAr}>
            <input
              value={fullNameAr}
              onChange={(e) => setFullNameAr(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <Field label={labels.fullNameEn}>
            <input
              value={fullNameEn}
              onChange={(e) => setFullNameEn(e.target.value)}
              dir="ltr"
              className={inputClass}
            />
          </Field>
          <Field label={labels.officeNameAr}>
            <input
              value={officeNameAr}
              onChange={(e) => setOfficeNameAr(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={labels.memberLicense}>
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              dir="ltr"
              className={inputClass}
            />
          </Field>
          <Field label={labels.memberGov}>
            <select
              value={governorateCode}
              onChange={(e) => setGovernorateCode(e.target.value)}
              className={inputClass}
            >
              <option value="">{labels.notSet}</option>
              {governorates.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={labels.category}>
            <select
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
              className={inputClass}
            >
              <option value="">{labels.notSet}</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={labels.colStatus}>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {labels.statusLabels[s] ?? s}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2.5 rounded-lg border border-border-subtle p-3">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="size-4 accent-[var(--color-surface-brand)]"
          />
          <span className="text-[length:var(--type-sm)] text-text-primary">
            {labels.directoryVisible}
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-semibold text-text-secondary hover:bg-surface-sunken"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="min-h-11 rounded-lg bg-surface-brand px-5 text-[length:var(--type-sm)] font-semibold text-text-on-brand hover:bg-primary-600 disabled:opacity-50"
          >
            {pending ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------- bulk dialog */

function BulkDialog({
  count,
  governorates,
  categories,
  statuses,
  labels,
  pending,
  onClose,
  onApply,
}: {
  count: number
  governorates: Option[]
  categories: Option[]
  statuses: string[]
  labels: EditorLabels
  pending: boolean
  onClose: () => void
  onApply: (patch: Record<string, unknown>) => void
}) {
  const [governorateCode, setGovernorateCode] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [status, setStatus] = useState('')
  const [visibility, setVisibility] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      title={labels.bulkTitle}
      subtitle={labels.selected.replace('{count}', String(count))}
      closeLabel={labels.close}
    >
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          // Only send fields the user actually chose — an untouched select must
          // mean "leave alone", never "set to empty".
          const patch: Record<string, unknown> = {}
          if (governorateCode) patch.governorateCode = governorateCode
          if (categoryCode) patch.categoryCode = categoryCode
          if (status) patch.status = status
          if (visibility) patch.isDirectoryVisible = visibility === 'show'
          onApply(patch)
        }}
      >
        <p className="flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg p-3 text-[length:var(--type-xs)] text-status-warning-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {labels.bulkWarning}
        </p>

        <Field label={labels.memberGov}>
          <select
            value={governorateCode}
            onChange={(e) => setGovernorateCode(e.target.value)}
            className={inputClass}
          >
            <option value="">{labels.leaveUnchanged}</option>
            {governorates.map((g) => (
              <option key={g.code} value={g.code}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={labels.category}>
          <select
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value)}
            className={inputClass}
          >
            <option value="">{labels.leaveUnchanged}</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={labels.colStatus}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="">{labels.leaveUnchanged}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {labels.statusLabels[s] ?? s}
              </option>
            ))}
          </select>
        </Field>

        <Field label={labels.directoryVisible}>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className={inputClass}
          >
            <option value="">{labels.leaveUnchanged}</option>
            <option value="show">{labels.showInDirectory}</option>
            <option value="hide">{labels.hideFromDirectory}</option>
          </select>
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-semibold text-text-secondary hover:bg-surface-sunken"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="min-h-11 rounded-lg bg-surface-brand px-5 text-[length:var(--type-sm)] font-semibold text-text-on-brand hover:bg-primary-600 disabled:opacity-50"
          >
            {pending ? labels.saving : labels.bulkApply}
          </button>
        </div>
      </form>
    </Modal>
  )
}
