/**
 * Counter e-services: the shared, CLIENT-SAFE half.
 *
 * Deliberately free of `server-only` imports so the request form can use the
 * same normalization and the same validity rule the server enforces. The client
 * copy exists for fast feedback; the server copy is the one that decides.
 */

export const SERVICE_REQUEST_TYPES = ['electronic_plate', 'change_statement'] as const
export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number]

export const SERVICE_REQUEST_STATUSES = [
  'submitted',
  'in_progress',
  'fulfilled',
  'rejected',
] as const
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number]

export function isServiceRequestType(value: unknown): value is ServiceRequestType {
  return typeof value === 'string' && (SERVICE_REQUEST_TYPES as readonly string[]).includes(value)
}

/**
 * The public URL segment for each service.
 *
 * ASCII and meaningful in both locales — CLAUDE.md §4 forbids turning an Arabic
 * title into a slug directly.
 */
export const SERVICE_REQUEST_SLUGS: Record<ServiceRequestType, string> = {
  electronic_plate: 'electronic-plate',
  change_statement: 'change-statement',
}

export function typeFromSlug(slug: string): ServiceRequestType | null {
  const entry = Object.entries(SERVICE_REQUEST_SLUGS).find(([, s]) => s === slug)
  return entry ? (entry[0] as ServiceRequestType) : null
}

/** Dictionary path for a type's title/description, so no label is hardcoded. */
export const serviceRequestKey = (type: ServiceRequestType, field: string): string =>
  `serviceRequests.${type === 'electronic_plate' ? 'plate' : 'change'}${field}`

export const MAX_DLS_KEY_LENGTH = 40
export const MAX_NOTE_LENGTH = 500

// Written as escapes rather than literals: these are CODE POINTS, not copy,
// and a literal Arabic digit here would trip the hardcoded-string audit for no
// reason. U+0660..0669 is Arabic-Indic; U+06F0..06F9 is the extended (Persian)
// set — Jordanian keyboards and PDFs produce both.
const ARABIC_INDIC_OFFSET = 0x0660
const EXTENDED_INDIC_OFFSET = 0x06f0

/**
 * Normalize a DLS key to one canonical spelling.
 *
 * Two people typing the same key must produce the same stored string, or the
 * queue grows duplicates nobody can match up. Eastern Arabic digits fold to
 * Western ones because CLAUDE.md §7 requires identifiers to render as 0-9 — a
 * key that round-trips through both digit sets is a transcription error waiting
 * to happen. Whitespace goes; `/` and `-` stay, because DLS keys carry them.
 */
export function normalizeDlsKey(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_OFFSET))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - EXTENDED_INDIC_OFFSET))
    // Whitespace plus the bidi marks a copy-paste out of an Arabic PDF drags
    // along invisibly (U+200E/200F). An invisible character in a key is a
    // lookup that fails for no visible reason.
    .replace(/[\s\u200e\u200f]+/g, '')
    .toUpperCase()
    .slice(0, MAX_DLS_KEY_LENGTH)
}

/**
 * Shape check only.
 *
 * The syndicate does not publish a DLS key grammar, and inventing a strict one
 * would reject valid keys — a far worse failure than accepting a wrong-looking
 * one that staff can see and reject. So this rejects only what is certainly
 * not a key: empty, too short, or carrying characters a key never contains.
 */
export function isValidDlsKey(normalized: string): boolean {
  return /^[0-9A-Z][0-9A-Z/-]{2,39}$/.test(normalized)
}
