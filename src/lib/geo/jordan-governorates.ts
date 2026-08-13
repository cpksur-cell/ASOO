/**
 * Simplified polygons for Jordan's twelve governorates.
 *
 * Coordinates are WGS 84 decimal degrees, each ring listed anticlockwise and
 * closed implicitly (the renderer closes it). They are traced to match the
 * syndicate's own reference map: the north-west cluster of small governorates,
 * Mafraq's eastern wedge to the Iraqi border, Ma'an filling the south-east,
 * and Aqaba on the Red Sea.
 *
 * ACCURACY: these are CARTOGRAPHIC, not cadastral. They are simplified to tens
 * of points so a hero canvas can redraw them every frame, and share edges only
 * approximately. Nothing here is a survey product and no boundary dispute
 * should ever be read off it — the authoritative source is the Department of
 * Lands and Survey.
 *
 * `code` keys into the governorate records that already back the directory, so
 * names stay translated in one place (CLAUDE.md §9) and no place name is
 * duplicated as a literal here.
 */

export interface GovernorateShape {
  code: string
  /** [lat, lng] pairs. */
  ring: Array<[number, number]>
  /** Where the name sits — the visual centre, which is not the centroid for
   *  the long eastern wedges. */
  labelAt: [number, number]
}

export const JORDAN_GOVERNORATE_SHAPES: GovernorateShape[] = [
  {
    code: 'irbid',
    labelAt: [32.55, 35.78],
    ring: [
      [32.72, 35.55],
      [32.72, 35.9],
      [32.66, 36.02],
      [32.45, 35.98],
      [32.38, 35.9],
      [32.4, 35.78],
      [32.33, 35.66],
      [32.35, 35.56],
    ],
  },
  {
    code: 'ajloun',
    labelAt: [32.32, 35.72],
    ring: [
      [32.4, 35.78],
      [32.33, 35.66],
      [32.22, 35.68],
      [32.2, 35.78],
      [32.28, 35.83],
    ],
  },
  {
    code: 'jerash',
    labelAt: [32.27, 35.92],
    ring: [
      [32.45, 35.98],
      [32.38, 35.9],
      [32.4, 35.78],
      [32.28, 35.83],
      [32.16, 35.87],
      [32.2, 36.0],
      [32.33, 36.02],
    ],
  },
  {
    code: 'mafraq',
    labelAt: [32.15, 37.4],
    ring: [
      [32.66, 36.02],
      [32.66, 36.6],
      [32.55, 37.3],
      [32.5, 38.0],
      [32.45, 38.75],
      [32.14, 39.15],
      [31.6, 38.8],
      [31.72, 38.2],
      [31.95, 37.3],
      [32.0, 36.6],
      [32.05, 36.25],
      [32.2, 36.0],
      [32.33, 36.02],
      [32.45, 35.98],
    ],
  },
  {
    code: 'balqa',
    labelAt: [32.02, 35.72],
    ring: [
      [32.2, 35.78],
      [32.16, 35.87],
      [32.06, 35.9],
      [31.92, 35.85],
      [31.86, 35.68],
      [31.95, 35.56],
      [32.1, 35.58],
      [32.22, 35.68],
    ],
  },
  {
    code: 'zarqa',
    labelAt: [32.1, 36.5],
    ring: [
      [32.2, 36.0],
      [32.05, 36.25],
      [32.0, 36.6],
      [31.95, 37.3],
      [31.72, 38.2],
      [31.6, 37.6],
      [31.85, 36.7],
      [31.95, 36.2],
      [32.06, 35.95],
      [32.16, 35.87],
    ],
  },
  {
    code: 'amman',
    labelAt: [31.78, 36.1],
    ring: [
      [32.06, 35.9],
      [32.06, 35.95],
      [31.95, 36.2],
      [31.85, 36.7],
      [31.6, 37.6],
      [31.45, 36.9],
      [31.5, 36.2],
      [31.62, 35.9],
      [31.78, 35.82],
      [31.92, 35.85],
    ],
  },
  {
    code: 'madaba',
    labelAt: [31.68, 35.72],
    ring: [
      [31.92, 35.85],
      [31.78, 35.82],
      [31.62, 35.9],
      [31.5, 35.82],
      [31.55, 35.62],
      [31.72, 35.55],
      [31.86, 35.68],
    ],
  },
  {
    code: 'karak',
    labelAt: [31.15, 35.95],
    ring: [
      [31.5, 35.82],
      [31.62, 35.9],
      [31.5, 36.2],
      [31.45, 36.9],
      [31.1, 36.6],
      [30.85, 36.1],
      [30.9, 35.6],
      [31.05, 35.45],
      [31.25, 35.42],
      [31.45, 35.5],
      [31.55, 35.62],
    ],
  },
  {
    code: 'tafilah',
    labelAt: [30.72, 35.68],
    ring: [
      [30.9, 35.6],
      [30.85, 36.1],
      [30.6, 36.0],
      [30.5, 35.65],
      [30.6, 35.35],
      [30.78, 35.3],
      [31.05, 35.45],
    ],
  },
  {
    code: 'maan',
    labelAt: [30.15, 36.6],
    ring: [
      [31.1, 36.6],
      [31.45, 36.9],
      [31.6, 37.6],
      [31.6, 38.8],
      [31.15, 38.35],
      [30.6, 37.95],
      [30.05, 37.65],
      [29.5, 37.55],
      [29.2, 37.15],
      [29.35, 36.35],
      [29.75, 35.75],
      [30.1, 35.4],
      [30.35, 35.28],
      [30.5, 35.65],
      [30.6, 36.0],
      [30.85, 36.1],
    ],
  },
  {
    code: 'aqaba',
    labelAt: [29.75, 35.32],
    ring: [
      [30.35, 35.28],
      [30.1, 35.4],
      [29.75, 35.75],
      [29.35, 36.35],
      [29.2, 36.05],
      [29.45, 35.5],
      [29.53, 34.99],
      [29.85, 35.05],
    ],
  },
]
