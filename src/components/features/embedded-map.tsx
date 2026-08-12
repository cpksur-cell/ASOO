import { ExternalLink, Map } from 'lucide-react'

import { Card } from '@/components/ui/primitives'

/**
 * A syndicate map published on Google My Maps.
 *
 * Points worth knowing about embedding someone else's frame on a government
 * site:
 *
 *   · `title` is REQUIRED, not decorative. An iframe without one is announced
 *     as "frame" and nothing else, which makes the page unusable with a screen
 *     reader (WCAG 4.1.2).
 *   · `loading="lazy"` keeps two third-party frames off the critical path —
 *     they are below the fold and must not delay the page's own paint.
 *   · The aspect-ratio box reserves the space before the frame loads, so
 *     nothing below it jumps when it does (ui-ux-pro-max §3 `content-jumping`).
 *   · `referrerPolicy` withholds the full URL from the embed, and the sandbox
 *     grants only what a map needs — scripts and same-origin for its own tiles
 *     and popups. Notably NOT `allow-top-navigation`, so the frame cannot
 *     redirect the visitor away from the syndicate's site.
 *   · A direct link is always offered underneath: an embed that fails to load,
 *     or is blocked by a corporate network, must not be a dead end.
 */
export function EmbeddedMap({
  src,
  title,
  hint,
  openLabel,
  openHref,
}: {
  src: string
  title: string
  hint: string
  openLabel: string
  openHref: string
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
        <h3 className="inline-flex items-center gap-2 text-[length:var(--type-base)] font-semibold text-text-primary">
          <Map className="size-4 text-text-accent" aria-hidden />
          {title}
        </h3>
        <a
          href={openHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-[length:var(--type-sm)] font-medium text-text-brand hover:underline"
        >
          {openLabel}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>

      <div className="relative aspect-[4/3] w-full bg-surface-sunken sm:aspect-[16/10]">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="absolute inset-0 size-full border-0"
        />
      </div>

      <p className="border-t border-border-subtle p-3 text-[length:var(--type-xs)] text-text-muted">
        {hint}
      </p>
    </Card>
  )
}
