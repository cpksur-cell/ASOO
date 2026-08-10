import 'server-only'

import {
  type CreateBillInput,
  type CreateBillResult,
  type PaymentProvider,
  type PaymentStatus,
  type RefundResult,
  type VerifiedEvent,
} from './provider'

/**
 * Deterministic mock provider for local/dev and the emulator suite. It never
 * touches a network and produces stable, testable outcomes. Selected when
 * PAYMENT_PROVIDER is unset or 'mock'. See docs/07-payments.md.
 */
export class MockProvider implements PaymentProvider {
  readonly id = 'mock' as const
  readonly isLive = false

  async createBill(input: CreateBillInput): Promise<CreateBillResult> {
    const providerRef = `mock_${input.invoiceId}`
    return { providerRef, billNumber: `MOCK-${input.invoiceId}` }
  }

  async getStatus(_providerRef: string): Promise<PaymentStatus> {
    return 'pending'
  }

  async verifyWebhook(rawBody: string): Promise<VerifiedEvent> {
    const body = JSON.parse(rawBody) as Partial<VerifiedEvent>
    return {
      eventId: body.eventId ?? `mock_evt_${Date.now()}`,
      providerRef: body.providerRef ?? 'mock_ref',
      status: body.status ?? 'paid',
      amountFils: body.amountFils ?? 0,
      paidAt: body.paidAt ?? new Date().toISOString(),
    }
  }

  async refund(): Promise<RefundResult> {
    return { ok: true, providerRef: 'mock_refund' }
  }
}
