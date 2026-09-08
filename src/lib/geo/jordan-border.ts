/**
 * The outline of Jordan for the hero globe.
 *
 * SOURCE: derived by DISSOLVING the twelve governorate polygons in
 * `jordan-governorates.ts` — every edge walked by two governorates is
 * internal, every edge walked once is national boundary. Natural Earth's
 * admin-1 rings share vertices exactly, so the dissolve is exact and the
 * border cannot disagree with the fills it encloses. The previous hand-traced
 * outline stopped at 32.72°N and cut roughly 72 km off the north-eastern tip,
 * which the corrected Mafraq polygon would have overflowed.
 *
 * Simplified with Douglas–Peucker at 0.012° (about 1 km) after the
 * dissolve, starting from the northernmost vertex so that tip is preserved.
 *
 * WGS 84 decimal degrees, open — the renderer closes it. Accurate enough to be
 * recognisable as Jordan at hero size, and NOT a survey product. It is
 * decoration, not a boundary anyone should measure against.
 *
 * The polyline is projected on the sphere the same way governorate markers
 * are, so it curves correctly under rotation and clips at the horizon.
 */

export interface BorderPoint {
  lat: number
  lng: number
}

export const JORDAN_BORDER: BorderPoint[] = [
  { lat: 32.313, lng: 36.807 },
  { lat: 32.379, lng: 36.388 },
  { lat: 32.527, lng: 36.177 },
  { lat: 32.517, lng: 36.066 },
  { lat: 32.608, lng: 36.006 },
  { lat: 32.655, lng: 36.004 },
  { lat: 32.657, lng: 35.955 },
  { lat: 32.691, lng: 35.944 },
  { lat: 32.747, lng: 35.775 },
  { lat: 32.644, lng: 35.563 },
  { lat: 32.56, lng: 35.58 },
  { lat: 32.553, lng: 35.559 },
  { lat: 32.519, lng: 35.552 },
  { lat: 32.491, lng: 35.58 },
  { lat: 32.41, lng: 35.545 },
  { lat: 32.368, lng: 35.566 },
  { lat: 32.375, lng: 35.552 },
  { lat: 32.252, lng: 35.573 },
  { lat: 32.238, lng: 35.559 },
  { lat: 32.238, lng: 35.573 },
  { lat: 32.111, lng: 35.535 },
  { lat: 32.087, lng: 35.545 },
  { lat: 32.058, lng: 35.523 },
  { lat: 31.945, lng: 35.546 },
  { lat: 31.919, lng: 35.525 },
  { lat: 31.765, lng: 35.559 },
  { lat: 31.641, lng: 35.48 },
  { lat: 31.401, lng: 35.453 },
  { lat: 31.258, lng: 35.396 },
  { lat: 31.16, lng: 35.436 },
  { lat: 31.104, lng: 35.438 },
  { lat: 31.024, lng: 35.392 },
  { lat: 30.963, lng: 35.385 },
  { lat: 30.89, lng: 35.322 },
  { lat: 30.823, lng: 35.317 },
  { lat: 30.78, lng: 35.28 },
  { lat: 30.617, lng: 35.205 },
  { lat: 30.43, lng: 35.14 },
  { lat: 30.361, lng: 35.162 },
  { lat: 30.245, lng: 35.125 },
  { lat: 30.123, lng: 35.145 },
  { lat: 30.034, lng: 35.086 },
  { lat: 29.842, lng: 35.049 },
  { lat: 29.586, lng: 34.96 },
  { lat: 29.559, lng: 34.956 },
  { lat: 29.518, lng: 34.998 },
  { lat: 29.352, lng: 34.949 },
  { lat: 29.19, lng: 36.016 },
  { lat: 29.2, lng: 36.069 },
  { lat: 29.495, lng: 36.477 },
  { lat: 29.854, lng: 36.729 },
  { lat: 29.995, lng: 37.47 },
  { lat: 30.331, lng: 37.648 },
  { lat: 30.499, lng: 37.981 },
  { lat: 31.007, lng: 37.48 },
  { lat: 31.491, lng: 36.96 },
  { lat: 31.994, lng: 38.963 },
  { lat: 32.213, lng: 39.266 },
  { lat: 32.245, lng: 39.292 },
  { lat: 32.343, lng: 39.256 },
  { lat: 32.353, lng: 39.236 },
  { lat: 32.308, lng: 39.046 },
  { lat: 32.328, lng: 39.029 },
  { lat: 32.475, lng: 38.978 },
  { lat: 32.497, lng: 39.057 },
  { lat: 33.372, lng: 38.775 },
]
