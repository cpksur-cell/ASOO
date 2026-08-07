import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { isMockAuthEnabled } from '@/lib/auth/mock'
import { CadastralPlan } from '@/components/ui/cadastral-plan'
import { LoginForm, type LoginLabels } from './login-form'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('nav.login'),
    // Sign-in is not an indexable surface. docs/08-security.md §8.
    robots: { index: false, follow: false },
  }
}

/**
 * Only same-origin relative paths are accepted as a post-login destination.
 * Anything else — a protocol-relative `//evil.com`, an absolute URL, a
 * backslash trick — falls back to the locale home. An open redirect on a
 * government login page is a phishing primitive.
 */
function safeRedirect(next: string | undefined, locale: Locale): string {
  if (!next) return href(locale)
  if (!next.startsWith('/')) return href(locale)
  if (next.startsWith('//') || next.startsWith('/\\')) return href(locale)
  return next
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  const { next } = await searchParams
  const t = createTranslator(getDictionary(typed))

  const labels: LoginLabels = {
    title: t('auth.loginTitle'),
    intro: t('auth.loginIntro'),
    methodEmail: t('auth.methodEmail'),
    methodPhone: t('auth.methodPhone'),
    emailLabel: t('auth.emailLabel'),
    phoneLabel: t('auth.phoneLabel'),
    phoneHint: t('auth.phoneHint'),
    otpLabel: t('auth.otpLabel'),
    otpPlaceholder: t('auth.otpPlaceholder'),
    sendOtp: t('auth.sendOtp'),
    sending: t('auth.sending'),
    verify: t('auth.verify'),
    verifying: t('auth.verifying'),
    changeContact: t('auth.changeContact'),
    otpInvalid: t('auth.otpInvalid'),
    failed: t('auth.failed'),
    devNotice: t('auth.devNotice'),
    devOtpHint: t('auth.devOtpHint'),
  }

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-surface-sunken py-16">
      <CadastralPlan className="opacity-40" />
      <div
        className="pointer-events-none absolute -top-40 end-[-10rem] size-[30rem] rounded-full bg-accent-100 opacity-30 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md px-4">
        <LoginForm
          labels={labels}
          mockEnabled={isMockAuthEnabled()}
          redirectTo={safeRedirect(next, typed)}
        />
      </div>
    </div>
  )
}
