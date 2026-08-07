import { notFound, redirect } from 'next/navigation'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { can } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { listStoredMembers } from '@/lib/data/store'
import { getRepository } from '@/lib/data'
import { MembersManager, type MembersLabels } from './members-manager'

export default async function AdminMembersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale

  if (!(await can('members', 'read'))) {
    redirect(href(typed, 'admin'))
  }

  const t = createTranslator(getDictionary(typed))
  const canSuspend = await can('members', 'suspend')

  const governorates = await getRepository().listGovernorates(typed)
  const govName = new Map(governorates.map((g) => [g.code, g.name]))

  const members = listStoredMembers().map((m) => ({
    id: m.id,
    licenseNumber: m.licenseNumber,
    membershipNumber: m.membershipNumber,
    status: m.status,
    fullName: m.fullName[typed],
    officeName: m.officeName[typed],
    governorate: govName.get(m.governorateCode) ?? m.governorateCode,
  }))

  const labels: MembersLabels = {
    title: t('admin.membersTitle'),
    intro: t('admin.membersIntro'),
    demoNotice: t('admin.demoDataNotice'),
    search: t('admin.searchMembers'),
    allStatuses: t('admin.allStatuses'),
    statusActive: t('admin.mStatusActive'),
    statusSuspended: t('admin.mStatusSuspended'),
    statusExpired: t('admin.mStatusExpired'),
    statusWithdrawn: t('admin.mStatusWithdrawn'),
    colName: t('admin.memberName'),
    colOffice: t('admin.memberOffice'),
    colLicense: t('admin.memberLicense'),
    colGov: t('admin.memberGov'),
    colStatus: t('admin.status'),
    colActions: t('admin.actions'),
    suspend: t('admin.suspend'),
    reactivate: t('admin.reactivate'),
    suspendTitle: t('admin.suspendTitle'),
    suspendReason: t('admin.suspendReason'),
    suspendReasonHint: t('admin.suspendReasonHint'),
    reasonRequired: t('admin.reasonRequired'),
    confirmSuspend: t('admin.confirmSuspend'),
    cancel: t('admin.cancel'),
    suspended: t('admin.memberSuspended'),
    reactivated: t('admin.memberReactivated'),
    noPermission: t('admin.noPermission'),
    saveFailed: t('admin.saveFailed'),
    empty: t('admin.noMembers'),
    // A template with a {count} placeholder — a function cannot cross the
    // server→client boundary, so the client interpolates it.
    resultsCountTemplate: t('admin.resultsCount', { count: '{count}' }),
  }

  return <MembersManager labels={labels} members={members} canSuspend={canSuspend} />
}
