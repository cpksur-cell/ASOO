import { cn } from '@/lib/cn'

/**
 * THE HERO SIGNATURE — a geodetic globe.
 *
 * Geodesy is the science of measuring the Earth, and this syndicate's members
 * are the people who do it. So the hero is not a stock illustration: it is the
 * profession's own drawing language.
 *
 *   · GRATICULE — the meridians and parallels every geodetic survey is
 *     referenced to. The meridians sweep, so the sphere turns.
 *   · TRIANGULATION NETWORK — the classical method of fixing position over a
 *     large area: a chain of triangles observed between visible stations. It
 *     draws on leg by leg, the way a network is actually observed.
 *   · THE OCCUPIED STATION — one accent mark at Jordan's position, with a
 *     range ring radiating out of it. Every other mark on the drawing is
 *     neutral; the eye lands on Amman, which is the point of the whole thing.
 *
 * Decorative and `aria-hidden` — the heading beside it carries the meaning.
 * Everything is inline SVG (no image request, so it costs the LCP nothing) and
 * animates on transform/opacity only. `prefers-reduced-motion` resolves it to
 * a still wireframe globe via the rules in globals.css.
 */

const R = 150
const CX = 200
const CY = 200

/**
 * Meridian half-widths. Each is |cos φ| · R for a longitude spaced 30° apart,
 * so a still globe already reads correctly — the animation only sets them in
 * motion. Phases deliberately avoid 90°, where the ellipse would collapse to a
 * degenerate zero-width line.
 */
const MERIDIANS = [
  { rx: R * 0.966, delay: '0s' },
  { rx: R * 0.707, delay: '-3.5s' },
  { rx: R * 0.259, delay: '-7s' },
  { rx: R * 0.259, delay: '-10.5s' },
  { rx: R * 0.707, delay: '-14s' },
  { rx: R * 0.966, delay: '-17.5s' },
]

/** Parallels — latitude circles. Fixed under rotation about the polar axis. */
const PARALLELS = [
  { dy: -R * 0.78, rx: R * 0.62, ry: R * 0.12 },
  { dy: -R * 0.44, rx: R * 0.9, ry: R * 0.16 },
  { dy: 0, rx: R, ry: R * 0.2 },
  { dy: R * 0.44, rx: R * 0.9, ry: R * 0.16 },
  { dy: R * 0.78, rx: R * 0.62, ry: R * 0.12 },
]

/**
 * Triangulation stations on the visible face, and the legs observed between
 * them. Positions are hand-placed to sit convincingly on the sphere rather
 * than being projected — this is a portrait of a network, not a dataset.
 */
const STATIONS: Array<[number, number]> = [
  [140, 118],
  [252, 108],
  [306, 192],
  [196, 196],
  [100, 208],
  [268, 288],
  [158, 300],
]

const LEGS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [0, 4], [3, 4], [2, 5], [3, 5],
  [4, 6], [5, 6], [3, 6],
]

/** Jordan's approximate position on this face — the occupied station. */
const AMMAN: [number, number] = [196, 196]

export function GeodeticGlobe({
  className,
  animated = true,
}: {
  className?: string
  animated?: boolean
}) {
  return (
    <div className={cn('pointer-events-none select-none', className)} aria-hidden>
      <svg
        viewBox="0 0 400 400"
        className="size-full overflow-visible"
        role="presentation"
      >
        <defs>
          {/* Depth: the sphere is lit from the inline-start, so the limb falls
              away rather than reading as a flat disc. */}
          <radialGradient id="globe-body" cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="var(--color-surface-brand-subtle)" stopOpacity="0.85" />
            <stop offset="65%" stopColor="var(--color-surface-brand-subtle)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-surface-brand)" stopOpacity="0.08" />
          </radialGradient>

          {/* Clips the graticule to the sphere so no line escapes the limb. */}
          <clipPath id="globe-clip">
            <circle cx={CX} cy={CY} r={R} />
          </clipPath>

          {/* The network fades toward the limb, as detail does with curvature. */}
          <radialGradient id="net-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="72%" stopColor="white" stopOpacity="0.85" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="net-mask">
            <circle cx={CX} cy={CY} r={R} fill="url(#net-fade)" />
          </mask>
        </defs>

        {/* ---------------------------------------------------------- body */}
        <circle cx={CX} cy={CY} r={R} fill="url(#globe-body)" />

        {/* ----------------------------------------------------- graticule */}
        <g clipPath="url(#globe-clip)">
          <g
            fill="none"
            stroke="var(--color-surface-plan)"
            strokeWidth="1"
            opacity="0.9"
          >
            {PARALLELS.map((p, i) => (
              <ellipse key={`p${i}`} cx={CX} cy={CY + p.dy} rx={p.rx} ry={p.ry} />
            ))}
          </g>

          <g fill="none" stroke="var(--color-surface-plan)" strokeWidth="1" opacity="0.9">
            {MERIDIANS.map((m, i) => (
              <ellipse
                key={`m${i}`}
                cx={CX}
                cy={CY}
                rx={m.rx}
                ry={R}
                className={animated ? 'globe-meridian' : undefined}
                style={animated ? { animationDelay: m.delay } : undefined}
              />
            ))}
          </g>

          {/* The polar axis — the reference every meridian is measured from. */}
          <line
            x1={CX}
            y1={CY - R}
            x2={CX}
            y2={CY + R}
            stroke="var(--color-surface-plan-strong)"
            strokeWidth="1"
            opacity="0.55"
          />
        </g>

        {/* The limb. Slightly stronger than the graticule so the sphere has a
            definite edge instead of dissolving. */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="var(--color-surface-plan-strong)"
          strokeWidth="1.25"
        />

        {/* ------------------------------------------ triangulation network */}
        <g mask="url(#net-mask)">
          {/*
            Deliberately NEUTRAL, not the accent. The network is context; the
            occupied station at Amman is the subject. Drawing the legs in the
            accent as well would give the eye seven equal places to land and
            the composition would say nothing.
          */}
          <g
            className={animated ? 'net-draw' : undefined}
            stroke="var(--color-surface-plan-strong)"
            strokeWidth="1.1"
            fill="none"
            opacity="0.7"
          >
            {LEGS.map(([a, b], i) => (
              <line
                key={`l${i}`}
                x1={STATIONS[a]![0]}
                y1={STATIONS[a]![1]}
                x2={STATIONS[b]![0]}
                y2={STATIONS[b]![1]}
                style={animated ? { animationDelay: `${300 + i * 90}ms` } : undefined}
              />
            ))}
          </g>

          {/* Stations: the conventional open circle with a centre dot. */}
          <g>
            {STATIONS.map(([x, y], i) => (
              <g key={`s${i}`}>
                <circle
                  cx={x}
                  cy={y}
                  r="3.4"
                  fill="var(--color-surface-default)"
                  stroke="var(--color-surface-plan-strong)"
                  strokeWidth="1.2"
                />
                <circle cx={x} cy={y} r="1.1" fill="var(--color-surface-plan-strong)" />
              </g>
            ))}
          </g>
        </g>

        {/* --------------------------------------------- occupied station */}
        {/* Amman. The one accent mark on the drawing. */}
        <g>
          {animated && (
            <circle
              cx={AMMAN[0]}
              cy={AMMAN[1]}
              r="10"
              fill="none"
              stroke="var(--color-surface-accent)"
              strokeWidth="1.5"
              className="station-ping"
            />
          )}
          {/* The triangulation-station symbol: triangle over the point. */}
          <path
            d={`M${AMMAN[0]},${AMMAN[1] - 11} l9.5,16.5 l-19,0 Z`}
            fill="var(--color-surface-default)"
            stroke="var(--color-surface-accent)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx={AMMAN[0]} cy={AMMAN[1]} r="2" fill="var(--color-surface-accent)" />
        </g>
      </svg>
    </div>
  )
}
