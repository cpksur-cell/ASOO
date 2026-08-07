import { notFound, redirect } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { can } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { listStoredPosts } from '@/lib/data/store'
import { NewsManager, type NewsLabels } from './news-manager'

/**
 * Server shell: resolves the locale, loads the posts, and hands the client
 * component fully-translated labels. No literal string crosses this boundary,
 * and the initial data is server-rendered rather than fetched on mount — the
 * table is populated on first paint instead of flashing a spinner.
 */
export default async function AdminNewsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  // Layer 2, scoped to THIS screen. The layout only established that the
  // visitor is staff; a support agent is staff and still may not be here.
  if (!(await can('posts', 'write'))) {
    redirect(href(typed, 'admin'))
  }

  const t = createTranslator(getDictionary(typed))

  const labels: NewsLabels = {
    title: t('admin.newsTitle'),
    intro: t('admin.newsIntro'),
    demoNotice: t('admin.demoDataNotice'),
    newPost: t('admin.newPost'),
    editPost: t('admin.editPost'),
    colTitle: t('admin.title'),
    colCategory: t('admin.category'),
    colDate: t('admin.date'),
    colStatus: t('admin.status'),
    colActions: t('admin.actions'),
    edit: t('admin.edit'),
    archive: t('admin.archive'),
    archiveConfirmTitle: t('admin.archiveConfirmTitle'),
    archiveConfirmBody: t('admin.archiveConfirmBody'),
    confirmArchive: t('admin.confirmArchive'),
    cancel: t('admin.cancel'),
    save: t('admin.save'),
    close: t('admin.close'),
    published: t('admin.published'),
    draft: t('admin.draft'),
    scheduled: t('admin.scheduled'),
    slug: t('admin.slug'),
    slugHint: t('admin.slugHint'),
    excerpt: t('admin.excerpt'),
    image: t('admin.image'),
    saved: t('admin.saved'),
    saveFailed: t('admin.saveFailed'),
    noPermission: t('admin.noPermission'),
    invalidInput: t('admin.invalidInput'),
    empty: t('admin.empty'),
  }

  return <NewsManager labels={labels} initialPosts={listStoredPosts()} locale={typed} />
}
