import { notFound, redirect } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { can } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { listStoredBlocks } from '@/lib/data/store'
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
    demoNotice: t('admin.demoDataNotice'),
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

  return <HomepageComposer labels={labels} initialBlocks={listStoredBlocks()} />
}
