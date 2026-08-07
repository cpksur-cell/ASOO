import type { Locale } from './config'

/**
 * The ONLY money and date formatters in the system.
 * CLAUDE.md §7 and §8. Never format either inline in a component.
 */

const TIMEZONE = 'Asia/Amman'

/* ------------------------------------------------------------------- money */

/** 1 JOD = 1000 fils. Amounts are integer fils everywhere — never a float. */
export const FILS_PER_JOD = 1000n

const CURRENCY_SYMBOL: Record<Locale, string> = {
  ar: 'د.أ',
  en: 'JOD',
}

/**
 * Format integer fils as a Jordanian dinar amount.
 *
 * Always 3 decimal places (Jordanian convention) and always Western digits —
 * these numbers get transcribed into bank apps, and Eastern digits produce
 * transcription errors. docs/05-design-system.md §3.3.
 *
 *   formatMoney(12500n, 'ar')  ->  "12.500 د.أ"
 *   formatMoney(12500n, 'en')  ->  "12.500 JOD"
 */
export function formatMoney(fils: bigint | number, locale: Locale): string {
  const value = typeof fils === 'number' ? BigInt(Math.round(fils)) : fils
  const negative = value < 0n
  const abs = negative ? -value : value

  const whole = abs / FILS_PER_JOD
  const fraction = abs % FILS_PER_JOD

  // Grouping is applied to the integer part only, using an explicit
  // Western-digit locale so an Arabic UI still renders 0-9.
  const grouped = new Intl.NumberFormat('en-US').format(whole)
  const decimals = fraction.toString().padStart(3, '0')

  return `${negative ? '-' : ''}${grouped}.${decimals} ${CURRENCY_SYMBOL[locale]}`
}

/** Numeric part only — for table cells that carry the currency in the header. */
export function formatAmount(fils: bigint | number): string {
  const value = typeof fils === 'number' ? BigInt(Math.round(fils)) : fils
  const negative = value < 0n
  const abs = negative ? -value : value
  const grouped = new Intl.NumberFormat('en-US').format(abs / FILS_PER_JOD)
  return `${negative ? '-' : ''}${grouped}.${(abs % FILS_PER_JOD).toString().padStart(3, '0')}`
}

/** Parse a user-entered dinar amount into integer fils. Throws on garbage. */
export function parseMoney(input: string): bigint {
  const cleaned = input.trim().replace(/[,\s]/g, '')
  if (!/^-?\d+(\.\d{1,3})?$/.test(cleaned)) {
    throw new Error(`Invalid amount: ${input}`)
  }
  const negative = cleaned.startsWith('-')
  const [whole = '0', fraction = ''] = cleaned.replace('-', '').split('.')
  const fils = BigInt(whole) * FILS_PER_JOD + BigInt(fraction.padEnd(3, '0'))
  return negative ? -fils : fils
}

/* ------------------------------------------------------------------- dates */

/**
 * Dates are stored UTC and displayed in Asia/Amman. Western digits in both
 * locales, for the same transcription reason as money.
 */
export function formatDate(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TIMEZONE,
  }).format(d)
}

/** ISO date for `<time dateTime>` and anything machine-read. */
export function formatDateISO(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

export function formatDateTime(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIMEZONE,
  }).format(d)
}

/**
 * Hijri alongside Gregorian, for official announcements.
 * CLAUDE.md §8:  "١٥ رجب ١٤٤٧ / 2026-01-15"
 *
 * The Hijri portion keeps Eastern digits deliberately — it is editorial
 * content, not a transcribable identifier.
 */
export function formatDateWithHijri(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TIMEZONE,
  }).format(d)
  return `${hijri} / ${formatDateISO(d)}`
}

/* ------------------------------------------------------- Arabic normalizer */

/**
 * Normalize Arabic text for search.
 *
 * Without this a member typing `احمد` will not find `أحمد` — the single most
 * common Arabic search failure, and the thing that makes a directory feel
 * broken. Applied on write (into `members.search_normalized`) and on query.
 * docs/03-data-model.md §9.
 */
export function normalizeArabic(input: string): string {
  return input
    .normalize('NFKC')
    // Tashkeel (diacritics) and tatweel.
    .replace(/[ً-ْٰـ]/g, '')
    // Alef forms: أ إ آ ٱ -> ا
    .replace(/[أإآٱ]/g, 'ا')
    // Ta marbuta -> ha
    .replace(/ة/g, 'ه')
    // Alef maqsura -> ya
    .replace(/ى/g, 'ي')
    // Eastern Arabic digits -> Western, so "١٢٣" matches "123"
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/* -------------------------------------------------------------------- misc */

export function formatNumber(value: number, _locale: Locale): string {
  // Western digits in both locales — see formatMoney.
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatFileSize(bytes: number, locale: Locale): string {
  const units = locale === 'ar' ? ['بايت', 'ك.ب', 'م.ب', 'ج.ب'] : ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}
