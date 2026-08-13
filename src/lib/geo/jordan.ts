/**
 * Geographic reference points for the 12 Jordanian governorates, plus the
 * triangulation legs drawn between them.
 *
 * Coordinates are approximate administrative centres in WGS 84 decimal
 * degrees — accurate enough to place a marker on a globe, and NOT a survey
 * product. Nothing here is user-facing text: `code` keys into the governorate
 * names already held in the data layer, so the labels stay translated in one
 * place (CLAUDE.md §9).
 */

export interface GeoPoint {
  code: string
  lat: number
  lng: number
}

export const JORDAN_GOVERNORATES: GeoPoint[] = [
  { code: 'irbid', lat: 32.55, lng: 35.85 },
  { code: 'ajloun', lat: 32.33, lng: 35.75 },
  { code: 'jerash', lat: 32.28, lng: 35.9 },
  { code: 'mafraq', lat: 32.34, lng: 36.21 },
  { code: 'balqa', lat: 32.03, lng: 35.73 },
  { code: 'zarqa', lat: 32.07, lng: 36.09 },
  { code: 'amman', lat: 31.95, lng: 35.93 },
  { code: 'madaba', lat: 31.72, lng: 35.8 },
  { code: 'karak', lat: 31.18, lng: 35.7 },
  { code: 'tafilah', lat: 30.84, lng: 35.6 },
  { code: 'maan', lat: 30.19, lng: 35.73 },
  { code: 'aqaba', lat: 29.53, lng: 35.01 },
]

/** The syndicate is headquartered in Amman — the occupied station. */
export const ORIGIN_CODE = 'amman'

/**
 * Legs of the triangulation network, by governorate code.
 *
 * Chosen to form a connected chain of triangles down the length of the
 * country, which is how a national control network is actually structured —
 * not every point joined to every other, which would be a mesh, not a survey.
 */
export const TRIANGULATION_LEGS: Array<[string, string]> = [
  ['irbid', 'ajloun'],
  ['ajloun', 'jerash'],
  ['irbid', 'jerash'],
  ['irbid', 'mafraq'],
  ['jerash', 'mafraq'],
  ['jerash', 'balqa'],
  ['mafraq', 'zarqa'],
  ['balqa', 'zarqa'],
  ['balqa', 'amman'],
  ['zarqa', 'amman'],
  ['amman', 'madaba'],
  ['madaba', 'karak'],
  ['karak', 'tafilah'],
  ['tafilah', 'maan'],
  ['maan', 'aqaba'],
]

/**
 * Rotation that brings Jordan to face the camera, in radians.
 *
 * SOLVED, not eyeballed. For the country's centroid (31.3°N, 36.8°E) these are
 * the exact X-then-Y rotations — the order the globe component applies them —
 * that put the point at (0, 0, −r), the spot on the sphere nearest the viewer.
 *
 * The earlier hand-tuned pair (0.94, −0.42) left Jordan roughly 0.37 rad off
 * centre. That was invisible while the globe was drawn at 1× and the country
 * was a few pixels wide, and it moved Jordan clean off the canvas the moment
 * the hero zoomed in — the offset scales with the radius. Keep these exact.
 *
 * BRANCH MATTERS. Four (rotX, rotY) pairs put the centroid at the sub-viewer
 * point; only two of them also leave north pointing up and east pointing
 * right. The other two render the country mirrored and upside-down while
 * still passing a "is it centred?" check. This is the north-up branch.
 *
 * A roll of about 35° remains — the projection has no third angle to remove
 * it — so the globe component corrects it on the canvas transform.
 */
export const JORDAN_VIEW = { rotY: 2.3881, rotX: 2.3487 } as const
