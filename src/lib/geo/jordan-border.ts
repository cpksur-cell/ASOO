/**
 * A hand-simplified outline of Jordan for the hero globe.
 *
 * ~40 points in WGS 84 decimal degrees, going clockwise from the north-west
 * corner and closing back on itself. Accurate enough to be recognisable as
 * Jordan at hero size — and NOT a survey product. It is decoration, not a
 * boundary anyone should measure against.
 *
 * The polyline is projected on the sphere the same way governorate markers
 * are, so it curves correctly under rotation and clips at the horizon.
 */

export interface BorderPoint {
  lat: number
  lng: number
}

export const JORDAN_BORDER: BorderPoint[] = [
  // NW — Yarmouk / Sea of Galilee corner
  { lat: 32.72, lng: 35.55 },
  { lat: 32.72, lng: 35.87 },
  // N — Syrian border eastward along the Hauran
  { lat: 32.68, lng: 36.15 },
  { lat: 32.66, lng: 36.6 },
  { lat: 32.55, lng: 37.3 },
  { lat: 32.5, lng: 38.0 },
  { lat: 32.45, lng: 38.75 },
  // NE — Trebil / Iraq border
  { lat: 32.14, lng: 39.15 },
  { lat: 31.6, lng: 38.8 },
  { lat: 31.15, lng: 38.35 },
  // E → SE, Saudi border
  { lat: 30.6, lng: 37.95 },
  { lat: 30.05, lng: 37.65 },
  { lat: 29.5, lng: 37.55 },
  { lat: 29.2, lng: 37.15 },
  { lat: 29.2, lng: 36.75 },
  { lat: 29.35, lng: 36.35 },
  { lat: 29.45, lng: 35.85 },
  { lat: 29.55, lng: 35.35 },
  // Aqaba tip
  { lat: 29.53, lng: 34.99 },
  // W — Wadi Araba, Dead Sea, Jordan River
  { lat: 29.85, lng: 35.05 },
  { lat: 30.35, lng: 35.15 },
  { lat: 30.85, lng: 35.35 },
  { lat: 31.25, lng: 35.42 },
  { lat: 31.5, lng: 35.45 },
  { lat: 31.75, lng: 35.5 },
  { lat: 32.0, lng: 35.55 },
  { lat: 32.35, lng: 35.55 },
  { lat: 32.55, lng: 35.55 },
  { lat: 32.72, lng: 35.55 },
]
