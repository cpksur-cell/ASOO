import type { Locale } from '@/i18n/config'

/** Build a locale-prefixed href. Every internal link goes through this. */
export function href(locale: Locale, path = ''): string {
  const clean = path.replace(/^\/+/, '')
  return clean ? `/${locale}/${clean}` : `/${locale}`
}

/**
 * Primary navigation. Seven items plus a CTA — at the upper bound of the
 * 4–7 guideline, justified because each maps to a distinct user intent.
 * docs/04-site-architecture.md §5.1.
 */
export const primaryNav = [
  { key: 'home', path: '' },
  { key: 'about', path: 'about' },
  { key: 'directory', path: 'directory' },
  { key: 'services', path: 'services' },
  { key: 'maps', path: 'maps' },
  { key: 'documents', path: 'documents' },
  { key: 'news', path: 'news' },
] as const

export const footerNav = {
  syndicate: [
    { key: 'about', path: 'about' },
    { key: 'board', path: 'about/board' },
    { key: 'history', path: 'about/history' },
    { key: 'contact', path: 'contact' },
  ],
  services: [
    { key: 'payBill', path: 'services/pay' },
    { key: 'verify', path: 'services/verify' },
    { key: 'join', path: 'join' },
    { key: 'login', path: 'login' },
  ],
  content: [
    { key: 'news', path: 'news' },
    { key: 'documents', path: 'documents' },
    { key: 'maps', path: 'maps' },
    { key: 'directory', path: 'directory' },
  ],
  legal: [
    { key: 'privacy', path: 'privacy' },
    { key: 'terms', path: 'terms' },
    { key: 'accessibility', path: 'accessibility' },
  ],
} as const
