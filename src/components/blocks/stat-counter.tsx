'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'

/** useLayoutEffect warns during SSR; fall back to useEffect on the server. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Count-up on scroll.
 *
 * Honours `prefers-reduced-motion` explicitly rather than relying on the
 * global CSS override — this is a JS-driven value change, not a CSS
 * transition, so the stylesheet cannot collapse it. With reduced motion the
 * final value renders immediately.
 */
export function CountUp({ value, suffix = '' }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const reduced = useReducedMotion()

  const target = Number.parseInt(value.replace(/\D/g, ''), 10)
  const numeric = Number.isFinite(target)

  // Initial state is the REAL value, so the server-rendered HTML contains
  // "450" and not "0". Crawlers, no-JS users, and the pre-hydration paint all
  // see the true figure. The reset to zero happens on the client, before
  // paint, only when the animation is actually going to run.
  const [display, setDisplay] = useState(target)

  useIsomorphicLayoutEffect(() => {
    if (numeric && !reduced) setDisplay(0)
  }, [numeric, reduced])

  useEffect(() => {
    if (!numeric || reduced || !inView) return

    const durationMs = 1100
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      // ease-out cubic — decisive start, soft settle
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(target * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, numeric, reduced, target])

  if (!numeric) {
    return (
      <span ref={ref} data-numeric>
        {value}
        {suffix}
      </span>
    )
  }

  return (
    <span ref={ref} data-numeric aria-label={`${target}${suffix}`}>
      <span aria-hidden>
        {display.toLocaleString('en-US')}
        {suffix}
      </span>
    </span>
  )
}
