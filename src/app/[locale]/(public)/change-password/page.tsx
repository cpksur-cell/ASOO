import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { createTranslator, getDictionary, isLocale } from '@/i18n/config'
import { href } from '@/lib/routes'
import { getUserSession } from '@/lib/auth/server'
import { ChangePasswordForm } from './change-password-form'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = createTranslator(getDictionary(locale))
  return {
    title: t('account.changePasswordTitle'),
    // Never indexable, same reasoning as the sign-in page (docs/08-security §8).
    robots: { index: false, follow: false },
  }
}

/**
 * Set a password of one's own.
 *
 * Sits in `(public)` rather than under `(member)` on purpose: the member group
 * is exactly what the gate redirects AWAY from while a change is pending, so
 * hosting the escape route inside it would loop.
 *
 * Reachable by anyone signed in, not only those who must change — a member who
 * simply wants a new password should not have to be locked out first.
 */
export default async function ChangePasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const session = await getUserSession()
  if (!session) redirect(href(locale, 'login'))

  const t = createTranslator(getDictionary(locale))

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-[length:var(--type-2xl)] font-bold text-text-primary">
        {t('account.changePasswordTitle')}
      </h1>
      <p className="mt-2 text-[length:var(--type-sm)] text-text-muted">
        {session.mustChangePassword
          ? t('account.changePasswordRequired')
          : t('account.changePasswordIntro')}
      </p>

      <div className="mt-6">
        <ChangePasswordForm
          home={href(locale, 'dashboard')}
          labels={{
            title: t('account.changePasswordTitle'),
            intro: t('account.changePasswordIntro'),
            password: t('account.newPassword'),
            confirm: t('account.confirmPassword'),
            hint: t('account.passwordHint'),
            submit: t('account.savePassword'),
            submitting: t('account.saving'),
            mismatch: t('account.passwordMismatch'),
            tooShort: t('account.passwordTooShort'),
            sameAsOld: t('account.passwordSameAsOld'),
            failed: t('account.passwordChangeFailed'),
            signedOut: t('account.signedOut'),
          }}
        />
      </div>
    </div>
  )
}
