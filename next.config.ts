import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  output: 'standalone',



  // See docs/08-security.md §9.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },

  // 301s from the Lovable prototype's unprefixed URLs.
  // See docs/04-site-architecture.md §6.
  async redirects() {
    const legacy = ['about', 'news', 'documents', 'maps', 'contact']
    return [
      // `/search` was renamed to `/directory`.
      { source: '/search', destination: '/ar/directory', permanent: true },
      ...legacy.map((p) => ({
        source: `/${p}`,
        destination: `/ar/${p}`,
        permanent: true,
      })),
      { source: '/about/:path*', destination: '/ar/about/:path*', permanent: true },
      { source: '/documents/:path*', destination: '/ar/documents/:path*', permanent: true },
    ]
  },
}

export default nextConfig
