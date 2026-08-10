import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Building2, Clock, CreditCard, Info, ListChecks, Receipt, ShieldCheck } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { EFAWATEERCOM_PUBLIC_URL } from '@/lib/payments'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Card, PageHeader } from '@/components/ui/primitives'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import { ButtonLink } from '@/components/ui/button'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('pay.title'),
    description: t('pay.intro'),
    alternates: {
      canonical: href(locale, 'services/pay'),
      languages: {
        'ar-JO': '/ar/services/pay',
        en: '/en/services/pay',
        'x-default': '/ar/services/pay',
      },
    },
  }
}

export default async function PayPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  const steps = [t('pay.step1'), t('pay.step2'), t('pay.step3'), t('pay.step4')]

  return (
    <>
      <Breadcrumbs
        locale={typed}
        items={[{ label: t('services.title'), path: 'services' }, { label: t('pay.title') }]}
      />
      <PageHeader title={t('pay.title')} intro={t('pay.intro')} />

      <div className="container-page py-12">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* eFAWATEERcom rail — the primary way to pay today. */}
          <Reveal>
            <Card className="flex h-full flex-col p-6 md:p-8">
              <span className="flex size-12 items-center justify-center rounded-lg bg-surface-brand-subtle text-text-brand">
                <CreditCard className="size-6" aria-hidden strokeWidth={1.75} />
              </span>
              <h2 className="mt-5 text-[length:var(--type-xl)] font-semibold text-text-primary">
                {t('pay.efawateercomTitle')}
              </h2>
              <p className="mt-3 leading-[var(--leading-body)] text-text-secondary">
                {t('pay.efawateercomBody')}
              </p>

              <div className="mt-5 flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-4">
                <Building2 className="mt-0.5 size-5 shrink-0 text-text-brand" aria-hidden />
                <div>
                  <p className="text-[length:var(--type-xs)] text-text-muted">
                    {t('pay.billerLabel')}
                  </p>
                  <p className="mt-0.5 font-semibold text-text-primary">{t('pay.billerName')}</p>
                </div>
              </div>

              <h3 className="mt-6 inline-flex items-center gap-2 text-[length:var(--type-sm)] font-semibold text-text-primary">
                <ListChecks className="size-4 text-text-brand" aria-hidden />
                {t('pay.stepsTitle')}
              </h3>
              <ol className="mt-3 list-decimal space-y-2 ps-5 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary marker:text-text-muted marker:[font-feature-settings:'tnum']">
                {steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>

              <div className="mt-7">
                <ButtonLink href={EFAWATEERCOM_PUBLIC_URL} variant="primary" external>
                  {t('pay.openButton')}
                </ButtonLink>
              </div>
              <p className="mt-4 text-[length:var(--type-xs)] text-text-muted">
                {t('pay.referenceNote')}
              </p>
            </Card>
          </Reveal>

          {/* What you'll need */}
          <RevealGroup className="flex flex-col gap-6">
            <RevealItem>
              <Card className="p-6">
                <h2 className="text-[length:var(--type-base)] font-semibold text-text-primary">
                  {t('pay.needTitle')}
                </h2>
                <ul className="mt-4 space-y-3 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-text-brand" aria-hidden />
                    {t('pay.need1')}
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-text-brand" aria-hidden />
                    {t('pay.need2')}
                  </li>
                </ul>
              </Card>
            </RevealItem>

            {/* Honest status: in-portal instant pay is gated on biller onboarding. */}
            <RevealItem>
              <Card className="border-status-pending-border bg-status-pending-bg p-6">
                <h2 className="inline-flex items-center gap-2 text-[length:var(--type-base)] font-semibold text-status-pending-fg">
                  <Info className="size-5" aria-hidden />
                  {t('pay.onboardingTitle')}
                </h2>
                <p className="mt-3 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
                  {t('pay.onboardingBody')}
                </p>
              </Card>
            </RevealItem>
          </RevealGroup>
        </div>

        <Reveal className="mt-10">
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-4 border-dashed p-6">
            <Assurance icon={<ShieldCheck />}>{t('services.assuranceSecure')}</Assurance>
            <Assurance icon={<Receipt />}>{t('services.assuranceReceipt')}</Assurance>
            <Assurance icon={<Clock />}>{t('services.assuranceAlways')}</Assurance>
          </Card>
        </Reveal>
      </div>
    </>
  )
}

function Assurance({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[length:var(--type-sm)] text-text-secondary">
      <span className="text-text-accent [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  )
}
