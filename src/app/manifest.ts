import type { MetadataRoute } from 'next'

import { getDictionary } from '@/i18n/config'

/**
 * Web app manifest — mobile installability, tab/theme colour, and one more
 * entity signal for search engines. Arabic-first, matching the site default.
 * The theme colour is the design system's brand primary (surface-brand,
 * #143751); Next serves this at /manifest.webmanifest and links it in <head>.
 *
 * This route has no locale param (it is one global manifest, not per-locale),
 * so it cannot be translated per-request — but its text still comes from the
 * dictionaries rather than a hardcoded literal, per CLAUDE.md §2 rule 2.
 */
export default function manifest(): MetadataRoute.Manifest {
  const ar = getDictionary('ar')
  const en = getDictionary('en')

  return {
    name: `${ar.site.fullName} — ${en.site.fullName}`,
    short_name: `ASOO — ${ar.site.name}`,
    description: `${ar.site.description} — ${en.site.description}`,
    lang: 'ar',
    dir: 'rtl',
    start_url: '/ar',
    scope: '/',
    display: 'standalone',
    // The manifest spec requires literal hex here — there is no CSS class to
    // apply to a manifest JSON file. Values match --color-surface-default and
    // --color-surface-brand in design/tokens.json, so they stay in sync by hand
    // whenever the brand primary changes.
    // eslint-disable-next-line no-restricted-syntax
    background_color: '#FFFFFF',
    // eslint-disable-next-line no-restricted-syntax
    theme_color: '#143751',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
