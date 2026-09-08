/**
 * How a member's mobile number becomes a login identity.
 *
 * Members are identified by the mobile number the syndicate holds for them.
 * Supabase Auth identifies accounts by email or by phone, and phone identity
 * needs a paid SMS provider and an OTP round trip that the syndicate does not
 * have, so each member is given an INTERNAL address derived from their number.
 *
 * That address is a key, not a mailbox. Nothing is ever sent to it, it is
 * never displayed, and `members.asoojo.com` has no MX record on purpose — an
 * address that cannot receive mail cannot quietly become a channel for
 * password resets or notifications that nobody reads.
 *
 * ONE RULE, THREE CALLERS. The roster importer, the login form and the
 * provisioning script must derive byte-identical addresses or a member simply
 * cannot sign in, so the rule lives here and each of them imports it. This
 * file is the reason the provisioning script is `.mts` rather than `.mjs`.
 */

/** Never receives mail. See the note above before adding an MX record. */
export const MEMBER_LOGIN_DOMAIN = 'members.asoojo.com'

/**
 * Reduce whatever was typed or stored to +9627XXXXXXXX, or null.
 *
 * Jordanian mobiles are 07 followed by 7, 8 or 9 and seven more digits. The
 * roster spreadsheet has the leading zero stripped by Excel, a member typing
 * their own number will usually include it, and either may arrive with a
 * country code, spaces or dashes.
 *
 * Returning null rather than a best guess is the point: a mis-parsed number
 * becomes a login that does not work, or — worse — collides with somebody
 * else's.
 */
export function normalizeJordanMobile(raw: string | null | undefined): string | null {
  if (!raw) return null

  const digits = String(raw)
    // Arabic-Indic (U+0660..0669) and Persian (U+06F0..06F9) digits fold to
    // Western, the same rule DLS keys use — a member typing on an Arabic
    // keyboard means the same number. Written as escapes, not literals, so the
    // i18n audit does not read a character class as user-facing text.
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')

  let local = digits
  if (local.startsWith('00962')) local = local.slice(5)
  else if (local.startsWith('962')) local = local.slice(3)
  if (local.startsWith('0')) local = local.slice(1)

  if (!/^7[789]\d{7}$/.test(local)) return null
  return `+962${local}`
}

/**
 * The login address for a mobile number, or null if the number is not usable.
 *
 * Derived from the E.164 form with the `+` dropped, so one member has exactly
 * one address no matter how they typed their number.
 */
export function memberLoginEmail(rawMobile: string | null | undefined): string | null {
  const e164 = normalizeJordanMobile(rawMobile)
  if (!e164) return null
  return `${e164.slice(1)}@${MEMBER_LOGIN_DOMAIN}`
}
