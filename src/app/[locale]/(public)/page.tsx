import { notFound } from 'next/navigation'

import { isLocale } from '@/i18n/config'
import { getRepository } from '@/lib/data'
import { BlockRenderer } from '@/components/blocks/blocks'

/**
 * The homepage is composed, not templated — an ordered list of typed blocks
 * across two regions. `aside` collapses below `main` on mobile.
 * docs/09-cms.md
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const blocks = await getRepository().getLayoutBlocks('homepage', locale)
  const main = blocks.filter((b) => b.region === 'main')
  const aside = blocks.filter((b) => b.region === 'aside')

  // The hero spans full width above the two-column split.
  const [hero, ...restMain] = main
  const hasAside = aside.length > 0

  return (
    <>
      {hero && <BlockRenderer block={hero} locale={locale} />}

      {hasAside ? (
        <div className="container-page grid gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 [&>section]:px-0 [&>section]:max-w-none">
            {restMain.map((block) => (
              <BlockRenderer key={block.id} block={block} locale={locale} />
            ))}
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {aside.map((block) => (
              <BlockRenderer key={block.id} block={block} locale={locale} />
            ))}
          </aside>
        </div>
      ) : (
        restMain.map((block) => (
          <BlockRenderer key={block.id} block={block} locale={locale} />
        ))
      )}
    </>
  )
}
