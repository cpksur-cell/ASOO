'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  FileText,
  QrCode,
  ThumbsDown,
  ThumbsUp,
  RotateCcw,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import type { Locale } from '@/i18n/client'
import { href } from '@/lib/routes'
import { Modal } from '@/components/ui/modal'
import { Card, EmptyState, Mono, Tag } from '@/components/ui/primitives'
import { reviewReportAction, type ReviewResult } from './actions'

export interface ReviewLabels {
  title: string
  intro: string
  demoNotice: string
  empty: string
  member: string
  order: string
  file: string
  version: string
  review: string
  reviewTitle: string
  approve: string
  reject: string
  requestRevision: string
  decisionComment: string
  commentRequired: string
  confirmApprove: string
  approvedDone: string
  rejectedDone: string
  revisionDone: string
  downloadFile: string
  verificationCode: string
  scanToVerify: string
  cancel: string
  close: string
  noPermission: string
  actionFailed: string
}

interface Item {
  id: string
  orderNumber: string
  orderTitle: string
  orderType: string
  memberName: string
  fileType: string
  fileName: string
  fileSize: string
  version: number
  note: string
}

export function ReviewQueue({
  locale,
  labels,
  items,
}: {
  locale: Locale
  labels: ReviewLabels
  items: Item[]
}) {
  const [reviewing, setReviewing] = useState<Item | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[length:var(--type-3xl)] font-bold text-text-primary">{labels.title}</h1>
        <p className="mt-2 text-[length:var(--type-sm)] text-text-muted">{labels.intro}</p>
      </div>

      {/* Blank once the queue is backed by Postgres — the page decides. */}
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

      {items.length === 0 ? (
        <EmptyState icon={<BadgeCheck />} title={labels.empty} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono className="font-semibold text-text-primary">{item.orderNumber}</Mono>
                    <Tag>{item.fileType}</Tag>
                    <span className="text-[length:var(--type-xs)] text-text-muted">
                      · {item.orderType}
                    </span>
                  </div>
                  <p className="mt-1.5 text-text-primary">{item.orderTitle}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[length:var(--type-xs)] text-text-muted">
                    <span>
                      {labels.member}: <span className="text-text-secondary">{item.memberName}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="size-3.5" aria-hidden />
                      <span dir="ltr">{item.fileName}</span>
                    </span>
                    <span>
                      {labels.version} <span data-numeric>{item.version}</span> · {item.fileSize}
                    </span>
                  </div>
                  {item.note && (
                    <p className="mt-2 text-[length:var(--type-sm)] text-text-secondary">{item.note}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setReviewing(item)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-brand px-4 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
                >
                  {labels.review}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {reviewing && (
        <ReviewDialog
          locale={locale}
          labels={labels}
          item={reviewing}
          onClose={() => setReviewing(null)}
          onDone={(text) => {
            setReviewing(null)
            setNotice({ tone: 'ok', text })
          }}
          onError={(text) => setNotice({ tone: 'bad', text })}
        />
      )}
    </div>
  )
}

function ReviewDialog({
  locale,
  labels,
  item,
  onClose,
  onDone,
  onError,
}: {
  locale: Locale
  labels: ReviewLabels
  item: Item
  onClose: () => void
  onDone: (text: string) => void
  onError: (text: string) => void
}) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function errText(result: Extract<ReviewResult, { ok: false }>) {
    if (result.error === 'UNAUTHORIZED' || result.error === 'UNAUTHENTICATED') return labels.noPermission
    if (result.error === 'COMMENT_REQUIRED') return labels.commentRequired
    return labels.actionFailed
  }

  function decide(decision: 'approved' | 'rejected' | 'revision_requested') {
    if ((decision === 'rejected' || decision === 'revision_requested') && !comment.trim()) {
      setTouched(true)
      return
    }
    startTransition(async () => {
      const result = await reviewReportAction({ submissionId: item.id, decision, comment })
      if (!result.ok) return onError(errText(result))

      if (decision === 'approved' && result.verificationCode) {
        // Show the issued code and QR link before closing.
        setIssued(result.verificationCode)
        router.refresh()
        return
      }
      router.refresh()
      onDone(decision === 'rejected' ? labels.rejectedDone : labels.revisionDone)
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={labels.reviewTitle}
      subtitle={
        <>
          <Mono>{item.orderNumber}</Mono> · {item.memberName}
        </>
      }
      closeLabel={labels.close}
    >
      <>
        {issued ? (
          // Approval issued: show the verification code and a link that opens
          // the public verify page (which renders the QR).
          <div className="mt-5 rounded-lg border border-status-active-border bg-status-active-bg p-5 text-center">
            <BadgeCheck className="mx-auto size-8 text-status-active-fg" aria-hidden />
            <p className="mt-2 font-semibold text-status-active-fg">{labels.approvedDone}</p>
            <p className="mt-3 text-[length:var(--type-sm)] text-text-secondary">
              {labels.verificationCode}
            </p>
            <p className="mt-1">
              <Mono className="text-[length:var(--type-lg)] font-bold text-text-primary">{issued}</Mono>
            </p>
            <a
              href={href(locale, `services/verify-report/${issued}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-default bg-surface-default px-4 text-[length:var(--type-sm)] font-semibold text-text-brand hover:bg-surface-sunken"
            >
              <QrCode className="size-4" aria-hidden />
              {labels.scanToVerify}
            </a>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => onDone(labels.approvedDone)}
                className="min-h-11 rounded-lg bg-surface-brand px-5 text-[length:var(--type-sm)] font-semibold text-text-on-brand hover:bg-primary-600"
              >
                {labels.close}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-3">
              <span className="inline-flex items-center gap-2 text-[length:var(--type-sm)] text-text-primary">
                <FileText className="size-4 text-text-brand" aria-hidden />
                <span dir="ltr">{item.fileName}</span>
              </span>
              {/* Phase 3: a signed URL to the private bucket. */}
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1.5 text-[length:var(--type-sm)] font-medium text-text-brand hover:underline"
              >
                <Download className="size-4" aria-hidden />
                {labels.downloadFile}
              </button>
            </div>

            <div className="mt-4">
              <label
                htmlFor="review-comment"
                className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
              >
                {labels.decisionComment}
              </label>
              <textarea
                id="review-comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onBlur={() => setTouched(true)}
                className="mt-1.5 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2.5 text-[length:var(--type-sm)] text-text-primary"
              />
              {touched && !comment.trim() && (
                <p className="mt-1 text-[length:var(--type-xs)] text-text-muted">
                  {labels.commentRequired}
                </p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => decide('approved')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-status-active-fg px-4 text-[length:var(--type-sm)] font-semibold text-neutral-0 hover:opacity-90 disabled:opacity-50"
              >
                <ThumbsUp className="size-4" aria-hidden />
                {labels.approve}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => decide('revision_requested')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-4 text-[length:var(--type-sm)] font-semibold text-status-warning-fg hover:opacity-90 disabled:opacity-50"
              >
                <RotateCcw className="size-4" aria-hidden />
                {labels.requestRevision}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => decide('rejected')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-[length:var(--type-sm)] font-semibold text-neutral-0 hover:bg-red-500 disabled:opacity-50"
              >
                <ThumbsDown className="size-4" aria-hidden />
                {labels.reject}
              </button>
            </div>
          </>
        )}
      </>
    </Modal>
  )
}
