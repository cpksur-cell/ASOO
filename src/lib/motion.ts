import type { Variants, Transition } from 'framer-motion'

/**
 * Motion vocabulary. Every animation in the system comes from here.
 *
 * Rules this encodes (ui-ux-pro-max §7):
 *   - 150–300ms for micro-interactions, ≤400ms for transitions
 *   - exit is ~65% of enter duration, so dismissal feels responsive
 *   - transform and opacity only — never width/height/top/left
 *   - stagger 30–50ms per item
 *   - motion expresses cause and effect, never decoration
 *
 * `prefers-reduced-motion` is honoured globally in globals.css, which collapses
 * every transition to ~0ms. Components do not each re-implement that check.
 */

export const duration = {
  fast: 0.12,
  normal: 0.2,
  slow: 0.32,
  /** Exit ≈ 65% of enter. */
  exit: 0.13,
} as const

/** Material-style emphasis curve. Decisive start, soft settle. */
export const ease = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
} as const

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
  mass: 0.8,
}

/* ------------------------------------------------------------------ shared */

/**
 * Section reveal on scroll. Rises 16px — enough to read as arrival, small
 * enough that it never looks like the page is assembling itself.
 */
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: ease.decelerate },
  },
}

/** Parent of a staggered group. Children use `staggerItem`. */
export const staggerGroup: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.045, delayChildren: 0.05 },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: ease.decelerate },
  },
}

/**
 * Direction-aware slide, for drawers and sheets.
 * RTL flips the axis — a drawer must always enter from the inline-start edge.
 */
export function slideIn(dir: 'rtl' | 'ltr'): Variants {
  const from = dir === 'rtl' ? '100%' : '-100%'
  return {
    hidden: { x: from, opacity: 0.6 },
    visible: {
      x: 0,
      opacity: 1,
      transition: { duration: duration.slow, ease: ease.decelerate },
    },
    exit: {
      x: from,
      opacity: 0.6,
      transition: { duration: duration.exit, ease: ease.accelerate },
    },
  }
}

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.normal, ease: ease.decelerate },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: duration.exit, ease: ease.accelerate },
  },
}

/** Press feedback. Subtle — 0.97 reads as tactile, 0.9 reads as broken. */
export const pressable = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.985 },
  transition: springSoft,
} as const

/** Shared viewport config so every scroll reveal fires at the same threshold. */
export const inView = { once: true, amount: 0.25, margin: '0px 0px -80px 0px' } as const
