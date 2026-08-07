import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Authenticated areas and the public lookup endpoints must never be
        // crawled — the lookup routes are rate-limited, single-record surfaces
        // reached by reference, not browsable indexes. docs/08-security.md §8.
        disallow: [
          '/*/dashboard',
          '/*/admin',
          '/*/login',
          '/*/register',
          '/*/reset-password',
          '/*/services/pay/',
          '/*/services/verify/',
          '/*/services/verify-report/',
          '/*/join/status/',
          '/api/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
