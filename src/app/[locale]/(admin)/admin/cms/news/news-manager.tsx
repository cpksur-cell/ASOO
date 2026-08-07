'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Archive, CheckCircle2, Pencil, Plus, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate } from '@/i18n/format'
import type { Locale } from '@/i18n/client'
import type { DemoNewsItem } from '@/lib/data/demo'
import { Card, StatusBadge, type StatusTone } from '@/components/ui/primitives'
import { archivePostAction, savePostAction, type ActionResult } from '../actions'

export interface NewsLabels {
  title: string
  intro: string
  demoNotice: string
  newPost: string
  editPost: string
  colTitle: string
  colCategory: string
  colDate: string
  colStatus: string
  colActions: string
  edit: string
  archive: string
  archiveConfirmTitle: string
  archiveConfirmBody: string
  confirmArchive: string
  cancel: string
  save: string
  close: string
  published: string
  draft: string
  scheduled: string
  slug: string
  slugHint: string
  excerpt: string
  image: string
  saved: string
  saveFailed: string
  noPermission: string
  invalidInput: string
  empty: string
}

const STATUS_TONE: Record<DemoNewsItem['status'], StatusTone> = {
  published: 'active',
  draft: 'neutral',
  scheduled: 'pending',
}

function blankPost(): DemoNewsItem {
  return {
    id: `p-${Date.now()}`,
    slug: '',
    title: '',
    category: '',
    publishedAt: new Date().toISOString().slice(0, 10),
    status: 'draft',
    featuredImage: '/images/news/assembly-meeting.png',
    excerpt: '',
  }
}

export function NewsManager({
  labels,
  initialPosts,
  locale,
}: {
  labels: NewsLabels
  initialPosts: DemoNewsItem[]
  locale: Locale
}) {
  const [posts, setPosts] = useState(initialPosts)
  const [editing, setEditing] = useState<DemoNewsItem | null>(null)
  const [archiving, setArchiving] = useState<DemoNewsItem | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  /** Map an action failure onto a message the user can act on. */
  function reportFailure(result: Extract<ActionResult<unknown>, { ok: false }>) {
    const text =
      result.error === 'UNAUTHORIZED' || result.error === 'UNAUTHENTICATED'
        ? labels.noPermission
        : result.error === 'INVALID'
          ? labels.invalidInput
          : labels.saveFailed
    setNotice({ tone: 'bad', text })
  }

  function save(post: DemoNewsItem) {
    startTransition(async () => {
      const result = await savePostAction(post)
      if (!result.ok) return reportFailure(result)
      setPosts((prev) => {
        const i = prev.findIndex((p) => p.id === post.id)
        if (i === -1) return [post, ...prev]
        const next = [...prev]
        next[i] = post
        return next
      })
      setEditing(null)
      setNotice({ tone: 'ok', text: labels.saved })
    })
  }

  function archive(post: DemoNewsItem) {
    startTransition(async () => {
      const result = await archivePostAction({ id: post.id })
      if (!result.ok) return reportFailure(result)
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, status: 'draft' as const } : p)),
      )
      setArchiving(null)
      setNotice({ tone: 'ok', text: labels.saved })
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--type-3xl)] font-bold text-text-primary">
            {labels.title}
          </h1>
          <p className="mt-2 text-[length:var(--type-sm)] text-text-muted">{labels.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(blankPost())}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-brand px-4 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
        >
          <Plus className="size-4" aria-hidden />
          {labels.newPost}
        </button>
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

      <Card className="overflow-hidden">
        {posts.length === 0 ? (
          <p className="p-10 text-center text-text-muted">{labels.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-sunken text-[length:var(--type-xs)] text-text-muted">
                  <th className="p-3 font-semibold">{labels.colTitle}</th>
                  <th className="p-3 font-semibold">{labels.colCategory}</th>
                  <th className="p-3 font-semibold">{labels.colDate}</th>
                  <th className="p-3 font-semibold">{labels.colStatus}</th>
                  <th className="p-3 font-semibold">{labels.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-border-subtle text-[length:var(--type-sm)] text-text-primary last:border-0"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-sunken">
                          <Image
                            src={post.featuredImage}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </span>
                        <span className="font-medium">{post.title}</span>
                      </div>
                    </td>
                    <td className="p-3 text-text-secondary">{post.category}</td>
                    <td className="p-3 text-text-secondary" data-numeric>
                      {formatDate(post.publishedAt, locale)}
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        tone={STATUS_TONE[post.status]}
                        icon={<CheckCircle2 />}
                      >
                        {labels[post.status]}
                      </StatusBadge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(post)}
                          aria-label={`${labels.edit}: ${post.title}`}
                          className="inline-flex size-11 items-center justify-center rounded text-text-brand transition-colors hover:bg-surface-sunken"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchiving(post)}
                          aria-label={`${labels.archive}: ${post.title}`}
                          className="inline-flex size-11 items-center justify-center rounded text-status-warning-fg transition-colors hover:bg-surface-sunken"
                        >
                          <Archive className="size-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <EditDialog
          labels={labels}
          post={editing}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}

      {archiving && (
        <ConfirmDialog
          title={labels.archiveConfirmTitle}
          /* Names the specific consequence, never "Are you sure?".
             docs/06-ux-flows.md §10. */
          body={`${labels.archiveConfirmBody}`}
          subject={archiving.title}
          confirmLabel={labels.confirmArchive}
          cancelLabel={labels.cancel}
          pending={pending}
          onCancel={() => setArchiving(null)}
          onConfirm={() => archive(archiving)}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- dialogs */

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-primary-950/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      {children}
    </div>
  )
}

const field =
  'min-h-11 w-full rounded-lg border border-border-default bg-surface-default px-3 ' +
  'text-[length:var(--type-sm)] text-text-primary'

function EditDialog({
  labels,
  post,
  pending,
  onCancel,
  onSave,
}: {
  labels: NewsLabels
  post: DemoNewsItem
  pending: boolean
  onCancel: () => void
  onSave: (p: DemoNewsItem) => void
}) {
  const [draft, setDraft] = useState(post)
  const set = (patch: Partial<DemoNewsItem>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <Overlay onClose={onCancel}>
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={labels.editPost}
        className="relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[length:var(--type-xl)] font-semibold text-text-primary">
            {labels.editPost}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={labels.close}
            className="inline-flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-sunken"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(draft)
          }}
        >
          <Labelled id="post-title" label={labels.colTitle}>
            <input
              id="post-title"
              required
              className={field}
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Labelled>

          <Labelled id="post-slug" label={labels.slug} hint={labels.slugHint}>
            <input
              id="post-slug"
              required
              dir="ltr"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className={cn(field, 'font-mono')}
              value={draft.slug}
              onChange={(e) => set({ slug: e.target.value })}
            />
          </Labelled>

          <div className="grid gap-4 sm:grid-cols-2">
            <Labelled id="post-category" label={labels.colCategory}>
              <input
                id="post-category"
                required
                className={field}
                value={draft.category}
                onChange={(e) => set({ category: e.target.value })}
              />
            </Labelled>
            <Labelled id="post-date" label={labels.colDate}>
              <input
                id="post-date"
                type="date"
                required
                dir="ltr"
                className={field}
                value={draft.publishedAt}
                onChange={(e) => set({ publishedAt: e.target.value })}
              />
            </Labelled>
          </div>

          <Labelled id="post-status" label={labels.colStatus}>
            <select
              id="post-status"
              className={field}
              value={draft.status}
              onChange={(e) => set({ status: e.target.value as DemoNewsItem['status'] })}
            >
              <option value="draft">{labels.draft}</option>
              <option value="scheduled">{labels.scheduled}</option>
              <option value="published">{labels.published}</option>
            </select>
          </Labelled>

          <Labelled id="post-image" label={labels.image}>
            <input
              id="post-image"
              dir="ltr"
              className={cn(field, 'font-mono')}
              value={draft.featuredImage}
              onChange={(e) => set({ featuredImage: e.target.value })}
            />
          </Labelled>

          <Labelled id="post-excerpt" label={labels.excerpt}>
            <textarea
              id="post-excerpt"
              rows={3}
              className={cn(field, 'py-2')}
              value={draft.excerpt}
              onChange={(e) => set({ excerpt: e.target.value })}
            />
          </Labelled>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
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
              {labels.save}
            </button>
          </div>
        </form>
      </Card>
    </Overlay>
  )
}

function ConfirmDialog({
  title,
  body,
  subject,
  confirmLabel,
  cancelLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string
  body: string
  subject: string
  confirmLabel: string
  cancelLabel: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Overlay onClose={onCancel}>
      <Card
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md p-6"
      >
        <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">{title}</h2>
        <p className="mt-2 font-medium text-text-primary">{subject}</p>
        <p className="mt-2 text-[length:var(--type-sm)] text-text-secondary">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-semibold text-text-secondary hover:bg-surface-sunken"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
            className="min-h-11 rounded-lg bg-red-600 px-5 text-[length:var(--type-sm)] font-semibold text-neutral-0 hover:bg-red-500 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </Card>
    </Overlay>
  )
}

function Labelled({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[length:var(--type-xs)] text-text-muted">{hint}</p>}
    </div>
  )
}
