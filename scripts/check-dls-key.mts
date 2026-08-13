/**
 * Sanity check for the DLS key normalizer.
 *
 * The key is the ONLY field a member supplies to the counter e-services, so
 * the rule that decides whether two people typed the same key is worth
 * asserting rather than assuming. Run with: node scripts/check-dls-key.mts
 */

import { isValidDlsKey, normalizeDlsKey } from '../src/lib/service-requests.ts'

const cases: Array<[string, string, boolean, string]> = [
  // input, expected normalized, expected valid, why
  ['12345', '12345', true, 'plain Western digits pass through'],
  ['١٢٣٤٥', '12345', true, 'Arabic-Indic digits fold to Western'],
  ['۱۲۳۴۵', '12345', true, 'extended (Persian) digits fold too'],
  [' 12 345 ', '12345', true, 'spaces are removed, inside and out'],
  ['‏12345‎', '12345', true, 'invisible bidi marks are stripped'],
  ['ab-12/3', 'AB-12/3', true, 'letters upper-case; / and - survive'],
  ['', '', false, 'empty is not a key'],
  ['12', '12', false, 'two characters is too short to be a key'],
  ['١٢٣', '123', true, 'three characters is the minimum'],
  ['abc def!', 'ABCDEF!', false, 'a punctuation character a key never carries'],
  ['-1234', '-1234', false, 'a key does not open with a separator'],
]

let failed = 0
for (const [input, expectedKey, expectedValid, why] of cases) {
  const actualKey = normalizeDlsKey(input)
  const actualValid = isValidDlsKey(actualKey)
  const ok = actualKey === expectedKey && actualValid === expectedValid
  if (!ok) {
    failed += 1
    console.error(
      `✗ ${why}\n    input      ${JSON.stringify(input)}` +
        `\n    expected   ${JSON.stringify(expectedKey)} valid=${expectedValid}` +
        `\n    actual     ${JSON.stringify(actualKey)} valid=${actualValid}`,
    )
  }
}

if (failed > 0) {
  console.error(`\n✗ dls-key: ${failed}/${cases.length} case(s) failed`)
  process.exit(1)
}
console.log(`✓ dls-key: ${cases.length}/${cases.length} cases pass`)
