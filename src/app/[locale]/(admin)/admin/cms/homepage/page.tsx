import { notFound, redirect } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { can } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { listStoredBlocks } from '@/lib/data/store'
import { listBlocks as listCmsBlocks } from '@/lib/data/cms-admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { HomepageComposer, type ComposerLabels } from './homepage-composer'

export default async function HomepageComposerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  // Layer 2, scoped to THIS screen. The layout only established that the
  // visitor is staff; a support agent is staff and still may not be here.
  if (!(await can('layout', 'manage'))) {
    redirect(href(typed, 'admin'))
  }

  const t = createTranslator(getDictionary(typed))

  const labels: ComposerLabels = {
    title: t('admin.homepageTitle'),
    intro: t('admin.homepageIntro'),
    // Blank once the screen is backed by Postgres. This banner went on
    // claiming the CMS was unwired after it had been wired — a stale
    // reassurance the UI repeats to every editor is worse than no banner.
    demoNotice: isSupabaseConfigured() ? '' : t('admin.demoDataNotice'),
    blocks: t('admin.blocks'),
    moveUp: t('admin.moveUp'),
    moveDown: t('admin.moveDown'),
    edit: t('admin.edit'),
    save: t('admin.save'),
    cancel: t('admin.cancel'),
    close: t('admin.close'),
    show: t('admin.show'),
    hide: t('admin.hide'),
    visible: t('admin.blockVisible'),
    hidden: t('admin.blockHidden'),
    heading: t('admin.heading'),
    body: t('admin.body'),
    saved: t('admin.saved'),
    saveFailed: t('admin.saveFailed'),
    noPermission: t('admin.noPermission'),
    invalidInput: t('admin.invalidInput'),
    empty: t('admin.empty'),
  }

  // The composer edits the same rows the public homepage renders, so with
  // Supabase configured it must load from there — reading the demo store here
  // is what made the composer a sandbox in the first place.
  const initialBlocks = isSupabaseConfigured()
    ? await listCmsBlocks(typed)
    : listStoredBlocks()

  return <HomepageComposer labels={labels} initialBlocks={initialBlocks} locale={typed} />
}
