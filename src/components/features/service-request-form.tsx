'use client'

import { useId, useState, useTransition } from 'react'
import { CheckCircle2, KeyRound, Send } from 'lucide-react'

import { isValidDlsKey, normalizeDlsKey, MAX_NOTE_LENGTH } from '@/lib/service-requests'
import type { ServiceRequestType } from '@/lib/service-requests'
import {
  submitServiceRequestAction,
  type ServiceRequestResult,
} from '@/app/[locale]/(public)/services/actions'

export interface ServiceRequestFormLabels {
  dlsKey: string
  dlsKeyHint: string
  dlsKeyInvalid: string
  note: string
  noteHint: string
  submit: string
  submitting: string
  submitFailed: string
  submitted: string
  submittedBody: string
  requestNumber: string
  trackRequest: string
  noPermission: string
}

export function ServiceRequestForm({
  type,
  labels,
  trackHref,
}: {
  type: ServiceRequestType
  labels: ServiceRequestFormLabels
  trackHref: string
}) {
  const fieldId = useId()
  const [dlsKey, setDlsKey] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // State holds the NORMALIZED key, so the field shows exactly what will be
  // stored: an Arabic-digit key turns into Western digits under the cursor
  // rather than silently changing shape after submission. CLAUDE.md §7 wants
  // identifiers in 0-9, and the moment to show that is while it can still be
  // checked against the paper.
  const valid = isValidDlsKey(dlsKey)

  function message(result: Extract<ServiceRequestResult, { ok: false }>): string {
    if (result.error === 'UNAUTHENTICATED' || result.error === 'UNAUTHORIZED') {
      return labels.noPermission
    }
    if (result.error === 'INVALID_KEY') return labels.dlsKeyInvalid
    return labels.submitFailed
  }

  function submit() {
    setTouched(true)
    if (!valid) return
    setFailure(null)
    startTransition(async () => {
      const result = await submitServiceRequestAction({ type, dlsKey, note })
      if (!result.ok) {
        setFailure(message(result))
        return
      }
      setIssued(result.requestNumber)
    })
  }

  if (issued) {
    return (
      <div
        role="status"
        className="rounded-lg border border-status-active-border bg-status-active-bg p-6 text-center"
      >
        <CheckCircle2 className="mx-auto size-9 text-status-active-fg" aria-hidden />
        <p className="mt-3 text-[length:var(--type-lg)] font-semibold text-status-active-fg">
          {labels.submitted}
        </p>
        <p className="mt-2 text-[length:var(--type-sm)] text-text-secondary">
          {labels.submittedBody}
        </p>
        <p className="mt-4 text-[length:var(--type-xs)] text-text-muted">{labels.requestNumber}</p>
        <p className="mt-1 font-mono text-[length:var(--type-lg)] font-bold text-text-primary" data-numeric>
          {issued}
        </p>
        <a
          href={trackHref}
          className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-surface-brand px-5 text-[length:var(--type-sm)] font-semibold text-text-on-brand hover:bg-primary-600"
        >
          {labels.trackRequest}
        </a>
      </div>
    )
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
    >
      <div>
        <label
          htmlFor={`${fieldId}-key`}
          className="block text-[length:var(--type-sm)] font-medium text-text-primary"
        >
          {labels.dlsKey}
        </label>
        <div className="relative mt-2">
          {/* `start-0` is the logical inset — it flips to the right edge in
              Arabic without a second rule. CLAUDE.md §9. */}
          <span className="pointer-events-none absolute inset-y-0 start-0 flex w-11 items-center justify-center text-text-muted">
            <KeyRound className="size-4" aria-hidden />
          </span>
          <input
            id={`${fieldId}-key`}
            value={dlsKey}
            onChange={(e) => setDlsKey(normalizeDlsKey(e.target.value))}
            onBlur={() => setTouched(true)}
            // A key is an identifier: Western digits, LTR, monospace, so a
            // transposed character is visible. CLAUDE.md §7.
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            aria-describedby={`${fieldId}-hint`}
            aria-invalid={touched && !valid}
            className="min-h-12 w-full rounded-lg border border-border-default bg-surface-default ps-11 pe-3 font-mono text-[length:var(--type-base)] tracking-wide text-text-primary"
          />
        </div>
        <p id={`${fieldId}-hint`} className="mt-2 text-[length:var(--type-xs)] text-text-muted">
          {labels.dlsKeyHint}
        </p>
        {touched && !valid && dlsKey.trim() !== '' && (
          <p role="alert" className="mt-1 text-[length:var(--type-xs)] text-status-overdue-fg">
            {labels.dlsKeyInvalid}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={`${fieldId}-note`}
          className="block text-[length:var(--type-sm)] font-medium text-text-primary"
        >
          {labels.note}
        </label>
        <textarea
          id={`${fieldId}-note`}
          rows={3}
          maxLength={MAX_NOTE_LENGTH}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-describedby={`${fieldId}-note-hint`}
          className="mt-2 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2.5 text-[length:var(--type-sm)] text-text-primary"
        />
        <p id={`${fieldId}-note-hint`} className="mt-1 text-[length:var(--type-xs)] text-text-muted">
          {labels.noteHint}
        </p>
      </div>

      {failure && (
        <p
          role="alert"
          className="rounded-lg border border-status-overdue-border bg-status-overdue-bg px-4 py-2.5 text-[length:var(--type-sm)] text-status-overdue-fg"
        >
          {failure}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-surface-brand px-6 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600 disabled:opacity-50 sm:w-auto"
      >
        <Send className="size-4" aria-hidden />
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  )
}
