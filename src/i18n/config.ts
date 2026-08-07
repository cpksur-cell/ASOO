import 'server-only'

import ar from '@/messages/ar.json'
import en from '@/messages/en.json'

export const locales = ['ar', 'en'] as const
export type Locale = (typeof locales)[number]

/** Arabic is the default. RTL is the primary layout, not a bolt-on. */
export const defaultLocale: Locale = 'ar'

export const localeDirection: Record<Locale, 'rtl' | 'ltr'> = {
  ar: 'rtl',
  en: 'ltr',
}

/** `hreflang` values. Arabic is region-qualified — the audience is Jordanian. */
export const localeHrefLang: Record<Locale, string> = {
  ar: 'ar-JO',
  en: 'en',
}

export const localeNames: Record<Locale, string> = {
  ar: 'العربية',
  en: 'English',
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

/* -------------------------------------------------------------------------- */

const dictionaries = { ar, en } as const

/** The shape of a dictionary, pinned to Arabic so English cannot drift. */
export type Dictionary = typeof ar

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary
}

/**
 * Translate by dot path, with `{placeholder}` interpolation.
 *
 * Returns the key itself when a translation is missing, which makes the gap
 * visible in the UI rather than rendering an empty element. A blank label is
 * a bug you ship; a visible `nav.directory` is a bug you notice.
 */
export function createTranslator(dict: Dictionary) {
  return function t(path: string, vars?: Record<string, string | number>): string {
    const value = path
      .split('.')
      .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], dict)

    if (typeof value !== 'string') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] missing translation: ${path}`)
      }
      return path
    }

    if (!vars) return value
    return value.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in vars ? String(vars[key]) : match,
    )
  }
}

export type Translator = ReturnType<typeof createTranslator>
