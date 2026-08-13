import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { defaultLocale, isLocale } from '@/i18n/config'

/**
 * OAuth callback — where Google returns the user.
 *
 * Supabase sends the browser here with a one-time `code`. Exchanging it for a
 * session is the only step that can set the auth cookies, so it happens in a
 * Route Handler (which may write cookies) rather than a Server Component
 * (which may not).
 *
 * NOT under `[locale]` on purpose: this URL is registered as a redirect target
 * in the Google console and the Supabase dashboard, and those lists are edited
 * by hand. One fixed, locale-free path is one thing to get right — the locale
 * travels in `next` and is applied when we land.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const localeParam = searchParams.get('locale')
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale

  /*
   * Open-redirect guard.
   *
   * `next` arrives in a URL the user can edit, and it is handed straight to a
   * redirect. Anything not a same-origin ABSOLUTE PATH is discarded. The
   * backslash and double-slash cases matter: `//evil.com` and `/\evil.com` are
   * both read as off-site by browsers.
   */
  const requested = searchParams.get('next') ?? ''
  const safeNext =
    requested.startsWith('/') && !requested.startsWith('//') && !requested.startsWith('/\\')
      ? requested
      : `/${locale}/dashboard`

  const failed = (reason: string) =>
    NextResponse.redirect(`${origin}/${locale}/login?error=${reason}`)

  if (!code) return failed('oauth_no_code')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return failed('oauth_unconfigured')

  // The response is created FIRST so the client can write session cookies
  // onto the very redirect that carries the user onward.
  const response = NextResponse.redirect(`${origin}${safeNext}`)

  const supabase = createServerClient(new URL(url).origin, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    // Deliberately vague to the user, specific in the log: an auth error
    // message can describe account state to someone who is not the owner.
    console.error('[auth] OAuth code exchange failed', error.message)
    return failed('oauth_failed')
  }

  /*
   * The `users` mirror row and the default `member` role are created by the
   * `handle_new_auth_user` trigger from migration 0008, which fires on INSERT
   * into auth.users. That covers Google sign-ups exactly as it covers email
   * ones — there is nothing to do here, and doing it here instead would leave
   * a gap for any account created by another route.
   */
  return response
}
