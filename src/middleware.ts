import { NextResponse, type NextRequest } from 'next/server'

/**
 * Two jobs: locale negotiation, and route gating.
 *
 * Route gating here is LAYER 1 of the three in docs/08-security.md §3. It is
 * a cheap early rejection, not the real boundary — the server component
 * re-checks (layer 2) and Data Connect enforces row ownership (layer 3).
 * Middleware runs on the edge and cannot verify a Firebase session cookie
 * cryptographically, so it deliberately only asks "is there plausibly a
 * session?" and never "what may this person do?".
 *
 * Constants are duplicated from src/i18n/config.ts and src/lib/auth/mock.ts
 * because the edge runtime must not pull in the JSON dictionaries or
 * `server-only` modules.
 */

const LOCALES = ['ar', 'en'] as const
const DEFAULT_LOCALE = 'ar'
const LOCALE_COOKIE = 'asoo_locale'

const SESSION_COOKIE = '__session'
const MOCK_ROLE_COOKIE = 'asoo_mock_role'

/** Path segments that require a session. Checked after the locale prefix. */
const PROTECTED_SEGMENTS = ['admin', 'dashboard']

/**
 * ISO-3166 alpha-2 codes for the Arab League. A visitor geolocated to one of
 * these gets Arabic by default; everyone else gets English. The syndicate's
 * primary audience is in Jordan, so this makes the common case correct without
 * the visitor touching the language switch.
 */
const ARABIC_REGION = new Set([
  'JO', 'PS', 'SY', 'LB', 'IQ', 'SA', 'AE', 'QA', 'BH', 'KW', 'OM',
  'YE', 'EG', 'SD', 'LY', 'TN', 'DZ', 'MA', 'MR', 'SO', 'DJ', 'KM',
])

/**
 * Country from whichever geo header the hosting layer injects. Firebase App
 * Hosting does not add one by default, so the load balancer / CDN must be
 * configured to (see docs/02-architecture.md). When absent, negotiation falls
 * through to Accept-Language, then the default. `x-asoo-country` is a test
 * override honoured only in non-production.
 */
function geoCountry(request: NextRequest): string | null {
  const candidates = ['x-vercel-ip-country', 'cf-ipcountry', 'x-appengine-country']
  if (process.env.NODE_ENV !== 'production') candidates.unshift('x-asoo-country')
  for (const h of candidates) {
    const value = request.headers.get(h)
    if (value && value !== 'XX' && value !== 'ZZ') return value.toUpperCase()
  }
  return null
}

function negotiate(request: NextRequest): string {
  // 1. An explicit choice always wins — the visitor used the language switch.
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookie && (LOCALES as readonly string[]).includes(cookie)) return cookie

  // 2. Geolocation by IP. Arab-region → ar, elsewhere → en.
  const country = geoCountry(request)
  if (country) return ARABIC_REGION.has(country) ? 'ar' : 'en'

  // 3. Browser preference, when no geo signal is available.
  const header = request.headers.get('accept-language')
  if (header) {
    const ranked = header
      .split(',')
      .map((part) => {
        const [tag = '', ...params] = part.trim().split(';')
        const q = params.find((p) => p.trim().startsWith('q='))
        return { tag: tag.toLowerCase(), q: q ? Number(q.split('=')[1]) : 1 }
      })
      .sort((a, b) => b.q - a.q)

    for (const { tag } of ranked) {
      const base = tag.split('-')[0]
      if (base && (LOCALES as readonly string[]).includes(base)) return base
    }
  }

  // 4. Fall back to the syndicate's primary locale.
  return DEFAULT_LOCALE
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const locale = LOCALES.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  )

  if (!locale) {
    const negotiated = negotiate(request)
    const url = request.nextUrl.clone()
    url.pathname = `/${negotiated}${pathname === '/' ? '' : pathname}`
    // 307, not 301 — the target depends on request headers, so it must never
    // be cached as a permanent mapping. Legacy prototype paths get real 301s
    // in next.config.ts instead.
    return NextResponse.redirect(url, 307)
  }

  const rest = pathname.slice(`/${locale}`.length).replace(/^\//, '')
  const segment = rest.split('/')[0] ?? ''

  if (PROTECTED_SEGMENTS.includes(segment)) {
    const hasSession =
      Boolean(request.cookies.get(SESSION_COOKIE)?.value) ||
      Boolean(request.cookies.get(MOCK_ROLE_COOKIE)?.value)

    if (!hasSession) {
      const url = request.nextUrl.clone()
      url.pathname = `/${locale}/login`
      // Round-trip the destination so login can return the user where they
      // were headed. Relative-only, so it cannot be used as an open redirect.
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url, 307)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Everything except: api, _next/static, _next/image, and any path with a
     * file extension (favicon.ico, robots.txt, sitemap.xml, images, fonts).
     */
    '/((?!api|_next/static|_next/image|.*\\..*).*)',
  ],
}
