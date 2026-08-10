import 'server-only'

import {
  type CreateBillInput,
  type CreateBillResult,
  type PaymentProvider,
  type PaymentStatus,
  ProviderNotConfiguredError,
  type RefundResult,
  type VerifiedEvent,
} from './provider'

/**
 * eFAWATEERcom (JoMoPay / MadfooatCom) provider — SCAFFOLD.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  Going live is a BANK-MEDIATED commercial process, not a self-serve API
 *  signup: the syndicate must be onboarded as a BILLER through its bank. Until
 *  that completes and the credentials below are provisioned in Secret Manager,
 *  `isLive` is false and every operation throws ProviderNotConfiguredError —
 *  the app must route payers to the public eFAWATEERcom channels instead of
 *  pretending to process a payment. See docs/07-payments.md.
 *
 *  Credentials (server-only, from Secret Manager / env — NEVER the client):
 *    EFAWATEERCOM_BILLER_ID       the syndicate's assigned biller code
 *    EFAWATEERCOM_API_BASE        JoMoPay endpoint (sandbox vs production)
 *    EFAWATEERCOM_TERMINAL_ID     terminal / service credentials
 *    EFAWATEERCOM_SECRET          webhook signing / API secret
 * ─────────────────────────────────────────────────────────────────────────
 */

/** The public eFAWATEERcom portal payers use to settle a bill directly. */
export const EFAWATEERCOM_PUBLIC_URL = 'https://efawateercom.jo'

function readConfig() {
  const billerId = process.env.EFAWATEERCOM_BILLER_ID
  const apiBase = process.env.EFAWATEERCOM_API_BASE
  const secret = process.env.EFAWATEERCOM_SECRET
  return { billerId, apiBase, secret }
}

export class EfawateercomProvider implements PaymentProvider {
  readonly id = 'efawateercom' as const

  get isLive(): boolean {
    const { billerId, apiBase, secret } = readConfig()
    return Boolean(billerId && apiBase && secret)
  }

  private ensureLive(): void {
    if (!this.isLive) {
      throw new ProviderNotConfiguredError(
        'efawateercom',
        'awaiting biller onboarding through the bank and credentials in Secret Manager',
      )
    }
  }

  async createBill(_input: CreateBillInput): Promise<CreateBillResult> {
    this.ensureLive()
    // TODO(onboarding): call JoMoPay BillInquiry/GenerateBill with the biller id,
    // returning the eFAWATEERcom bill number for the payer to settle.
    throw new ProviderNotConfiguredError('efawateercom', 'createBill not implemented until go-live')
  }

  async getStatus(_providerRef: string): Promise<PaymentStatus> {
    this.ensureLive()
    throw new ProviderNotConfiguredError('efawateercom', 'getStatus not implemented until go-live')
  }

  async verifyWebhook(
    _rawBody: string,
    _headers: Record<string, string>,
  ): Promise<VerifiedEvent> {
    this.ensureLive()
    // TODO(onboarding): verify the MadfooatCom signature BEFORE parsing, then
    // map the settlement notification onto VerifiedEvent (idempotent on eventId).
    throw new ProviderNotConfiguredError('efawateercom', 'verifyWebhook not implemented until go-live')
  }

  async refund(_paymentId: string, _amountFils: number): Promise<RefundResult> {
    this.ensureLive()
    throw new ProviderNotConfiguredError('efawateercom', 'refund not implemented until go-live')
  }
}
