'use client'

import type { ReactNode, ElementType } from 'react'
import { motion } from 'framer-motion'

import { revealUp, staggerGroup, staggerItem, inView } from '@/lib/motion'
import { cn } from '@/lib/cn'

/**
 * Scroll-triggered reveal. `prefers-reduced-motion` is handled globally in
 * globals.css, which collapses every transition — these components do not
 * each re-implement the check.
 */
export function Reveal({
  children,
  className,
  as = 'div',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  as?: ElementType
  delay?: number
}) {
  const Comp = motion[as as 'div'] ?? motion.div
  return (
    <Comp
      variants={revealUp}
      initial="hidden"
      whileInView="visible"
      viewport={inView}
      transition={{ delay }}
      className={className}
    >
      {children}
    </Comp>
  )
}

/** Parent of a staggered grid or list. Children must be `<RevealItem>`. */
export function RevealGroup({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'ul' | 'ol'
}) {
  const Comp = Tag === 'ul' ? motion.ul : Tag === 'ol' ? motion.ol : motion.div
  return (
    <Comp
      variants={staggerGroup}
      initial="hidden"
      whileInView="visible"
      viewport={inView}
      className={className}
    >
      {children}
    </Comp>
  )
}

export function RevealItem({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li'
}) {
  const Comp = Tag === 'li' ? motion.li : motion.div
  return (
    <Comp variants={staggerItem} className={cn('h-full', className)}>
      {children}
    </Comp>
  )
}
