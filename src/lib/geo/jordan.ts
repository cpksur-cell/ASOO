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
 * Derived from the projection in the globe component: for the country's
 * centroid (≈31.5°N, 36°E) these are the Y and X rotations that place it at
 * the point of the sphere nearest the viewer. Slightly under-rotated on X so
 * the globe is seen a little from above, which reads better than dead-on.
 */
export const JORDAN_VIEW = { rotY: 0.94, rotX: -0.42 } as const
