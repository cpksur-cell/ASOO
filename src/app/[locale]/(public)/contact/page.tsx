import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { contact } from '@/lib/site'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Card, PageHeader } from '@/components/ui/primitives'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('contact.title'),
    alternates: {
      canonical: href(locale, 'contact'),
      languages: { 'ar-JO': '/ar/contact', en: '/en/contact' },
    },
  }
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  const items = [
    {
      icon: Phone,
      label: t('footer.phone'),
      value: contact.phone,
      href: contact.phoneHref,
      ltr: true,
    },
    {
      icon: Mail,
      label: t('footer.email'),
      value: contact.email,
      href: `mailto:${contact.email}`,
      ltr: true,
    },
    {
      icon: MapPin,
      label: t('footer.address'),
      value: t('contact.addressValue'),
      href: null,
      ltr: false,
    },
    {
      icon: Clock,
      label: t('contact.workingHours'),
      value: t('contact.workingHoursValue'),
      href: null,
      ltr: false,
    },
  ]

  return (
    <>
      <Breadcrumbs locale={typed} items={[{ label: t('contact.title') }]} />
      <PageHeader title={t('contact.title')} intro={t('contact.intro')} />

      <div className="container-page py-12">
        <RevealGroup as="ul" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <RevealItem key={item.label} as="li">
              <Card className="flex h-full items-start gap-4 p-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-brand-subtle text-text-brand">
                  <item.icon className="size-5" aria-hidden strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-[length:var(--type-sm)] text-text-muted">{item.label}</p>
                  <p className="mt-1 text-[length:var(--type-base)] font-medium text-text-primary">
                    {item.href ? (
                      <a href={item.href} className="text-text-brand hover:underline">
                        {item.ltr ? <span data-ltr>{item.value}</span> : item.value}
                      </a>
                    ) : item.ltr ? (
                      <span data-ltr>{item.value}</span>
                    ) : (
                      item.value
                    )}
                  </p>
                </div>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </>
  )
}
