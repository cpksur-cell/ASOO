'use client'

import { useCallback, useEffect, useRef } from 'react'

import { cn } from '@/lib/cn'
import { JORDAN_VIEW } from '@/lib/geo/jordan'

/**
 * THE HERO GLOBE — an interactive geodetic sphere.
 *
 * Geodesy is the science of measuring the Earth, and this syndicate's members
 * are the people who do it. So rather than a generic "global network" widget,
 * this shows JORDAN: the twelve governorates as triangulation stations, the
 * legs of a control network observed between them, and Amman — where the
 * syndicate sits — as the occupied station.
 *
 * Drag to rotate. It spins slowly on its own until you touch it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  NOTES ON THE IMPLEMENTATION
 *
 *  COLOUR comes from the design tokens, resolved at runtime. A canvas cannot
 *  use a CSS custom property, so the values are read off the document element
 *  and re-read whenever the theme changes — which keeps the rule in CLAUDE.md
 *  §6 (never a raw hex in a component) true even here, and means the globe
 *  follows light/dark without a second palette.
 *
 *  SIZE is driven by the container via ResizeObserver, not a fixed `size` in
 *  pixels: a hero visual has to survive every breakpoint.
 *
 *  The backing store is resized ONLY when the box changes. Reallocating it
 *  every frame (as the canonical version of this component does) throws away
 *  the GPU texture 60 times a second for no reason.
 *
 *  The loop is suspended when the canvas scrolls out of view or the tab is
 *  hidden — a decorative animation must not burn a laptop battery below the
 *  fold.
 *
 *  MOTION: with `prefers-reduced-motion` the globe stops rotating, the arcs
 *  stop travelling and the stations stop pulsing. It stays fully draggable,
 *  because that is user-initiated movement, which the preference does not
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

interface Palette {
  dot: RGB
  net: RGB
  accent: RGB
  surface: RGB
  text: RGB
}

/**
 * NOT the `surface.plan` tokens.
 *
 * Those are authored deliberately BELOW the 3:1 threshold so the cadastral
 * watermark recedes behind content — correct for a background, useless for a
 * focal point. In dark mode `surface.plan.strong` is #31424F against a #121A22
 * page, which renders the globe all but invisible.
 *
 * The foreground text tokens are the right family here: they are built to stay
 * legible and they invert properly between themes, so one palette serves both.
 */
function readPalette(): Palette {
  return {
    dot: readToken('--color-text-muted', [148, 163, 184]),
    net: readToken('--color-text-secondary', [100, 116, 139]),
    accent: readToken('--color-surface-accent', [226, 113, 29]),
    surface: readToken('--color-surface-default', [255, 255, 255]),
    text: readToken('--color-text-secondary', [71, 85, 105]),
  }
}

/* ------------------------------------------------------------- component */

const DOT_COUNT = 900

export function InteractiveGlobe({
  markers,
  legs,
  originCode,
  label,
  dir = 'ltr',
  className,
}: InteractiveGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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

  /** A Fibonacci sphere — the standard way to scatter points evenly. */
  const dots = useRef<RGB[]>([])
  if (dots.current.length === 0) {
    const golden = (1 + Math.sqrt(5)) / 2
    const out: RGB[] = []
    for (let i = 0; i < DOT_COUNT; i++) {
      const theta = (2 * Math.PI * i) / golden
      const phi = Math.acos(1 - (2 * (i + 0.5)) / DOT_COUNT)
      out.push([
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
      ])
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
    const radius = Math.min(w, h) * 0.38
    const fov = 600

    if (!drag.current.active && !reduced.current) rotY.current += 0.0016
    if (!reduced.current) time.current += 0.015
    const t = time.current

    ctx.clearRect(0, 0, w, h)

    const ry = rotY.current
    const rx = rotX.current

    // ---------------------------------------------------------- the sphere
    // A soft interior wash so the wireframe reads as a solid body rather than
    // a flat ring of dots.
    const body = ctx.createRadialGradient(
      cx - radius * 0.25,
      cy - radius * 0.3,
      radius * 0.1,
      cx,
      cy,
      radius,
    )
    body.addColorStop(0, rgba(pal.dot, 0.16))
    body.addColorStop(1, rgba(pal.dot, 0.04))
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()

    // The limb.
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = rgba(pal.dot, 0.5)
    ctx.lineWidth = 1.25
    ctx.stroke()

    // ------------------------------------------------------------- surface
    for (const d of dots.current) {
      let [x, y, z] = [d[0] * radius, d[1] * radius, d[2] * radius]
      ;[x, y, z] = rotateX(x, y, z, rx)
      ;[x, y, z] = rotateY(x, y, z, ry)
      if (z > 0) continue // cull the far hemisphere

      const [sx, sy] = project(x, y, z, cx, cy, fov)
      // Nearer points are brighter, which is what gives the flat scatter depth.
      const depth = Math.max(0.12, 1 - (z + radius) / (2 * radius))
      ctx.beginPath()
      ctx.arc(sx, sy, 1.1 + depth * 0.9, 0, Math.PI * 2)
      ctx.fillStyle = rgba(pal.dot, depth * 0.85)
      ctx.fill()
    }

    // Project every station once; the legs and labels both need the result.
    const projected = new Map<string, { sx: number; sy: number; z: number }>()
    for (const m of markers) {
      let [x, y, z] = latLngToXYZ(m.lat, m.lng, radius)
      ;[x, y, z] = rotateX(x, y, z, rx)
      ;[x, y, z] = rotateY(x, y, z, ry)
      const [sx, sy] = project(x, y, z, cx, cy, fov)
      projected.set(m.code, { sx, sy, z })
    }

    // --------------------------------------------------- triangulation net
    for (const [a, b] of legs) {
      const pa = projected.get(a)
      const pb = projected.get(b)
      if (!pa || !pb) continue
      if (pa.z > 0 && pb.z > 0) continue // both on the far side

      // Fade the leg out as it wraps around the limb. Clamped for the same
      // reason as the station alpha below.
      const vis = Math.min(1, Math.max(0, 1 - Math.max(pa.z, pb.z) / (radius * 0.9)))
      if (vis <= 0.02) continue

      ctx.beginPath()
      ctx.moveTo(pa.sx, pa.sy)
      ctx.lineTo(pb.sx, pb.sy)
      ctx.strokeStyle = rgba(pal.net, 0.8 * vis)
      ctx.lineWidth = 1.3
      ctx.stroke()
    }

    // ------------------------------------------------------------ stations
    const hoverPos = hover.current
    let hovered: GlobeMarker | null = null
    let hoveredDist = 18

    for (const m of markers) {
      const p = projected.get(m.code)
      if (!p || p.z > 0) continue
      if (hoverPos) {
        const d = Math.hypot(hoverPos.x - p.sx, hoverPos.y - p.sy)
        if (d < hoveredDist) {
          hoveredDist = d
          hovered = m
        }
      }
    }

    for (const m of markers) {
      const p = projected.get(m.code)
      if (!p || p.z > 0) continue

      const isOrigin = m.code === originCode
      const colour = isOrigin ? pal.accent : pal.net
      /*
       * CLAMPED. `p.z` is negative on the near face, so the raw expression
       * exceeds 1 for any station facing the viewer — and an alpha above 1
       * risks the whole colour string being rejected, which silently drops
       * every marker. Alpha must stay in [0,1].
       */
      const vis = Math.min(1, Math.max(0.15, 1 - p.z / (radius * 0.9)))

      // The occupied station radiates a range ring, the way a reading spreads
      // from an instrument set up over a point.
      if (isOrigin && !reduced.current) {
        const pulse = (Math.sin(t * 1.6) + 1) / 2
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, 5 + pulse * 11, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(pal.accent, (1 - pulse) * 0.45)
        ctx.lineWidth = 1.2
        ctx.stroke()
      }

      // Conventional survey mark: filled centre inside an open circle.
      ctx.beginPath()
      ctx.arc(p.sx, p.sy, isOrigin ? 5 : 3.4, 0, Math.PI * 2)
      ctx.fillStyle = rgba(pal.surface, 0.9)
      ctx.fill()
      ctx.strokeStyle = rgba(colour, vis)
      ctx.lineWidth = isOrigin ? 2 : 1.2
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(p.sx, p.sy, isOrigin ? 2 : 1.2, 0, Math.PI * 2)
      ctx.fillStyle = rgba(colour, vis)
      ctx.fill()
    }

    // -------------------------------------------------------------- labels
    // Only the occupied station and whatever the pointer is near — twelve
    // labels at once would be noise, not information.
    const toLabel: Array<{ m: GlobeMarker; accent: boolean }> = []
    const origin = markers.find((m) => m.code === originCode)
    if (origin) toLabel.push({ m: origin, accent: true })
    if (hovered && hovered.code !== originCode) toLabel.push({ m: hovered, accent: false })

    /*
     * A canvas font string is NOT CSS: a custom property here is invalid and
     * the whole declaration is dropped, silently falling back to 10px
     * sans-serif. The family has to be named literally.
     */
    ctx.font = '600 12px "IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.direction = dir

    for (const { m, accent } of toLabel) {
      const p = projected.get(m.code)
      if (!p || p.z > 0) continue

      const pad = 6
      const metrics = ctx.measureText(m.label)
      const tw = metrics.width
      // Place the label on the side that keeps it inside the canvas.
      const flip = p.sx + tw + 22 > w
      const bx = flip ? p.sx - tw - 16 : p.sx + 10
      const by = p.sy - 9

      ctx.fillStyle = rgba(pal.surface, 0.92)
      ctx.beginPath()
      ctx.roundRect(bx - pad, by - 2, tw + pad * 2, 18, 4)
      ctx.fill()
      ctx.strokeStyle = rgba(accent ? pal.accent : pal.net, 0.45)
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = rgba(accent ? pal.accent : pal.text, 1)
      ctx.textAlign = 'left'
      ctx.fillText(m.label, bx, by + 7)
    }
    // No self-scheduling: the effect below owns the loop, so `draw` paints one
    // frame and nothing else. That is what makes it impossible to freeze.
  }, [markers, legs, originCode, dir])

  /* ------------------------------------------------------------- effects */

  // Palette, re-read whenever the theme changes.
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

  // Reduced-motion preference.
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reduced.current = media.matches
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  // Size the backing store to the box — once per resize, not once per frame.
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
      // setTransform (not scale) so repeated resizes do not compound.
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  /*
   * ONE loop that never stops rescheduling itself.
   *
   * The obvious design — cancel the frame when the canvas scrolls away and
   * schedule a new one when it returns — has a nasty failure mode: every
   * external caller must get the restart exactly right, and any path that
   * cancels without rescheduling freezes the globe permanently with no error
   * to show for it. That is precisely what happened here.
   *
   * So the loop is unconditional and the *work* is what gets skipped: when the
   * canvas is off-screen or the tab is in the background, the callback returns
   * immediately having painted nothing. The saving is the same — no geometry,
   * no fills — but there is no state machine left to get wrong.
   */
  /*
   * The loop reads the LATEST `draw` from a ref instead of depending on it.
   *
   * `draw` is rebuilt whenever its inputs change, and an effect keyed on it
   * tears the loop down and starts a new one each time. Any hiccup in that
   * churn — a cleanup landing after the restart, a double-invoked effect in
   * development — leaves the animation cancelled with a fully-painted canvas
   * and no error, which is exactly how this failed. Keeping the dependency
   * list empty means the loop is created once on mount and torn down once on
   * unmount, and nothing in between can strand it.
   */
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

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      ry: rotY.current,
      rx: rotX.current,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    hover.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    if (!drag.current.active) return
    rotY.current = drag.current.ry + (e.clientX - drag.current.x) * 0.005
    // Clamped so the globe cannot be tipped past its poles into nonsense.
    rotX.current = Math.max(
      -1.2,
      Math.min(1.2, drag.current.rx + (e.clientY - drag.current.y) * 0.005),
    )
  }

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current.active = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={cn(
        'size-full touch-none cursor-grab select-none active:cursor-grabbing',
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={(e) => {
        hover.current = null
        endDrag(e)
      }}
    />
  )
}
