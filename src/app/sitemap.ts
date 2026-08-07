import type { MetadataRoute } from 'next'

import { locales } from '@/i18n/config'
import { siteUrl } from '@/lib/site'
import { governorates, members, posts } from '@/lib/data/seed'

/**
 * Both locales, with alternates, so search engines pair them correctly.
 * Arabic is x-default — the primary audience is Jordanian.
 * docs/04-site-architecture.md §7.
 */
const staticPaths = [
  { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
  { path: 'about', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: 'directory', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: 'services', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: 'services/pay', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: 'maps', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: 'documents', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: 'news', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: 'contact', priority: 0.6, changeFrequency: 'yearly' as const },
  { path: 'join', priority: 0.7, changeFrequency: 'monthly' as const },
]

function alternates(path: string) {
  return {
    languages: Object.fromEntries(
      locales.map((l) => [l === 'ar' ? 'ar-JO' : 'en', `${siteUrl}/${l}${path ? `/${path}` : ''}`]),
    ),
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const item of staticPaths) {
      entries.push({
        url: `${siteUrl}/${locale}${item.path ? `/${item.path}` : ''}`,
        lastModified: new Date(),
        changeFrequency: item.changeFrequency,
        priority: item.priority,
        alternates: alternates(item.path),
      })
    }

    for (const post of posts) {
      entries.push({
        url: `${siteUrl}/${locale}/news/${post.slug}`,
        lastModified: new Date(post.publishedAt),
        changeFrequency: 'yearly',
        priority: 0.6,
        alternates: alternates(`news/${post.slug}`),
      })
    }

    for (const gov of governorates) {
      entries.push({
        url: `${siteUrl}/${locale}/directory/governorate/${gov.code}`,
        changeFrequency: 'weekly',
        priority: 0.6,
        alternates: alternates(`directory/governorate/${gov.code}`),
      })
    }

    // Individually indexable member pages — the strongest SEO differentiator
    // this site has. Only active members are listed.
    for (const member of members.filter((m) => m.status === 'active')) {
      entries.push({
        url: `${siteUrl}/${locale}/directory/${member.licenseNumber}`,
        changeFrequency: 'monthly',
        priority: 0.5,
        alternates: alternates(`directory/${member.licenseNumber}`),
      })
    }
  }

  return entries
}
