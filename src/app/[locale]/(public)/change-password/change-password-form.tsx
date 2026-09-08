'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'

import { changePasswordAction, type ChangePasswordResult } from './actions'

export interface ChangePasswordLabels {
  title: string
  intro: string
  password: string
  confirm: string
  hint: string
  submit: string
  submitting: string
  mismatch: string
  tooShort: string
  sameAsOld: string
  failed: string
  signedOut: string
}

/**
 * Replace a provisioned password.
 *
 * No "current password" field: the member is already signed in, and asking
 * them to retype the shared initial password teaches exactly the wrong habit.
 * Supabase re-checks the session on the server before it accepts the change.
 */
export function ChangePasswordForm({
  labels,
  home,
}: {
  labels: ChangePasswordLabels
  home: string
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function message(result: Extract<ChangePasswordResult, { ok: false }>): string {
    const map: Record<string, string> = {
      INVALID: labels.mismatch,
      TOO_SHORT: labels.tooShort,
      SAME_AS_OLD: labels.sameAsOld,
      UNAUTHENTICATED: labels.signedOut,
    }
    return map[result.error] ?? labels.failed
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError(labels.mismatch)
      return
    }
    startTransition(async () => {
      const result = await changePasswordAction({ password, confirm })
      if (!result.ok) {
        setError(message(result))
        return
      }
      // A full navigation, not a client push: the gate lives in a server
      // layout, and only a fresh request re-reads the cleared flag.
      window.location.assign(home)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label
          htmlFor="new-password"
          className="block text-[length:var(--type-sm)] font-medium text-text-secondary"
        >
          {labels.password}
        </label>
        <input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="new-password-hint"
          className="mt-1.5 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-[length:var(--type-sm)] text-text-primary"
        />
        <p id="new-password-hint" className="mt-1 text-[length:var(--type-xs)] text-text-muted">
          {labels.hint}
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="block text-[length:var(--type-sm)] font-medium text-text-secondary"
        >
          {labels.confirm}
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-[length:var(--type-sm)] text-text-primary"
        />
      </div>

      {error && (
        <p role="alert" className="text-[length:var(--type-sm)] text-status-overdue-fg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-surface-accent px-4 py-2.5 text-[length:var(--type-sm)] font-semibold text-text-on-accent disabled:opacity-60"
      >
        <KeyRound className="size-4" aria-hidden />
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  )
}
