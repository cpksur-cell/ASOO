/**
 * Payment provider contract — see docs/07-payments.md.
 *
 * The portal is provider-agnostic: the invoice is the source of truth and the
 * provider reference hangs off it, never the other way round. A concrete
 * provider (mock for dev, eFAWATEERcom for production) implements this
 * interface; nothing else in the app knows which one is active.
 *
 * NON-NEGOTIABLES enforced by every implementation (CLAUDE.md §7, §10):
 *   - Money is integer FILS. Never a float.
 *   - The server NEVER trusts a client-supplied amount — it is recomputed from
 *     the invoice before createBill is called.
 *   - Webhooks verify the provider signature BEFORE parsing and are idempotent
 *     on the provider event id.
 *   - Provider credentials live in Secret Manager / env, never in the client.
 */

export type ProviderId = 'mock' | 'efawateercom'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired'

export interface CreateBillInput {
  /** Internal invoice id — the source of truth for the amount. */
  invoiceId: string
  /** Amount in integer fils, recomputed server-side from the invoice. */
  amountFils: number
  /** ISO 4217 — always 'JOD' for this syndicate. */
  currency: 'JOD'
  /** Short human label shown to the payer. */
  description: string
  /** Optional payer contact for the provider's notifications. */
  payerName?: string
  payerEmail?: string
}

export interface CreateBillResult {
  providerRef: string
  /** eFAWATEERcom bill number the payer can settle from any channel. */
  billNumber?: string
  /** Hosted-page redirect, when the provider uses one. */
  redirectUrl?: string
}

export interface VerifiedEvent {
  /** Idempotency key — the provider's unique event id. */
  eventId: string
  providerRef: string
  status: PaymentStatus
  amountFils: number
  paidAt?: string
}

export interface RefundResult {
  ok: boolean
  providerRef?: string
}

export interface PaymentProvider {
  readonly id: ProviderId
  /** False until real credentials + (for eFAWATEERcom) biller onboarding exist. */
  readonly isLive: boolean

  createBill(input: CreateBillInput): Promise<CreateBillResult>
  getStatus(providerRef: string): Promise<PaymentStatus>
  /** Verifies the signature FIRST, then returns the parsed event. Throws on bad signature. */
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<VerifiedEvent>
  refund(paymentId: string, amountFils: number): Promise<RefundResult>
}

/** Thrown by a provider that is wired but not yet activated (no credentials). */
export class ProviderNotConfiguredError extends Error {
  constructor(providerId: ProviderId, detail: string) {
    super(`Payment provider "${providerId}" is not configured: ${detail}`)
    this.name = 'ProviderNotConfiguredError'
  }
}
