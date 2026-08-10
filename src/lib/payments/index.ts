import 'server-only'

import { EfawateercomProvider } from './efawateercom'
import { MockProvider } from './mock'
import type { PaymentProvider, ProviderId } from './provider'

export type { PaymentProvider, ProviderId } from './provider'
export { ProviderNotConfiguredError } from './provider'
export { EFAWATEERCOM_PUBLIC_URL } from './efawateercom'

/**
 * Resolve the active payment provider from the PAYMENT_PROVIDER env var.
 * Defaults to the mock provider so no environment can accidentally attempt a
 * real charge without being told to. eFAWATEERcom is selected in production but
 * only actually transacts once its credentials exist (see EfawateercomProvider).
 */
export function getPaymentProvider(): PaymentProvider {
  const id = (process.env.PAYMENT_PROVIDER as ProviderId | undefined) ?? 'mock'
  switch (id) {
    case 'efawateercom':
      return new EfawateercomProvider()
    case 'mock':
    default:
      return new MockProvider()
  }
}
