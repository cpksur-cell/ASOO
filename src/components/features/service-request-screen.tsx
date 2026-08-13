import Link from 'next/link'
import { FileSearch, LockKeyhole, Map, ScrollText } from 'lucide-react'

import { createTranslator, getDictionary, type Locale } from '@/i18n/config'
import { can, getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { serviceRequestKey, type ServiceRequestType } from '@/lib/service-requests'
import { SERVICE_REQUEST_SLUGS } from '@/lib/service-requests'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Card, PageHeader } from '@/components/ui/primitives'
import { Reveal } from '@/components/ui/reveal'
import { ServiceRequestForm } from './service-request-form'

const ICONS: Record<ServiceRequestType, typeof Map> = {
  electronic_plate: Map,
  change_statement: ScrollText,
}

/**
 * The shared screen behind both counter e-services.
 *
 * The two services differ only in their copy and their type, so they share one
 * screen rather than two near-identical pages that drift apart. Each route is
 * still its own URL and its own metadata — good for both search and for a
 * member being sent a direct link.
 */
export async function ServiceRequestScreen({
  locale,
  type,
}: {
  locale: Locale
  type: ServiceRequestType
}) {
  const t = createTranslator(getDictionary(locale))
  const Icon = ICONS[type]

  const title = t(serviceRequestKey(type, 'Title'))
  const intro = t(serviceRequestKey(type, 'Intro'))
  const what = t(serviceRequestKey(type, 'What'))

  /*
   * The request must carry an identifiable requester: the answer is a citizen's
   * land data, and it is handed back to the person who asked, not to whoever
   * holds the link. So an anonymous visitor gets the explanation and a way in
   * rather than a form that would fail at the boundary anyway.
   */
  const session = await getUserSession()
  // Signed in is not the same as entitled: a member may request, a staff
  // account may not. Rendering the form to someone the action will refuse
  // wastes their typing and reads as a bug.
  const mayRequest = session ? await can('requests', 'submit') : false
  const selfPath = `services/${SERVICE_REQUEST_SLUGS[type]}`

  return (
    <>
      <Breadcrumbs
        locale={locale}
        items={[{ label: t('services.title'), path: 'services' }, { label: title }]}
      />
      <PageHeader title={title} intro={intro} />

      <div className="container-page py-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Reveal>
            <Card className="p-6 md:p-8">
              {mayRequest ? (
                <ServiceRequestForm
                  type={type}
                  trackHref={href(locale, 'dashboard/service-requests')}
                  labels={{
                    dlsKey: t('serviceRequests.dlsKey'),
                    dlsKeyHint: t('serviceRequests.dlsKeyHint'),
                    dlsKeyInvalid: t('serviceRequests.dlsKeyInvalid'),
                    note: t('serviceRequests.note'),
                    noteHint: t('serviceRequests.noteHint'),
                    submit: t('serviceRequests.submit'),
                    submitting: t('serviceRequests.submitting'),
                    submitFailed: t('serviceRequests.submitFailed'),
                    submitted: t('serviceRequests.submitted'),
                    submittedBody: t('serviceRequests.submittedBody'),
                    requestNumber: t('serviceRequests.requestNumber'),
                    trackRequest: t('serviceRequests.trackRequest'),
                    noPermission: t('serviceRequests.noPermission'),
                  }}
                />
              ) : (
                <div className="flex flex-col items-start gap-4">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-surface-brand-subtle text-text-brand">
                    <LockKeyhole className="size-5" aria-hidden />
                  </span>
                  <p className="text-[length:var(--type-base)] leading-[var(--leading-body)] text-text-secondary">
                    {session
                      ? t('serviceRequests.noPermission')
                      : t('serviceRequests.signInRequired')}
                  </p>
                  {!session && (
                    <Link
                      href={`${href(locale, 'login')}?next=${encodeURIComponent(href(locale, selfPath))}`}
                      className="inline-flex min-h-12 items-center rounded-lg bg-surface-brand px-6 text-[length:var(--type-sm)] font-semibold text-text-on-brand transition-colors hover:bg-primary-600"
                    >
                      {t('serviceRequests.signInCta')}
                    </Link>
                  )}
                </div>
              )}
            </Card>
          </Reveal>

          <Reveal>
            <Card className="p-6">
              <span className="flex size-11 items-center justify-center rounded-lg bg-surface-brand-subtle text-text-brand">
                <Icon className="size-5" aria-hidden strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 text-[length:var(--type-lg)] font-semibold text-text-primary">
                {t('serviceRequests.sectionTitle')}
              </h2>
              <div className="mt-3 h-[3px] w-10 rounded-full bg-surface-rule" aria-hidden />
              <p className="mt-4 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
                {what}
              </p>
              <p className="mt-4 flex items-start gap-2 border-t border-border-subtle pt-4 text-[length:var(--type-sm)] text-text-muted">
                <FileSearch className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('serviceRequests.sectionIntro')}
              </p>
            </Card>
          </Reveal>
        </div>
      </div>
    </>
  )
}
