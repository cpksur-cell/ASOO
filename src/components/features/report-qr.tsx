import QRCode from 'qrcode'

import { siteUrl } from '@/lib/site'

/**
 * Server-rendered QR code for a report approval.
 *
 * The QR encodes the full public verification URL, so any phone camera resolves
 * it without an app. Generated server-side as inline SVG — no external image,
 * no client JS, CSP-clean. Self-contained by design.
 */
export async function ReportQR({
  code,
  locale,
  size = 160,
  className,
}: {
  code: string
  locale: 'ar' | 'en'
  size?: number
  className?: string
}) {
  const url = `${siteUrl}/${locale}/services/verify-report/${code}`
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    // A QR must be dark-on-light in BOTH themes for a camera to read it, so
    // these are deliberate literals, not themeable tokens — the design token
    // rule does not apply to a machine-scannable code.
    // eslint-disable-next-line no-restricted-syntax
    color: { dark: '#081824', light: '#FFFFFF' },
    width: size,
  })

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      // The SVG is produced by the qrcode library from a URL we control — no
      // user input reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
