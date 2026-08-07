import { cn } from '@/lib/cn'

/**
 * THE SIGNATURE.
 *
 * A cadastral parcel plan — the single most characteristic artefact in a
 * surveyor's world. Irregular parcel polygons, boundary lines, corner
 * monuments, and bearing ticks, exactly as they appear on a subdivision plan
 * lodged with the Department of Lands and Survey.
 *
 * This deliberately replaces the uniform blueprint grid it started as. A
 * regular grid says "technical product" and could sit behind any SaaS
 * dashboard; a parcel plan says surveying and nothing else.
 *
 * Purely decorative — `aria-hidden`, and drawn below the 3:1 UI threshold so
 * it recedes behind content rather than competing with it.
 *
 * `animated` draws the boundaries on as if being plotted. Suppressed under
 * `prefers-reduced-motion` by the global rule in globals.css.
 */

/** A closed traverse of parcel boundaries, in a 0-1200 x 0-560 field. */
const PARCELS = [
  'M60,470 L60,300 L215,262 L268,392 L184,470 Z',
  'M215,262 L215,120 L392,96 L404,244 L268,392 Z',
  'M404,244 L392,96 L560,78 L596,220 Z',
  'M268,392 L404,244 L596,220 L604,372 L430,436 Z',
  'M184,470 L268,392 L430,436 L408,540 L196,540 Z',
  'M596,220 L560,78 L742,64 L790,196 Z',
  'M604,372 L596,220 L790,196 L826,340 L700,420 Z',
  'M430,436 L604,372 L700,420 L676,540 L408,540 Z',
  'M790,196 L742,64 L940,52 L982,180 Z',
  'M826,340 L790,196 L982,180 L1020,318 L910,392 Z',
  'M700,420 L826,340 L910,392 L886,540 L676,540 Z',
  'M982,180 L940,52 L1140,44 L1160,170 Z',
  'M1020,318 L982,180 L1160,170 L1176,310 Z',
  'M910,392 L1020,318 L1176,310 L1176,540 L886,540 Z',
]

/** Corner monuments — the points a surveyor physically sets on the ground. */
const MONUMENTS: Array<[number, number]> = [
  [215, 262], [404, 244], [268, 392], [596, 220], [604, 372],
  [430, 436], [790, 196], [826, 340], [700, 420], [982, 180],
  [1020, 318], [910, 392], [392, 96], [560, 78], [742, 64], [940, 52],
]

export function CadastralPlan({
  className,
  animated = false,
  dense = false,
}: {
  className?: string
  animated?: boolean
  /** Renders monuments and bearing ticks. Off for small or busy surfaces. */
  dense?: boolean
}) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 select-none overflow-hidden', className)}
      aria-hidden
    >
      <svg
        viewBox="0 0 1200 560"
        preserveAspectRatio="xMidYMid slice"
        className="size-full"
        role="presentation"
      >
        <defs>
          <linearGradient id="plan-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="70%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="plan-mask">
            <rect width="1200" height="560" fill="url(#plan-fade)" />
          </mask>
        </defs>

        <g mask="url(#plan-mask)">
          {/* Parcel boundaries */}
          <g
            fill="none"
            stroke="var(--color-surface-plan)"
            strokeWidth="1.25"
            strokeLinejoin="round"
            className={animated ? 'plan-draw' : undefined}
          >
            {PARCELS.map((d, i) => (
              <path
                key={i}
                d={d}
                style={animated ? { animationDelay: `${i * 55}ms` } : undefined}
              />
            ))}
          </g>

          {dense && (
            <>
              {/* Corner monuments — open circle with a centre dot, the
                  conventional cadastral symbol for a set boundary mark. */}
              <g className={animated ? 'plan-mark' : undefined}>
                {MONUMENTS.map(([x, y], i) => (
                  <g key={i} style={animated ? { animationDelay: `${700 + i * 40}ms` } : undefined}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill="none"
                      stroke="var(--color-surface-plan-strong)"
                      strokeWidth="1.25"
                    />
                    <circle cx={x} cy={y} r="1.25" fill="var(--color-surface-plan-strong)" />
                  </g>
                ))}
              </g>

              {/* A single triangulation station, the origin of the traverse.
                  One accent mark on the whole plan — the eye needs somewhere
                  to land, and more than one would be decoration. */}
              <g className={animated ? 'plan-station' : undefined}>
                <path
                  d="M596,220 m0,-13 l11.5,20 l-23,0 Z"
                  fill="none"
                  stroke="var(--color-surface-rule)"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                <circle cx="596" cy="220" r="1.75" fill="var(--color-surface-rule)" />
              </g>
            </>
          )}
        </g>
      </svg>
    </div>
  )
}
