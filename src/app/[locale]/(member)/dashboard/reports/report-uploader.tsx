'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Paperclip, Plus, Upload } from 'lucide-react'

import { cn } from '@/lib/cn'
import { ACCEPT_ATTRIBUTE, MAX_REPORT_BYTES, NEW_UPLOAD_TYPES, fileTypeFromName } from '@/lib/reports'
import { Modal } from '@/components/ui/modal'
import { submitReportAction, type SubmitResult } from './actions'

interface UploaderLabels {
  upload: string
  uploadTitle: string
  orderNumber: string
  selectOrder: string
  file: string
  fileHint: string
  note: string
  submit: string
  submitting: string
  cancel: string
  uploaded: string
  uploadFailed: string
  orderNotFound: string
  fileTooBig: string
  fileTypeNotAllowed: string
  fileContentMismatch: string
  noPermission: string
}

export function ReportUploader({
  orders,
  labels,
}: {
  orders: Array<{ number: string; title: string }>
  labels: UploaderLabels
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [orderNumber, setOrderNumber] = useState(orders[0]?.number ?? '')
  const [note, setNote] = useState('')
  const [fileName, setFileName] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function pickFile(file: File | null) {
    setClientError(null)
    if (!file) {
      setFileName('')
      return
    }
    // Fast feedback only; the server re-checks the actual bytes, which is the
    // part that decides. Restricted to the formats offered for new uploads —
    // the legacy ones still resolve for existing submissions.
    const type = fileTypeFromName(file.name)
    if (!type || !NEW_UPLOAD_TYPES.includes(type)) {
      setClientError(labels.fileTypeNotAllowed)
      setFileName('')
      return
    }
    if (file.size > MAX_REPORT_BYTES) {
      setClientError(labels.fileTooBig)
      setFileName('')
      return
    }
    setFileName(file.name)
  }

  function reportError(result: Extract<SubmitResult, { ok: false }>) {
    const map: Record<string, string> = {
      ORDER_NOT_FOUND: labels.orderNotFound,
      FILE_TYPE: labels.fileTypeNotAllowed,
      FILE_SIZE: labels.fileTooBig,
      // The extension said one thing and the bytes said another.
      FILE_CONTENT: labels.fileContentMismatch,
      STORAGE: labels.uploadFailed,
      UNAUTHORIZED: labels.noPermission,
      UNAUTHENTICATED: labels.noPermission,
    }
    setBanner({ tone: 'bad', text: map[result.error] ?? labels.uploadFailed })
  }

  function submit() {
    const picked = inputRef.current?.files?.[0]
    if (!picked) {
      setClientError(labels.fileTypeNotAllowed)
      return
    }
    startTransition(async () => {
      // The actual bytes travel in a FormData — the server stores the file and
      // checksums it, so sending only a name and a size would be theatre.
      const body = new FormData()
      body.set('orderNumber', orderNumber)
      body.set('note', note)
      body.set('file', picked)

      const result = await submitReportAction(body)
      if (!result.ok) return reportError(result)
      setBanner({ tone: 'ok', text: labels.uploaded })
      setOpen(false)
      setNote('')
      setFileName('')
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setBanner(null)
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-brand px-4 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
      >
        <Plus className="size-4" aria-hidden />
        {labels.upload}
      </button>

      {banner && (
        <p
          role="status"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[length:var(--type-xs)]',
            banner.tone === 'ok'
              ? 'border-status-active-border bg-status-active-bg text-status-active-fg'
              : 'border-status-overdue-border bg-status-overdue-bg text-status-overdue-fg',
          )}
        >
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          {banner.text}
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={labels.uploadTitle}
        closeLabel={labels.cancel}
      >
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
              <div>
                <label
                  htmlFor="report-order"
                  className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
                >
                  {labels.orderNumber}
                </label>
                <select
                  id="report-order"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-lg border border-border-default bg-surface-default px-3 text-[length:var(--type-sm)] text-text-primary"
                >
                  {orders.map((o) => (
                    <option key={o.number} value={o.number}>
                      {o.number} — {o.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-[length:var(--type-xs)] font-medium text-text-secondary">
                  {labels.file}
                </span>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-1.5 flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-border-default bg-surface-sunken px-3 text-start text-[length:var(--type-sm)] text-text-secondary transition-colors hover:border-border-strong"
                >
                  <Paperclip className="size-4 shrink-0" aria-hidden />
                  {fileName ? (
                    <span className="truncate text-text-primary" dir="ltr">
                      {fileName}
                    </span>
                  ) : (
                    <span>{labels.fileHint}</span>
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT_ATTRIBUTE}
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                {clientError && (
                  <p role="alert" className="mt-1 text-[length:var(--type-xs)] text-status-overdue-fg">
                    {clientError}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="report-note"
                  className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
                >
                  {labels.note}
                </label>
                <textarea
                  id="report-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-[length:var(--type-sm)] text-text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-semibold text-text-secondary hover:bg-surface-sunken"
                >
                  {labels.cancel}
                </button>
                <button
                  type="submit"
                  disabled={pending || !fileName}
                  aria-busy={pending}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-brand px-5 text-[length:var(--type-sm)] font-semibold text-text-on-brand hover:bg-primary-600 disabled:opacity-50"
                >
                  <Upload className="size-4" aria-hidden />
                  {pending ? labels.submitting : labels.submit}
                </button>
              </div>
        </form>
      </Modal>
    </div>
  )
}
