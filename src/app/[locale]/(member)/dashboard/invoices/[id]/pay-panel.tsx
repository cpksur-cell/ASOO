'use client'

import { useState, useTransition } from 'react'
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react'

import { Card } from '@/components/ui/primitives'
import { initiatePaymentAction } from './actions'

interface PayLabels {
  payNow: string
  payTitle: string
  confirm: string
  proceed: string
  cancel: string
  pending: string
  pendingNote: string
}

/**
 * Payment initiation.
 *
 * Two deliberate choices, both from docs/06-ux-flows.md §1:
 *   - Confirmation NAMES the amount and invoice, never "Are you sure?".
 *   - The result is "pending", never "paid". A member returning from a
 *     provider has not necessarily paid; only the webhook confirms it. Telling
 *     someone they paid when they have not is worse than making them wait.
 */
export function PayPanel({
  invoiceId,
  invoiceNumber,
  amountLabel,
  labels,
}: {
  invoiceId: string
  invoiceNumber: string
  amountLabel: string
  labels: PayLabels
}) {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'pending'>('idle')
  const [pending, startTransition] = useTransition()

  // invoiceNumber/amountLabel are already interpolated into labels.confirm on
  // the server; kept as props for the eventual real receipt flow.
  void invoiceNumber
  void amountLabel

  function proceed() {
    startTransition(async () => {
      const result = await initiatePaymentAction({ invoiceId })
      if (result.ok) setPhase('pending')
      else setPhase('idle')
    })
  }

  if (phase === 'pending') {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-text-brand" aria-hidden />
          <p className="font-semibold text-text-primary" role="status">
            {labels.pending}
          </p>
        </div>
        <p className="mt-3 text-[length:var(--type-sm)] leading-relaxed text-text-secondary">
          {labels.pendingNote}
        </p>
      </Card>
    )
  }

  if (phase === 'confirm') {
    return (
      <Card className="p-6">
        <h3 className="text-[length:var(--type-base)] font-semibold text-text-primary">
          {labels.payTitle}
        </h3>
        <p className="mt-2 text-[length:var(--type-sm)] leading-relaxed text-text-secondary">
          {labels.confirm}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={proceed}
            disabled={pending}
            aria-busy={pending}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-accent px-4 text-[length:var(--type-sm)] font-semibold text-text-on-accent transition-colors hover:bg-accent-300 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ShieldCheck className="size-4" aria-hidden />
            )}
            {labels.proceed}
          </button>
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="min-h-11 rounded-lg border border-border-default px-4 text-[length:var(--type-sm)] font-semibold text-text-secondary hover:bg-surface-sunken"
          >
            {labels.cancel}
          </button>
        </div>
      </Card>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPhase('confirm')}
      className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-lg bg-surface-accent px-5 text-[length:var(--type-base)] font-bold text-text-on-accent shadow-sm transition-colors hover:bg-accent-300"
    >
      <CreditCard className="size-5" aria-hidden />
      {labels.payNow}
    </button>
  )
}
