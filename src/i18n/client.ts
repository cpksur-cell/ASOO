import ar from '@/messages/ar.json'
import en from '@/messages/en.json'

/**
 * Client-safe dictionary access.
 *
 * `src/i18n/config.ts` is marked `server-only` because it is imported by
 * layouts and repositories. Client components need the same dictionaries, so
 * this module exposes them without the server guard. The dictionaries are
 * static JSON — shipping them to the client is fine, and both locales
 * together are a few kilobytes gzipped.
 */
export type Locale = 'ar' | 'en'

const dictionaries = { ar, en } as const
export type Dictionary = typeof ar

export function getDictionaryClient(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary
}

export function createTranslator(dict: Dictionary) {
  return function t(path: string, vars?: Record<string, string | number>): string {
    const value = path
      .split('.')
      .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], dict)

    if (typeof value !== 'string') return path
    if (!vars) return value
    return value.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
  }
}
