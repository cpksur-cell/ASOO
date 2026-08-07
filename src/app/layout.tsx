import type { ReactNode } from 'react'
import './globals.css'

/**
 * The root layout is intentionally minimal — `lang` and `dir` cannot be set
 * here because the locale is not known until the [locale] segment. They are
 * set in src/app/[locale]/layout.tsx.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
