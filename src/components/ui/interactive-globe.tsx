'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'

import { cn } from '@/lib/cn'
import { JORDAN_VIEW } from '@/lib/geo/jordan'
import type { BorderPoint } from '@/lib/geo/jordan-border'
import type { GovernorateShape } from '@/lib/geo/jordan-governorates'

/**
 * THE HERO GLOBE — an interactive geodetic sphere, zoomed on Jordan.
 *
 * Geodesy is the science of measuring the Earth, and this syndicate's members
 * are the people who do it. So the hero shows JORDAN: the twelve governorates
 * as triangulation stations, the legs of a control network observed between
 * them, and Amman — where the syndicate sits — as the occupied station.
 *
 * The camera sits CLOSE — close enough that the country's border and all
 * twelve governorate names are legible on load, which is the whole job. The
 * Earth drifts continuously beneath a fixed circular porthole, so it reads as
 * a turning globe without ever carrying Jordan out of frame. You can nudge it
 * by hand; there is deliberately no zoom control (see the pointer section).
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  NOTES ON THE IMPLEMENTATION
 *
 *  COLOUR comes from design tokens, resolved at runtime. A canvas cannot use
 *  a CSS custom property, so the values are read off the document element
 *  and re-read whenever the theme changes — CLAUDE.md §6 (no raw hex in a
 *  component) still holds, and one palette serves both light and dark.
 *
 *  SIZE is driven by the container via ResizeObserver, not a fixed pixel
 *  count: a hero visual has to survive every breakpoint.
 *
 *  The backing store is resized ONLY when the box changes. Reallocating it
 *  every frame throws away the GPU texture for no reason.
 *
 *  MOTION: with `prefers-reduced-motion` the drift stops dead and the station
 *  pulse stops with it, leaving a still, fully-readable map. It stays
 *  draggable — that is user-initiated movement, which the preference does not
 *  forbid.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface GlobeMarker {
  code: string
  lat: number
  lng: number
  label: string
}

interface InteractiveGlobeProps {
  markers: GlobeMarker[]
  /** Legs of the network, as pairs of marker codes. */
  legs: Array<[string, string]>
  /** The station drawn in the accent colour and always labelled. */
  originCode?: string
  /** The country outline drawn on the sphere, projected as a great-circle path. */
  border?: BorderPoint[]
  /** Governorate polygons. Filled and labelled in place — this is the map. */
  shapes: GovernorateShape[]
  /** Accessible description — the globe is decorative but not invisible. */
  label: string
  /** Label text direction, so Arabic renders correctly on the canvas. */
  dir?: 'rtl' | 'ltr'
  className?: string
}

/* ------------------------------------------------------------------ maths */

function latLngToXYZ(lat: number, lng: number, r: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lng + 180) * Math.PI) / 180
  return [
    -(r * Math.sin(phi) * Math.cos(theta)),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ]
}

function rotateY(x: number, y: number, z: number, a: number): [number, number, number] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c + z * s, y, -x * s + z * c]
}

function rotateX(x: number, y: number, z: number, a: number): [number, number, number] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x, y * c - z * s, y * s + z * c]
}

function project(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  fov: number,
): [number, number] {
  const scale = fov / (fov + z)
  return [x * scale + cx, y * scale + cy]
}

/* ----------------------------------------------------------------- colour */

type RGB = [number, number, number]

/** Reads a design token off the document element and returns it as RGB. */
function readToken(name: string, fallback: RGB): RGB {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return fallback

  if (raw.startsWith('#')) {
    const hex = raw.slice(1)
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex
    const n = Number.parseInt(full.slice(0, 6), 16)
    if (Number.isNaN(n)) return fallback
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }

  const nums = raw.match(/[\d.]+/g)
  if (nums && nums.length >= 3) {
    return [Number(nums[0]), Number(nums[1]), Number(nums[2])]
  }
  return fallback
}

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface Palette {
  dot: RGB
  net: RGB
  accent: RGB
  /** For subtle body wash inside the sphere. */
  surface: RGB
  /** For label pill backgrounds — an elevated surface that reads in both themes. */
  pill: RGB
  text: RGB
}

/**
 * NOT the `surface.plan` tokens — those are authored sub-3:1 for a watermark,
 * useless for a focal point. The foreground text tokens invert properly
 * between themes and stay legible, so one palette serves both.
 */
function readPalette(): Palette {
  return {
    dot: readToken('--color-text-muted', [148, 163, 184]),
    net: readToken('--color-text-secondary', [100, 116, 139]),
    accent: readToken('--color-surface-accent', [226, 113, 29]),
    surface: readToken('--color-surface-default', [255, 255, 255]),
    // `surface-raised` flips light-mode-white ↔ dark-mode-elevated, which is
    // what a label pill needs: contrast against the sphere in either theme.
    pill: readToken('--color-surface-raised', [255, 255, 255]),
    text: readToken('--color-text-primary', [15, 23, 42]),
  }
}

/* ------------------------------------------------------------- component */

const DOT_COUNT = 1200

/*
 * SCALE — the one number that makes this hero work.
 *
 * Jordan spans roughly 4° of arc. On a sphere drawn at radius R, 4° is about
 * R × 4 × π/180 pixels — so at the "whole Earth fits the box" radius the
 * country is about fourteen pixels across, which is why it read as a dot.
 *
 * Instead the camera sits CLOSE: the sphere is drawn far larger than the
 * canvas, and a fixed circular porthole (VIEW_FRAC of the box) shows the patch
 * of surface around Jordan. You still read it as a globe — curved graticule,
 * dot field falling away, a lit limb when it swings into view — but at a scale
 * where the border and twelve governorates are legible.
 *
 * At SPHERE_SCALE = 19 the country spans most of the porthole, which is what
 * separates the tightly-packed north-western governorates enough to label them.
 */
const VIEW_FRAC = 0.46
const SPHERE_SCALE = 19

/*
 * The Earth turns, but Jordan never leaves the frame.
 *
 * A globe zoomed this close would sweep the country out of view in a couple of
 * seconds of real rotation, leaving the hero showing empty desert most of the
 * time. So the motion is a slow oscillation around the Jordan-centred view —
 * the surface visibly moves and the lighting shifts, which is what "rotating"
 * has to communicate here, while the subject stays where it belongs.
 */
/*
 * These are RADIANS OF SURFACE, and the camera is close, so they are tiny.
 *
 * The sphere is drawn at roughly 3,200px radius, which means one radian of
 * rotation sweeps 3,200px of surface past the porthole. A drift of 0.09 —
 * perfectly gentle on a globe that fits the box — moved Jordan nearly 290px
 * and pushed it clean out of the frame. Scale drift with the camera, always.
 */
const DRIFT_Y = 0.0025
const DRIFT_X = 0.0013
const DRIFT_SPEED = 0.00022

/** The point the view is centred on — Jordan's rough centroid. */
const CENTRE_LAT = 31.3
const CENTRE_LNG = 36.8

export function InteractiveGlobe({
  markers,
  legs,
  originCode,
  border,
  shapes,
  label,
  dir = 'ltr',
  className,
}: InteractiveGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /*
   * Governorate code → translated name, taken from the marker list.
   *
   * The shapes carry geometry and a code; the names already live in the data
   * layer that backs the directory. Joining them here keeps the polygon file
   * free of user-facing text, which is what CLAUDE.md §9 requires.
   */
  const labelFor = useMemo(
    () => new Map(markers.map((m) => [m.code, m.label] as const)),
    [markers],
  )

  // Explicitly `number` — JORDAN_VIEW is `as const`, so inference would pin
  // these to the literal starting angles and refuse every later rotation.
  const rotY = useRef<number>(JORDAN_VIEW.rotY)
  const rotX = useRef<number>(JORDAN_VIEW.rotX)

  const drag = useRef({ active: false, x: 0, y: 0, ry: 0, rx: 0 })
  const hover = useRef<{ x: number; y: number } | null>(null)

  const time = useRef(0)
  const frame = useRef(0)
  const palette = useRef<Palette | null>(null)
  const reduced = useRef(false)
  const onScreen = useRef(true)
  const box = useRef({ w: 0, h: 0, dpr: 1 })

  /**
   * Surface texture as [lat, lng] pairs over the visible region.
   *
   * Deterministic — a seeded LCG, not Math.random — so the server and client
   * agree and the scatter does not reshuffle on every re-render.
   */
  const dots = useRef<Array<[number, number]>>([])
  if (dots.current.length === 0) {
    let seed = 20260813
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    const out: Array<[number, number]> = []
    for (let i = 0; i < DOT_COUNT; i++) {
      out.push([18 + rand() * 28, 22 + rand() * 30])
    }
    dots.current = out
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const pal = palette.current

    // Nothing to paint yet — the driving loop keeps running regardless, so a
    // late palette or a not-yet-measured box simply skips a frame.
    if (!canvas || !ctx || !pal || box.current.w === 0 || box.current.h === 0) return

    const { w, h } = box.current
    const cx = w / 2
    const cy = h / 2

    // The porthole: fixed to the box, so the composition never changes size.
    const viewR = Math.min(w, h) * VIEW_FRAC
    // The sphere itself, drawn far larger than the porthole.
    const radius = viewR * SPHERE_SCALE
    // FOV scales with the radius so the surface stays close to orthographic —
    // Jordan should look like Jordan, not a fisheye smear.
    const fov = radius * 12

    if (!reduced.current) time.current += 0.015
    const t = time.current

    /*
     * The drift. Nobody is dragging → the Earth eases back and forth around
     * the Jordan-centred view on two slightly out-of-phase sine waves, so the
     * motion never looks like a metronome. Reduced-motion holds it still.
     */
    if (!drag.current.active && !reduced.current) {
      const p = performance.now() * DRIFT_SPEED
      rotY.current = JORDAN_VIEW.rotY + Math.sin(p) * DRIFT_Y
      rotX.current = JORDAN_VIEW.rotX + Math.sin(p * 0.73 + 1.1) * DRIFT_X
    }

    ctx.clearRect(0, 0, w, h)

    const ry = rotY.current
    const rx = rotX.current

    /*
     * ROLL CORRECTION — keep north up.
     *
     * Two rotations can put Jordan at the centre of the view but cannot also
     * control the twist around the view axis; the projection has no third
     * angle. Left alone the country renders tilted about 35°, which on a
     * national map reads as a bug rather than a style.
     *
     * So the roll is measured each frame — project the centroid and a point
     * one degree north of it, take the angle of that vector — and unwound on
     * the canvas transform. Measuring rather than hard-coding means it stays
     * correct while the globe drifts.
     */
    const rollOf = (): number => {
      const at = (lat: number, lng: number) => {
        let [x, y, z] = latLngToXYZ(lat, lng, radius)
        ;[x, y, z] = rotateX(x, y, z, rx)
        ;[x, y, z] = rotateY(x, y, z, ry)
        return project(x, y, z, cx, cy, fov)
      }
      const [ax, ay] = at(CENTRE_LAT, CENTRE_LNG)
      const [bx2, by2] = at(CENTRE_LAT + 1, CENTRE_LNG)
      return Math.atan2(bx2 - ax, -(by2 - ay))
    }
    const roll = rollOf()

    /** Applies the roll about the porthole centre. Call inside a save(). */
    const applyRoll = () => {
      ctx.translate(cx, cy)
      ctx.rotate(-roll)
      ctx.translate(-cx, -cy)
    }

    // ---------------------------------------------------------- the sphere
    // A soft body wash so the wireframe reads as a solid globe rather than a
    // flat ring of dots.
    const body = ctx.createRadialGradient(
      cx - viewR * 0.35,
      cy - viewR * 0.4,
      viewR * 0.1,
      cx,
      cy,
      viewR,
    )
    body.addColorStop(0, rgba(pal.dot, 0.2))
    body.addColorStop(1, rgba(pal.dot, 0.05))
    ctx.save()
    // Clip to the PORTHOLE, not to the sphere. At this camera distance the
    // sphere is many times the canvas, so clipping to it would paint the box
    // corner to corner; the fixed disc is what keeps the globe reading as a
    // globe and gives the composition a stable silhouette.
    ctx.beginPath()
    ctx.arc(cx, cy, viewR, 0, Math.PI * 2)
    ctx.clip()
    applyRoll()
    ctx.fillStyle = body
    ctx.fillRect(cx - viewR, cy - viewR, viewR * 2, viewR * 2)

    // ------------------------------------------------------- graticule mesh
    // Spacing adapts to the camera: at this distance a 15° mesh would put at
    // most one line in frame, so the grid steps down to whole degrees and
    // reads as the survey grid it is meant to evoke.
    // Only the window actually inside the porthole is walked. Meshing the
    // whole sphere at 2° would be ~32,000 projections a frame to draw a patch
    // the size of the Levant — the rest is behind the horizon or off-canvas.
    const meshStep = 2
    const LAT_FROM = 18
    const LAT_TO = 46
    const LNG_FROM = 22
    const LNG_TO = 52
    ctx.lineWidth = 1
    for (let lng = LNG_FROM; lng <= LNG_TO; lng += meshStep) {
      ctx.beginPath()
      let first = true
      for (let lat = LAT_FROM; lat <= LAT_TO; lat += 1) {
        let [x, y, z] = latLngToXYZ(lat, lng, radius)
        ;[x, y, z] = rotateX(x, y, z, rx)
        ;[x, y, z] = rotateY(x, y, z, ry)
        if (z > 0) {
          first = true
          continue
        }
        const [sx, sy] = project(x, y, z, cx, cy, fov)
        if (first) {
          ctx.moveTo(sx, sy)
          first = false
        } else {
          ctx.lineTo(sx, sy)
        }
      }
      ctx.strokeStyle = rgba(pal.dot, 0.08)
      ctx.stroke()
    }
    for (let lat = LAT_FROM; lat <= LAT_TO; lat += meshStep) {
      ctx.beginPath()
      let first = true
      for (let lng = LNG_FROM; lng <= LNG_TO; lng += 1) {
        let [x, y, z] = latLngToXYZ(lat, lng, radius)
        ;[x, y, z] = rotateX(x, y, z, rx)
        ;[x, y, z] = rotateY(x, y, z, ry)
        if (z > 0) {
          first = true
          continue
        }
        const [sx, sy] = project(x, y, z, cx, cy, fov)
        if (first) {
          ctx.moveTo(sx, sy)
          first = false
        } else {
          ctx.lineTo(sx, sy)
        }
      }
      ctx.strokeStyle = rgba(pal.dot, 0.08)
      ctx.stroke()
    }

    // ------------------------------------------------------------- surface
    // A regional scatter, not the whole-sphere Fibonacci field: at this camera
    // distance a globally-even distribution puts almost nothing inside the
    // porthole. These are seeded once over the same window as the mesh.
    for (const d of dots.current) {
      let [x, y, z] = latLngToXYZ(d[0], d[1], radius)
      ;[x, y, z] = rotateX(x, y, z, rx)
      ;[x, y, z] = rotateY(x, y, z, ry)
      if (z > 0) continue // cull the far hemisphere

      const [sx, sy] = project(x, y, z, cx, cy, fov)
      ctx.beginPath()
      ctx.arc(sx, sy, 1.1, 0, Math.PI * 2)
      ctx.fillStyle = rgba(pal.dot, 0.35)
      ctx.fill()
    }

    // -------------------------------------------------- governorate polygons
    /*
     * The map itself. Each governorate is filled and outlined, and the country
     * border is simply the union of their outer edges — so there is one source
     * of geometry rather than an outline that can drift from the divisions
     * drawn inside it.
     *
     * Amman is tinted with the accent because that is where the syndicate
     * sits; the rest share a single muted fill so the map reads as one body
     * rather than a chart of twelve unrelated regions.
     */
    const projectRing = (ring: Array<[number, number]>) => {
      const pts: Array<[number, number]> = []
      let anyNear = false
      for (const [lat, lng] of ring) {
        let [x, y, z] = latLngToXYZ(lat, lng, radius)
        ;[x, y, z] = rotateX(x, y, z, rx)
        ;[x, y, z] = rotateY(x, y, z, ry)
        if (z <= 0) anyNear = true
        pts.push(project(x, y, z, cx, cy, fov))
      }
      return anyNear ? pts : null
    }

    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    for (const gov of shapes) {
      const pts = projectRing(gov.ring)
      if (!pts || pts.length < 3) continue

      ctx.beginPath()
      ctx.moveTo(pts[0]![0], pts[0]![1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1])
      ctx.closePath()

      const isOrigin = gov.code === originCode
      ctx.fillStyle = isOrigin ? rgba(pal.accent, 0.3) : rgba(pal.net, 0.16)
      ctx.fill()
      // Internal divisions: thin and low-contrast, so they read as boundaries
      // without competing with the country's own edge.
      ctx.strokeStyle = rgba(pal.surface, 0.55)
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // The national border, stroked over the fills: a soft halo then a crisp
    // line, so the country's silhouette is unmistakable at a glance.
    if (border && border.length > 1) {
      const pts = projectRing(border.map((b) => [b.lat, b.lng] as [number, number]))
      if (pts && pts.length > 2) {
        ctx.beginPath()
        ctx.moveTo(pts[0]![0], pts[0]![1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1])
        ctx.closePath()
        ctx.strokeStyle = rgba(pal.accent, 0.2)
        ctx.lineWidth = 7
        ctx.stroke()
        ctx.strokeStyle = rgba(pal.accent, 0.95)
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
    ctx.restore()

    // The porthole edge, drawn after the clip is released so it stays crisp.
    ctx.beginPath()
    ctx.arc(cx, cy, viewR, 0, Math.PI * 2)
    ctx.strokeStyle = rgba(pal.dot, 0.45)
    ctx.lineWidth = 1.25
    ctx.stroke()

    // --------------------------------------------------- triangulation net
    const projected = new Map<string, { sx: number; sy: number; z: number }>()
    for (const m of markers) {
      let [x, y, z] = latLngToXYZ(m.lat, m.lng, radius)
      ;[x, y, z] = rotateX(x, y, z, rx)
      ;[x, y, z] = rotateY(x, y, z, ry)
      const [sx, sy] = project(x, y, z, cx, cy, fov)
      projected.set(m.code, { sx, sy, z })
    }

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, viewR, 0, Math.PI * 2)
    ctx.clip()
    applyRoll()

    for (const [a, b] of legs) {
      const pa = projected.get(a)
      const pb = projected.get(b)
      if (!pa || !pb) continue
      if (pa.z > 0 && pb.z > 0) continue
      ctx.beginPath()
      ctx.moveTo(pa.sx, pa.sy)
      ctx.lineTo(pb.sx, pb.sy)
      ctx.strokeStyle = rgba(pal.net, 0.35)
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // ------------------------------------------------------------ stations
    for (const m of markers) {
      const p = projected.get(m.code)
      if (!p || p.z > 0) continue
      const isOrigin = m.code === originCode
      const colour = isOrigin ? pal.accent : pal.net

      if (isOrigin && !reduced.current) {
        const pulse = (Math.sin(t * 1.6) + 1) / 2
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, 6 + pulse * 16, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(pal.accent, (1 - pulse) * 0.5)
        ctx.lineWidth = 1.4
        ctx.stroke()
      }

      // Conventional survey mark: filled centre inside an open circle.
      ctx.beginPath()
      ctx.arc(p.sx, p.sy, isOrigin ? 5 : 3.2, 0, Math.PI * 2)
      ctx.fillStyle = rgba(pal.pill, 0.95)
      ctx.fill()
      ctx.strokeStyle = rgba(colour, 1)
      ctx.lineWidth = isOrigin ? 2 : 1.2
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(p.sx, p.sy, isOrigin ? 2 : 1.3, 0, Math.PI * 2)
      ctx.fillStyle = rgba(colour, 1)
      ctx.fill()
    }

    // -------------------------------------------------------------- labels
    /*
     * A canvas font string is NOT CSS: a custom property here is invalid and
     * the whole declaration is dropped, silently falling back to 10px
     * sans-serif. The family has to be named literally.
     */
    const fontFamily = '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.direction = dir

    // Each name sits inside its OWN governorate, at the visual centre carried
    // in the shape data — the honest place for it, and it removes the whole
    // problem of leader lines and colliding pills that plagued the pin layout.
    for (const gov of shapes) {
      const label = labelFor.get(gov.code)
      if (!label) continue

      let [x, y, z] = latLngToXYZ(gov.labelAt[0], gov.labelAt[1], radius)
      ;[x, y, z] = rotateX(x, y, z, rx)
      ;[x, y, z] = rotateY(x, y, z, ry)
      if (z > 0) continue
      const [sx, sy] = project(x, y, z, cx, cy, fov)
      // Off-porthole labels are simply dropped; a name half-clipped by the
      // frame reads as a rendering bug.
      if (Math.hypot(sx - cx, sy - cy) > viewR - 12) continue

      const isOrigin = gov.code === originCode
      const size = isOrigin ? 13 : 11.5
      ctx.font = `${isOrigin ? 700 : 600} ${size}px ${fontFamily}`

      /*
       * The names are counter-rotated.
       *
       * Everything in this block is drawn inside the roll-correcting
       * transform, which is right for geometry and wrong for type: without
       * undoing it here each label would sit at the same 35° tilt the
       * transform exists to remove. Rotating back about the label's own
       * anchor leaves it horizontal on screen.
       */
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(roll)

      // A halo rather than a pill: at this density twelve filled boxes would
      // hide the very boundaries they are labelling.
      ctx.lineJoin = 'round'
      ctx.strokeStyle = rgba(pal.surface, 0.85)
      ctx.lineWidth = 3.5
      ctx.strokeText(label, 0, 0)
      ctx.fillStyle = rgba(isOrigin ? pal.accent : pal.text, 1)
      ctx.fillText(label, 0, 0)
      ctx.restore()
    }

    ctx.restore()
  }, [markers, legs, originCode, border, shapes, labelFor, dir])

  /* ------------------------------------------------------------- effects */

  useEffect(() => {
    const sync = () => {
      palette.current = readPalette()
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    })
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', sync)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', sync)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reduced.current = media.matches
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (rect.width === 0 || rect.height === 0) return
      box.current = { w: rect.width, h: rect.height, dpr }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      const ctx = canvas.getContext('2d')
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  const drawRef = useRef(draw)
  useEffect(() => {
    drawRef.current = draw
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let running = true
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen.current = Boolean(entry?.isIntersecting)
      },
      { threshold: 0 },
    )
    io.observe(canvas)
    const tick = () => {
      if (!running) return
      if (onScreen.current && document.visibilityState === 'visible') drawRef.current()
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(frame.current)
      io.disconnect()
    }
  }, [])

  /* -------------------------------------------------------------- pointer */

  /*
   * Drag is kept; zoom is not.
   *
   * The camera distance is a composition decision, not a user setting: the
   * whole point of this hero is that Jordan is legible the moment the page
   * loads. Letting a stray trackpad flick zoom out to a marble would undo
   * that, and hijacking wheel events over a hero also fights the page scroll.
   * Nudging the globe by hand is welcome, so pointer-drag stays — and it
   * simply eases back to the Jordan view once released.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      ry: rotY.current,
      rx: rotX.current,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    hover.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    if (!drag.current.active) return
    // Small factor: at this camera distance a coarse one would fling the
    // country out of frame in a few pixels of travel.
    // Same reasoning as the drift constants: at this camera distance a pixel
    // of travel is a lot of surface, so the factor is small and the range is
    // clamped tightly enough that the country can never be dragged offscreen.
    rotY.current = JORDAN_VIEW.rotY + clamp((e.clientX - drag.current.x) * 0.00012, -0.02, 0.02)
    rotX.current = JORDAN_VIEW.rotX + clamp((e.clientY - drag.current.y) * 0.00012, -0.012, 0.012)
  }

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current.active = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div className={cn('relative size-full', className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="size-full touch-none cursor-grab select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={(e) => {
          hover.current = null
          endPointer(e)
        }}
      />
    </div>
  )
}
