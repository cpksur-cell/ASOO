/**
 * Non-localized site configuration.
 *
 * Anything with a translation lives in `src/messages/*.json`, not here — a
 * `fooAr`/`fooEn` pair in code is the pattern CLAUDE.md §9 forbids. The
 * address and working hours moved to `contact.addressValue` and
 * `contact.workingHoursValue` for that reason.
 *
 * CONTACT DETAILS ARE UNVERIFIED — the prototype's `065551234` follows a
 * placeholder pattern and no email was published anywhere. Confirm with the
 * syndicate before launch. See design/content-inventory.md.
 */

/**
 * Absolute site origin, used for canonical URLs, hreflang, Open Graph, JSON-LD,
 * the sitemap, and robots. It MUST be the real production origin in production —
 * a localhost value here silently poisons every canonical and hreflang tag and
 * gets localhost indexed. So the default is the production domain, not
 * localhost: set NEXT_PUBLIC_SITE_URL to override (e.g. a preview deployment or
 * `http://localhost:3000` for local absolute-URL testing). Trailing slash is
 * stripped so `${siteUrl}/path` never doubles up.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.asoojo.com'
).replace(/\/+$/, '')

export const contact = {
  /** UNVERIFIED — placeholder from the prototype. */
  phone: '+962 6 555 1234',
  phoneHref: 'tel:+96265551234',
  /** UNVERIFIED — no email appears on the prototype. */
  email: 'info@asoo.jo',
} as const

/** The official DLS registry — linked from the directory's empty state. */
export const dlsRegistryUrl =
  'https://tracking.dls.gov.jo:8443/ords/r/dlsinfo/dls-information/surveyors'

export const dlsLegislationUrl =
  'https://www.dls.gov.jo/AR/List/%D8%AA%D8%B4%D8%B1%D9%8A%D8%B9%D8%A7%D8%AA__%D8%B0%D8%A7%D8%AA_%D8%B9%D9%84%D8%A7%D9%82%D8%A9'
