'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Inbox, KeyRound, Send, ThumbsDown, UserCheck } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/modal'
import { Card, EmptyState, Mono, Tag } from '@/components/ui/primitives'
import { answerServiceRequestAction, takeServiceRequestAction, type AnswerResult } from './actions'

export interface QueueLabels {
  title: string
  intro: string
  demoNotice: string
  empty: string
  closedHeading: string
  requester: string
  service: string
  dlsKey: string
  requestedOn: string
  answer: string
  answerTitle: string
  take: string
  takenDone: string
  responseData: string
  responseDataHint: string
  rejectReason: string
  fulfil: string
  reject: string
  fulfilledDone: string
  rejectedDone: string
  dataRequired: string
  reasonRequired: string
  close: string
  cancel: string
  noPermission: string
  actionFailed: string
}

export interface QueueItem {
  id: string
  requestNumber: string
  serviceLabel: string
  statusLabel: string
  dlsKey: string
  note: string
  requesterName: string
  requesterEmail: string
  requestedOn: string
  inProgress: boolean
}

export interface ClosedItem {
  id: string
  requestNumber: string
  serviceLabel: string
  statusLabel: string
  dlsKey: string
  fulfilled: boolean
}

export function ServiceRequestQueue({
  labels,
  open,
  closed,
}: {
  labels: QueueLabels
  open: QueueItem[]
  closed: ClosedItem[]
}) {
  const router = useRouter()
  const [answering, setAnswering] = useState<QueueItem | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function errText(result: Extract<AnswerResult, { ok: false }>): string {
    if (result.error === 'UNAUTHORIZED' || result.error === 'UNAUTHENTICATED') {
      return labels.noPermission
    }
    if (result.error === 'DATA_REQUIRED') return labels.dataRequired
    if (result.error === 'REASON_REQUIRED') return labels.reasonRequired
    return labels.actionFailed
  }

  function take(item: QueueItem) {
    startTransition(async () => {
      const result = await takeServiceRequestAction(item.id)
      if (!result.ok) return setNotice({ tone: 'bad', text: errText(result) })
      setNotice({ tone: 'ok', text: labels.takenDone })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[length:var(--type-3xl)] font-bold text-text-primary">{labels.title}</h1>
        <p className="prose-measure mt-2 text-[length:var(--type-sm)] text-text-muted">
          {labels.intro}
        </p>
      </div>

      {labels.demoNotice && (
        <p className="rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-2.5 text-[length:var(--type-xs)] font-medium text-status-warning-fg">
          {labels.demoNotice}
        </p>
      )}

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

      {open.length === 0 ? (
        <EmptyState icon={<Inbox />} title={labels.empty} />
      ) : (
        <ul className="space-y-3">
          {open.map((item) => (
            <li key={item.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Mono className="font-semibold text-text-primary">{item.requestNumber}</Mono>
                      <Tag>{item.statusLabel}</Tag>
                    </div>
                    <p className="mt-1.5 text-text-primary">{item.serviceLabel}</p>

                    {/* The key is the whole request — give it the prominence
                        the officer's eye needs when copying it. */}
                    <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-1.5">
                      <KeyRound className="size-4 text-text-brand" aria-hidden />
                      <span className="text-[length:var(--type-xs)] text-text-muted">
                        {labels.dlsKey}
                      </span>
                      <Mono className="text-[length:var(--type-base)] font-semibold text-text-primary">
                        {item.dlsKey}
                      </Mono>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[length:var(--type-xs)] text-text-muted">
                      <span>
                        {labels.requester}:{' '}
                        <span className="text-text-secondary">{item.requesterName}</span>
                      </span>
                      {item.requesterEmail && (
                        <span dir="ltr" className="text-text-secondary">
                          {item.requesterEmail}
                        </span>
                      )}
                      <span>
                        {labels.requestedOn}: <span data-numeric>{item.requestedOn}</span>
                      </span>
                    </div>
                    {item.note && (
                      <p className="mt-2 text-[length:var(--type-sm)] text-text-secondary">
                        {item.note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {!item.inProgress && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => take(item)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-semibold text-text-secondary hover:bg-surface-sunken disabled:opacity-50"
                      >
                        <UserCheck className="size-4" aria-hidden />
                        {labels.take}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAnswering(item)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-surface-brand px-4 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
                    >
                      <Send className="size-4" aria-hidden />
                      {labels.answer}
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <section className="border-t border-border-subtle pt-6">
          <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">
            {labels.closedHeading}
          </h2>
          <ul className="mt-4 space-y-2">
            {closed.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border-subtle bg-surface-default px-4 py-3 text-[length:var(--type-sm)]"
              >
                <Mono className="font-semibold text-text-primary">{item.requestNumber}</Mono>
                <span className="text-text-secondary">{item.serviceLabel}</span>
                <Mono className="text-text-muted">{item.dlsKey}</Mono>
                <span
                  className={cn(
                    'ms-auto text-[length:var(--type-xs)] font-medium',
                    item.fulfilled ? 'text-status-active-fg' : 'text-status-overdue-fg',
                  )}
                >
                  {item.statusLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {answering && (
        <AnswerDialog
          labels={labels}
          item={answering}
          onClose={() => setAnswering(null)}
          onDone={(text) => {
            setAnswering(null)
            setNotice({ tone: 'ok', text })
            router.refresh()
          }}
          onError={(text) => setNotice({ tone: 'bad', text })}
          errText={errText}
        />
      )}
    </div>
  )
}

function AnswerDialog({
  labels,
  item,
  onClose,
  onDone,
  onError,
  errText,
}: {
  labels: QueueLabels
  item: QueueItem
  onClose: () => void
  onDone: (text: string) => void
  onError: (text: string) => void
  errText: (result: Extract<AnswerResult, { ok: false }>) => string
}) {
  const [data, setData] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [pending, startTransition] = useTransition()

  function decide(decision: 'fulfilled' | 'rejected') {
    setTouched(true)
    if (decision === 'fulfilled' && !data.trim()) return
    if (decision === 'rejected' && !note.trim()) return

    startTransition(async () => {
      const result = await answerServiceRequestAction({
        id: item.id,
        decision,
        responseData: data,
        responseNote: note,
      })
      if (!result.ok) return onError(errText(result))
      onDone(decision === 'fulfilled' ? labels.fulfilledDone : labels.rejectedDone)
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={labels.answerTitle}
      subtitle={
        <>
          <Mono>{item.requestNumber}</Mono> · {item.serviceLabel}
        </>
      }
      closeLabel={labels.close}
    >
      <div className="mt-5 space-y-4">
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2">
          <KeyRound className="size-4 text-text-brand" aria-hidden />
          <span className="text-[length:var(--type-xs)] text-text-muted">{labels.dlsKey}</span>
          <Mono className="font-semibold text-text-primary">{item.dlsKey}</Mono>
        </p>

        <div>
          <label
            htmlFor="response-data"
            className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
          >
            {labels.responseData}
          </label>
          <textarea
            id="response-data"
            rows={7}
            dir="auto"
            value={data}
            onChange={(e) => setData(e.target.value)}
            aria-describedby="response-data-hint"
            className="mt-1.5 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2.5 font-mono text-[length:var(--type-sm)] text-text-primary"
          />
          <p id="response-data-hint" className="mt-1 text-[length:var(--type-xs)] text-text-muted">
            {labels.responseDataHint}
          </p>
          {touched && !data.trim() && (
            <p className="mt-1 text-[length:var(--type-xs)] text-text-muted">
              {labels.dataRequired}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="response-note"
            className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
          >
            {labels.rejectReason}
          </label>
          <textarea
            id="response-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-[length:var(--type-sm)] text-text-primary"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide('fulfilled')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-status-active-fg px-4 text-[length:var(--type-sm)] font-semibold text-neutral-0 hover:opacity-90 disabled:opacity-50"
          >
            <Send className="size-4" aria-hidden />
            {labels.fulfil}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide('rejected')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-status-overdue-border bg-status-overdue-bg px-4 text-[length:var(--type-sm)] font-semibold text-status-overdue-fg hover:opacity-90 disabled:opacity-50"
          >
            <ThumbsDown className="size-4" aria-hidden />
            {labels.reject}
          </button>
        </div>
      </div>
    </Modal>
  )
}
