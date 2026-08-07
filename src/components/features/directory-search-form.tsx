'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

import { createTranslator, getDictionaryClient, type Locale } from '@/i18n/client'
import type { Governorate } from '@/lib/data'

/**
 * A plain GET form. Search state lives in the URL, so results are
 * shareable, bookmarkable, back-button correct, and server-rendered —
 * which matters because the directory is this site's highest-value
 * indexable surface.
 */
export function DirectorySearchForm({
  locale,
  governorates,
  action,
  defaultQuery = '',
  defaultGovernorate = 'all',
}: {
  locale: Locale
  governorates: Governorate[]
  action: string
  defaultQuery?: string
  defaultGovernorate?: string
}) {
  const t = createTranslator(getDictionaryClient(locale))
  const [q, setQ] = useState(defaultQuery)

  return (
    <form method="get" action={action} className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <label htmlFor="directory-q" className="sr-only">
          {t('directory.searchPlaceholder')}
        </label>
        <Search
          className="pointer-events-none absolute inset-inline-start-3.5 top-1/2 size-5 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          id="directory-q"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('directory.searchPlaceholder')}
          className="h-12 w-full rounded-md border border-border-default bg-surface-default ps-11 pe-4 text-[length:var(--type-base)] text-text-primary placeholder:text-text-muted focus:border-border-focus"
        />
      </div>

      {governorates.length > 0 && (
        <div className="sm:w-56">
          <label htmlFor="directory-gov" className="sr-only">
            {t('directory.governorate')}
          </label>
          <select
            id="directory-gov"
            name="governorate"
            defaultValue={defaultGovernorate}
            className="h-12 w-full rounded-md border border-border-default bg-surface-default px-3.5 text-[length:var(--type-base)] text-text-primary focus:border-border-focus"
          >
            <option value="all">{t('common.all')}</option>
            {governorates.map((g) => (
              <option key={g.id} value={g.code}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-surface-brand px-6 font-medium text-text-on-brand transition-colors duration-[120ms] hover:bg-primary-600 active:scale-[0.985]"
      >
        <Search className="size-4" aria-hidden />
        {t('common.search')}
      </button>
    </form>
  )
}
