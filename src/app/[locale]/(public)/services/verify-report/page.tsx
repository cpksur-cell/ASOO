import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { QrCode } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Card, PageHeader } from '@/components/ui/primitives'

export function generateMetadata(): Metadata {
  return { robots: { index: true, follow: true } }
}

export default async function VerifyReportLanding({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  // A plain GET form — the code becomes the path segment, so the result is a
  // shareable, scannable URL. Same shape a QR scan lands on.
  async function goToCode(formData: FormData) {
    'use server'
    const code = String(formData.get('code') ?? '').trim()
    if (code) redirect(href(typed, `services/verify-report/${encodeURIComponent(code)}`))
  }

  return (
    <>
      <Breadcrumbs
        locale={typed}
        items={[
          { label: t('services.title'), path: 'services' },
          { label: t('reports.verifyTitle') },
        ]}
      />
      <PageHeader title={t('reports.verifyTitle')} intro={t('reports.verifyIntro')} />

      <div className="container-page py-12">
        <Card className="mx-auto max-w-md p-6">
          <div className="mb-5 flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-brand-subtle text-text-brand">
              <QrCode className="size-7" aria-hidden />
            </span>
          </div>
          <form action={goToCode} className="space-y-4">
            <div>
              <label
                htmlFor="verify-code"
                className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
              >
                {t('reports.verifyCodeLabel')}
              </label>
              <input
                id="verify-code"
                name="code"
                required
                dir="ltr"
                placeholder="ASOO-RPT-XXXX-XXXX-XXXX"
                className="mt-1.5 min-h-11 w-full rounded-lg border border-border-default bg-surface-default px-3 text-center font-mono text-[length:var(--type-sm)] text-text-primary"
              />
            </div>
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg bg-surface-brand font-semibold text-[length:var(--type-sm)] text-text-on-brand transition-colors hover:bg-primary-600"
            >
              {t('reports.verifySubmit')}
            </button>
          </form>
        </Card>
      </div>
    </>
  )
}
