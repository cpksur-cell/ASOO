'use client'

import { useState } from 'react'

import { createClient } from '@/lib/supabase/browser'
import type { Locale } from '@/i18n/client'

/**
 * The Google mark.
 *
 * Inlined as SVG rather than pulled from an icon set: Google's brand
 * guidelines require their own four-colour glyph, unmodified, and a
 * recoloured Lucide stand-in would be both wrong and non-compliant. The
 * colours are Google's brand values, which is why they are literal hex here
 * and exempt from CLAUDE.md §6 — they are not ours to tokenise.
 */
function GoogleMark() {
  return (
    /* eslint-disable no-restricted-syntax -- Google brand colours; see above. */
    <svg viewBox="0 0 18 18" className="size-[18px] shrink-0" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
    /* eslint-enable no-restricted-syntax */
  )
}

/**
 * "Continue with Google".
 *
 * The whole exchange happens off our origin: Supabase redirects to Google,
 * Google returns to /auth/callback with a one-time code, and that route trades
 * it for a session cookie. This button never sees a credential — which is the
 * point of using OAuth rather than asking for a password.
 */
export function GoogleSignIn({
  locale,
  redirectTo,
  label,
  busyLabel,
  errorLabel,
}: {
  locale: Locale
  /** Where to land after a successful sign-in. Path only. */
  redirectTo: string
  label: string
  busyLabel: string
  errorLabel: string
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function start() {
    setBusy(true)
    setFailed(false)
    try {
      const supabase = createClient()
      const next = redirectTo.startsWith('/') && !redirectTo.startsWith('//')
        ? redirectTo
        : `/${locale}/dashboard`

      const callback = new URL('/auth/callback', window.location.origin)
      callback.searchParams.set('next', next)
      callback.searchParams.set('locale', locale)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callback.toString(),
          // Ask for a refresh token and let the user pick an account rather
          // than silently reusing whichever Google session the browser holds —
          // shared machines are common and a surprise identity is a real
          // problem when the account can file official requests.
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      })
      if (error) throw error
      // On success the browser is navigating away; leave the button busy.
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        aria-busy={busy}
        className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-border-default bg-surface-default px-4 text-[length:var(--type-sm)] font-semibold text-text-primary transition-colors hover:bg-surface-sunken disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? busyLabel : label}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-[length:var(--type-xs)] text-status-overdue-fg">
          {errorLabel}
        </p>
      )}
    </div>
  )
}
