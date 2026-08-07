'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, Eye, EyeOff, Pencil, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Card, StatusBadge } from '@/components/ui/primitives'
import type { StoredBlock } from '@/lib/data/store'
import {
  reorderBlockAction,
  setBlockPublishedAction,
  updateBlockTextAction,
  type ActionResult,
} from '../actions'

export interface ComposerLabels {
  title: string
  intro: string
  demoNotice: string
  blocks: string
  moveUp: string
  moveDown: string
  edit: string
  save: string
  cancel: string
  close: string
  show: string
  hide: string
  visible: string
  hidden: string
  heading: string
  body: string
  saved: string
  saveFailed: string
  noPermission: string
  invalidInput: string
  empty: string
}

export function HomepageComposer({
  labels,
  initialBlocks,
}: {
  labels: ComposerLabels
  initialBlocks: StoredBlock[]
}) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [editing, setEditing] = useState<StoredBlock | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function report(result: Extract<ActionResult<unknown>, { ok: false }>) {
    setNotice({
      tone: 'bad',
      text:
        result.error === 'UNAUTHORIZED' || result.error === 'UNAUTHENTICATED'
          ? labels.noPermission
          : result.error === 'INVALID'
            ? labels.invalidInput
            : labels.saveFailed,
    })
  }

  function move(block: StoredBlock, direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await reorderBlockAction({ id: block.id, direction })
      if (!result.ok) return report(result)
      setBlocks((prev) => {
        const next = [...prev]
        const i = next.findIndex((b) => b.id === block.id)
        const j = direction === 'up' ? i - 1 : i + 1
        if (i === -1 || j < 0 || j >= next.length) return prev
        ;[next[i], next[j]] = [next[j]!, next[i]!]
        return next
      })
      setNotice({ tone: 'ok', text: labels.saved })
    })
  }

  function toggle(block: StoredBlock) {
    startTransition(async () => {
      const isPublished = !block.isPublished
      const result = await setBlockPublishedAction({ id: block.id, isPublished })
      if (!result.ok) return report(result)
      setBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, isPublished } : b)),
      )
      setNotice({ tone: 'ok', text: labels.saved })
    })
  }

  function saveText(block: StoredBlock, text: Record<string, unknown>) {
    startTransition(async () => {
      const result = await updateBlockTextAction({ id: block.id, text })
      if (!result.ok) return report(result)
      setBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, text: { ...b.text, ...text } } : b)),
      )
      setEditing(null)
      setNotice({ tone: 'ok', text: labels.saved })
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

      <h2 className="text-[length:var(--type-lg)] font-semibold text-text-primary">
        {labels.blocks}
      </h2>

      {blocks.length === 0 ? (
        <Card className="p-10 text-center text-text-muted">{labels.empty}</Card>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block, i) => (
            <li key={block.id}>
              <Card className="flex flex-wrap items-center gap-3 p-4">
                {/* Reorder controls carry the block name in their accessible
                    label — "Move up" alone is meaningless in a list of 8. */}
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={i === 0 || pending}
                    onClick={() => move(block, 'up')}
                    aria-label={`${labels.moveUp}: ${block.type}`}
                    className="inline-flex size-8 items-center justify-center rounded text-text-primary hover:bg-surface-sunken disabled:opacity-30"
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={i === blocks.length - 1 || pending}
                    onClick={() => move(block, 'down')}
                    aria-label={`${labels.moveDown}: ${block.type}`}
                    className="inline-flex size-8 items-center justify-center rounded text-text-primary hover:bg-surface-sunken disabled:opacity-30"
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[length:var(--type-xs)] text-text-muted">
                    {block.type} · {block.region}
                  </p>
                  <p className="mt-0.5 truncate font-medium text-text-primary">
                    {String(block.text.heading ?? block.text.badgeText ?? block.type)}
                  </p>
                </div>

                <StatusBadge
                  tone={block.isPublished ? 'active' : 'neutral'}
                  icon={block.isPublished ? <Eye /> : <EyeOff />}
                >
                  {block.isPublished ? labels.visible : labels.hidden}
                </StatusBadge>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggle(block)}
                    aria-label={`${block.isPublished ? labels.hide : labels.show}: ${block.type}`}
                    className="inline-flex size-11 items-center justify-center rounded text-text-secondary hover:bg-surface-sunken"
                  >
                    {block.isPublished ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setEditing(block)}
                    aria-label={`${labels.edit}: ${block.type}`}
                    className="inline-flex size-11 items-center justify-center rounded text-text-brand hover:bg-surface-sunken"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <BlockTextDialog
          labels={labels}
          block={editing}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={saveText}
        />
      )}
    </div>
  )
}

function BlockTextDialog({
  labels,
  block,
  pending,
  onCancel,
  onSave,
}: {
  labels: ComposerLabels
  block: StoredBlock
  pending: boolean
  onCancel: () => void
  onSave: (block: StoredBlock, text: Record<string, unknown>) => void
}) {
  const [heading, setHeading] = useState(String(block.text.heading ?? ''))
  const [body, setBody] = useState(String(block.text.body ?? ''))

  const field =
    'w-full rounded-lg border border-border-default bg-surface-default px-3 py-2.5 ' +
    'text-[length:var(--type-sm)] text-text-primary'

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-primary-950/60 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={labels.edit}
        className="relative z-10 w-full max-w-lg p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[length:var(--type-xl)] font-semibold text-text-primary">
              {labels.edit}
            </h2>
            <p className="mt-1 font-mono text-[length:var(--type-xs)] text-text-muted">
              {block.type} · {block.region}
            </p>
          </div>
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
            onSave(block, { heading, body })
          }}
        >
          <div>
            <label
              htmlFor="block-heading"
              className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
            >
              {labels.heading}
            </label>
            <input
              id="block-heading"
              className={cn(field, 'mt-1.5 min-h-11')}
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="block-body"
              className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
            >
              {labels.body}
            </label>
            <textarea
              id="block-body"
              rows={4}
              className={cn(field, 'mt-1.5')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

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
    </div>
  )
}
