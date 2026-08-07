'use server'

import { z } from 'zod'

import { assertPermission, AuthError } from '@/lib/auth/server'
import { withAudit } from '@/lib/audit'
import { getMemberInvoice } from '@/lib/data/member'
import { invoiceTotalFils } from '@/lib/data/member-demo'

/**
 * Initiate a payment against an invoice.
 *
 * The rule that matters, from docs/07-payments.md #2: the SERVER recomputes
 * the amount from the invoice. The client sends only the invoice id — any
 * amount arriving from the browser would be untrusted noise, so none is
 * accepted. There is no code path here where a client number becomes a charge.
 *
 * PHASE 2 SCAFFOLD. This returns a simulated `pending` outcome via the mock
 * provider model. Phase 3/5 replaces the body with
 * `provider.createBill(invoice)` and a persisted `payment_attempt` row; the
 * webhook — never this action — is what marks the invoice paid.
 */

const schema = z.object({ invoiceId: z.string().min(1) })

export type PaymentResult =
  | { ok: true; state: 'pending'; amountFils: number }
  | { ok: false; error: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'INVALID' | 'NOT_FOUND' | 'NOT_PAYABLE' }

export async function initiatePaymentAction(input: unknown): Promise<PaymentResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }

  try {
    const session = await assertPermission('payments', 'pay')

    const invoice = getMemberInvoice(session.uid, parsed.data.invoiceId)
    if (!invoice) return { ok: false, error: 'NOT_FOUND' }

    const payable =
      invoice.status === 'overdue' ||
      invoice.status === 'issued' ||
      invoice.status === 'partially_paid'
    if (!payable) return { ok: false, error: 'NOT_PAYABLE' }

    // Authoritative amount — recomputed here, ignoring anything the client said.
    const amountFils = invoiceTotalFils(invoice) - invoice.paidFils

    // A payment ATTEMPT is a recordable event even before settlement.
    await withAudit(
      {
        action: 'payment.attempt',
        entityType: 'invoice',
        entityId: invoice.id,
      },
      async () => ({ amountFils, provider: 'mock' }),
    )

    return { ok: true, state: 'pending', amountFils }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.code }
    throw err
  }
}
