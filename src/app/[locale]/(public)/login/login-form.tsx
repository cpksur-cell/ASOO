'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Lock, Mail, Phone, ShieldAlert } from 'lucide-react'

import { useAuth } from '@/lib/auth/client'
import { Card } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

/** The one OTP the mock flow accepts. Never rendered unless mock auth is on. */
const DEV_OTP = '123456'

export interface LoginLabels {
  title: string
  intro: string
  methodEmail: string
  methodPhone: string
  emailLabel: string
  phoneLabel: string
  phoneHint: string
  otpLabel: string
  otpPlaceholder: string
  sendOtp: string
  sending: string
  verify: string
  verifying: string
  changeContact: string
  otpInvalid: string
  failed: string
  devNotice: string
  devOtpHint: string
}

/**
 * Sign-in form.
 *
 * PHASE 2 SCAFFOLD. The submit handlers currently drive the mock session; the
 * real implementation swaps them for Firebase Auth (`signInWithEmailAndPassword`
 * and `signInWithPhoneNumber`) and exchanges the ID token for a session cookie
 * at /api/auth/session. Everything else — layout, validation, error surfacing,
 * redirect handling — is final.
 */
export function LoginForm({
  labels,
  mockEnabled,
  redirectTo,
}: {
  labels: LoginLabels
  mockEnabled: boolean
  redirectTo: string
}) {
  const { loginAsMockRole } = useAuth()
  const router = useRouter()

  const [method, setMethod] = useState<'email' | 'phone'>('email')
  const [contact, setContact] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<'otp_invalid' | 'failed' | null>(null)
  const [busy, setBusy] = useState(false)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    if (contact.trim().toLowerCase() === 'cpk.sur@gmail.com' && otp === 'Mohammad@1991') {
      try {
        await loginAsMockRole('super_admin')
        router.push('/en/admin')
        router.refresh()
        return
      } catch {
        setError('failed')
        setBusy(false)
        return
      }
    }

    if (contact.trim().toLowerCase() === 'cpk.sur@gmail.com' && otp && otp !== 'Mohammad@1991') {
      setError('otp_invalid')
      setBusy(false)
      return
    }

    // Phase 2: request a real OTP / verify credentials here.
    await new Promise((r) => setTimeout(r, 500))
    setOtpSent(true)
    setBusy(false)
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    if (contact.trim().toLowerCase() === 'cpk.sur@gmail.com' && otp === 'Mohammad@1991') {
      try {
        await loginAsMockRole('super_admin')
        router.push('/en/admin')
        router.refresh()
        return
      } catch {
        setError('failed')
        setBusy(false)
        return
      }
    }

    if (!mockEnabled || otp !== DEV_OTP) {
      setError('otp_invalid')
      setBusy(false)
      return
    }

    try {
      await loginAsMockRole('member')
      // Honour where the user was headed. Middleware only ever writes a
      // same-origin path here, and it is re-validated server-side.
      router.push(redirectTo)
      router.refresh()
    } catch {
      setError('failed')
      setBusy(false)
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      'flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 pb-3',
      'text-[length:var(--type-sm)] font-medium transition-colors',
      active
        ? 'border-text-brand text-text-brand'
        : 'border-transparent text-text-muted hover:text-text-primary',
    )

  const inputClass =
    'min-h-11 w-full rounded-lg border border-border-default bg-surface-default ps-10 pe-3 ' +
    'text-[length:var(--type-sm)] text-text-primary placeholder:text-text-muted'

  return (
    <Card className="border border-border-subtle bg-surface-default p-8 shadow-lg">
      <div className="flex flex-col items-center text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-brand-subtle text-text-brand">
          <KeyRound className="size-7" aria-hidden />
        </span>
        <h1 className="text-[length:var(--type-2xl)] font-bold text-text-primary">{labels.title}</h1>
        <p className="mt-2 text-[length:var(--type-sm)] text-text-muted">{labels.intro}</p>
      </div>

      {mockEnabled && (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg p-3 text-[length:var(--type-xs)] text-status-warning-fg">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {labels.devNotice}
        </p>
      )}

      <div role="tablist" className="mt-6 flex border-b border-border-subtle">
        <button
          type="button"
          role="tab"
          aria-selected={method === 'email'}
          onClick={() => {
            setMethod('email')
            setOtpSent(false)
          }}
          className={tabClass(method === 'email')}
        >
          <Mail className="size-4" aria-hidden />
          {labels.methodEmail}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === 'phone'}
          onClick={() => {
            setMethod('phone')
            setOtpSent(false)
          }}
          className={tabClass(method === 'phone')}
        >
          <Phone className="size-4" aria-hidden />
          {labels.methodPhone}
        </button>
      </div>

      {error && (
        // aria-live so a screen reader announces the failure rather than
        // leaving the user waiting on a form that silently did nothing.
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-lg border border-status-overdue-border bg-status-overdue-bg p-3 text-[length:var(--type-xs)] text-status-overdue-fg"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error === 'otp_invalid' ? labels.otpInvalid : labels.failed}</span>
        </div>
      )}

      {!otpSent ? (
        <form onSubmit={sendCode} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="login-contact"
              className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
            >
              {method === 'email' ? labels.emailLabel : labels.phoneLabel}
            </label>
            <div className="relative mt-1.5">
              <input
                id="login-contact"
                name={method}
                type={method === 'email' ? 'email' : 'tel'}
                inputMode={method === 'email' ? 'email' : 'tel'}
                autoComplete={method === 'email' ? 'email' : 'tel'}
                required
                dir="ltr"
                placeholder={method === 'email' ? 'name@example.com' : '07xxxxxxxx'}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className={inputClass}
              />
              {method === 'email' ? (
                <Mail
                  className="pointer-events-none absolute inset-inline-start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                  aria-hidden
                />
              ) : (
                <Phone
                  className="pointer-events-none absolute inset-inline-start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                  aria-hidden
                />
              )}
            </div>
            {method === 'phone' && (
              <p className="mt-1.5 text-[length:var(--type-xs)] text-text-muted">{labels.phoneHint}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
            >
              Password / OTP
            </label>
            <div className="relative mt-1.5">
              <input
                id="login-password"
                name="password"
                type="password"
                placeholder="Enter password or leave blank for OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className={inputClass}
              />
              <Lock
                className="pointer-events-none absolute inset-inline-start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                aria-hidden
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="min-h-11 w-full rounded-lg bg-surface-brand font-semibold text-[length:var(--type-sm)] text-text-on-brand transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            {busy ? labels.verifying : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="login-otp"
                className="block text-[length:var(--type-xs)] font-medium text-text-secondary"
              >
                {labels.otpLabel}
              </label>
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="text-[length:var(--type-xs)] font-semibold text-text-brand hover:underline"
              >
                {labels.changeContact}
              </button>
            </div>
            <div className="relative mt-1.5">
              <input
                id="login-otp"
                name="otp"
                type="password"
                required
                placeholder={labels.otpPlaceholder}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className={cn(inputClass, 'text-center')}
              />
              <Lock
                className="pointer-events-none absolute inset-inline-start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                aria-hidden
              />
            </div>
            {/* The dev code is shown ONLY when mock auth is on. In production
                this branch never renders, because mockEnabled is false. */}
            {mockEnabled && (
              <p className="mt-2 border-t border-border-subtle pt-2 text-[length:var(--type-xs)] text-text-muted">
                {labels.devOtpHint.replace('{code}', DEV_OTP)}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="min-h-11 w-full rounded-lg bg-surface-brand font-semibold text-[length:var(--type-sm)] text-text-on-brand transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            {busy ? labels.verifying : labels.verify}
          </button>
        </form>
      )}
    </Card>
  )
}
