/**
 * Arabic → Latin transliteration for member names.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  READ THIS BEFORE TRUSTING THE OUTPUT
 *
 *  A person's name in Latin script is a fact about that person, not something
 *  an algorithm gets to decide: عبدالله is Abdullah, Abdallah or Abd Allah
 *  depending on whose passport it is. This module produces a REASONABLE
 *  DEFAULT so the English site is usable on day one, and every row it touches
 *  is flagged so staff can correct it.
 *
 *  It is never a substitute for the member's own spelling.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Frequent given names and family-name particles, spelled the way they are
 * normally written in Jordan. Handled as whole words because letter-by-letter
 * rules get these conspicuously wrong.
 */
const WORDS = new Map(
  Object.entries({
    محمد: 'Mohammad',
    احمد: 'Ahmad',
    أحمد: 'Ahmad',
    محمود: 'Mahmoud',
    عبد: 'Abd',
    الله: 'Allah',
    عبدالله: 'Abdullah',
    عبدالرحمن: 'Abdulrahman',
    عبدالكريم: 'Abdulkarim',
    عبدالعزيز: 'Abdulaziz',
    ابراهيم: 'Ibrahim',
    إبراهيم: 'Ibrahim',
    اسماعيل: 'Ismail',
    يوسف: 'Yousef',
    خالد: 'Khaled',
    علي: 'Ali',
    حسن: 'Hasan',
    حسين: 'Hussein',
    عمر: 'Omar',
    عثمان: 'Othman',
    سليمان: 'Suleiman',
    موسى: 'Musa',
    عيسى: 'Issa',
    يحيى: 'Yahya',
    زيد: 'Zaid',
    سامي: 'Sami',
    نبيل: 'Nabil',
    وليد: 'Waleed',
    ماجد: 'Majed',
    رامي: 'Rami',
    عماد: 'Emad',
    جمال: 'Jamal',
    كمال: 'Kamal',
    مصطفى: 'Mustafa',
    نايف: 'Nayef',
    سهيل: 'Suhail',
    فادي: 'Fadi',
    باسم: 'Basem',
    طارق: 'Tareq',
    منذر: 'Munther',
    غسان: 'Ghassan',
    مروان: 'Marwan',
    انطون: 'Anton',
    جريس: 'Jeries',
    بشار: 'Bashar',
    اياد: 'Eyad',
    زياد: 'Ziad',
    رزق: 'Rizq',
    راشد: 'Rashed',
    صالح: 'Saleh',
    سالم: 'Salem',
    عوني: 'Awni',
    عدنان: 'Adnan',
    حماد: 'Hammad',
    هديب: 'Hdeib',
    ابو: 'Abu',
    أبو: 'Abu',
    بن: 'Bin',
    ال: 'Al',
    آل: 'Al',
  }),
)

/** Letter-level fallback for anything not in the word list. */
const LETTERS = new Map(
  Object.entries({
    ا: 'a', أ: 'a', إ: 'i', آ: 'aa', ب: 'b', ت: 't', ث: 'th', ج: 'j',
    ح: 'h', خ: 'kh', د: 'd', ذ: 'th', ر: 'r', ز: 'z', س: 's', ش: 'sh',
    ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q',
    ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'o', ي: 'y', ى: 'a',
    // The shadda is quoted because a combining mark cannot be a bare key.
    ة: 'a', ء: '', ؤ: 'o', ئ: 'e', 'ّ': '',
  }),
)

const TASHKEEL = /[ً-ْٰـ]/g

/** Strips diacritics and the tatweel elongation character. */
export function stripTashkeel(text) {
  return String(text).replace(TASHKEEL, '')
}

/**
 * Search key for Arabic name matching.
 *
 * Unifies the alef forms, ta-marbuta and alef-maqsura, because otherwise
 * "احمد" fails to match "أحمد" — the single most common Arabic search failure
 * and the reason `members.search_normalized` exists.
 */
export function normalizeArabic(text) {
  return stripTashkeel(text)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(word) {
  if (!word) return word
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function transliterateWord(word) {
  const bare = stripTashkeel(word)
  const direct = WORDS.get(bare) ?? WORDS.get(normalizeArabic(bare))
  if (direct) return direct

  // The definite article is written as a prefix, not a separate syllable.
  let rest = bare
  let prefix = ''
  if (rest.startsWith('ال') && rest.length > 3) {
    prefix = 'Al-'
    rest = rest.slice(2)
    const known = WORDS.get(rest) ?? WORDS.get(normalizeArabic(rest))
    if (known) return prefix + known
  }

  /*
   * Position-aware, because Arabic does not write short vowels. A flat
   * letter-for-letter map turns كرادشه into "Kradshh" — every omitted vowel
   * becomes a missing English one. These rules restore the vowels that a
   * reader supplies automatically:
   *
   *   · ي and و are long vowels in the middle of a word (i, ou) but
   *     consonants next to another vowel (y, w).
   *   · A final ه/ة is the "-eh" ending, not a bare h.
   *   · An opening consonant cluster gets the short 'a' that Arabic implies,
   *     so كرادشه reads Karadsheh rather than Kradsheh.
   */
  const chars = [...rest]
  const isVowelLetter = (c) => c === 'ا' || c === 'أ' || c === 'إ' || c === 'آ'
  let out = ''

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const prev = chars[i - 1]
    const next = chars[i + 1]
    const last = i === chars.length - 1

    if (ch === 'ي') {
      // Consonantal beside a long vowel, otherwise the long "i".
      out += isVowelLetter(prev) || isVowelLetter(next) ? 'y' : 'i'
      continue
    }
    if (ch === 'و') {
      out += isVowelLetter(prev) || isVowelLetter(next) ? 'w' : 'ou'
      continue
    }
    if ((ch === 'ه' || ch === 'ة') && last) {
      out += 'eh'
      continue
    }
    out += LETTERS.get(ch) ?? ''
  }

  // Break an opening consonant cluster with the implied short vowel.
  out = out.replace(/^([bcdfghjklmnpqrstvwxyz])([bcdfghjklmnpqrstvwxyz])/i, '$1a$2')
  out = out.replace(/([a-z])\1{2,}/g, '$1$1') // collapse runaway repeats
  return prefix + titleCase(out)
}

/** Transliterate a full name, word by word. */
export function transliterateName(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map(transliterateWord)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
