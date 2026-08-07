import { notFound, redirect } from 'next/navigation'
import { Eye, EyeOff, FileText, Mail, MapPin, Phone } from 'lucide-react'

import { createTranslator, getDictionary, isLocale, type Locale } from '@/i18n/config'
import { formatDate } from '@/i18n/format'
import { getUserSession } from '@/lib/auth/server'
import { href } from '@/lib/routes'
import { getMemberProfile } from '@/lib/data/member'
import { getRepository } from '@/lib/data'
import { Card, Mono, Tag } from '@/components/ui/primitives'
import { DemoBanner, MemberPageHeader } from '@/components/features/member-ui'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const typed: Locale = locale
  const t = createTranslator(getDictionary(typed))

  const session = await getUserSession()
  if (!session) redirect(href(typed, 'login'))

  const profile = getMemberProfile(session.uid)
  const governorates = await getRepository().listGovernorates(typed)
  const governorate = governorates.find((g) => g.code === profile.governorateCode)

  return (
    <div>
      <MemberPageHeader title={t('member.profile')} />
      <DemoBanner label={t('member.demoNotice')} />

      {/* Directory consent — the single most important control on this page.
          Contact fields published here are SEPARATE from the contact of
          record, so a member can publish a work number without their personal
          one. docs/03-data-model.md §4. */}
      <Card
        className={`mb-4 flex items-start gap-3 p-5 ${
          profile.isDirectoryVisible
            ? 'border-status-active-border bg-status-active-bg'
            : 'border-border-default'
        }`}
      >
        <span className={profile.isDirectoryVisible ? 'text-status-active-fg' : 'text-text-muted'}>
          {profile.isDirectoryVisible ? (
            <Eye className="size-5" aria-hidden />
          ) : (
            <EyeOff className="size-5" aria-hidden />
          )}
        </span>
        <div>
          <p className="font-semibold text-text-primary">{t('member.directoryVisibility')}</p>
          <p className="mt-1 text-[length:var(--type-sm)] text-text-secondary">
            {profile.isDirectoryVisible
              ? t('member.directoryVisibleOn')
              : t('member.directoryVisibleOff')}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Field label={t('member.officeName')} value={profile.officeName[typed]} />
            <Field label={t('member.category')} value={t('member.officeOwner')} />
            <Field label={t('member.licenseNumber')} value={profile.licenseNumber} mono />
            <Field label={t('member.membershipNumber')} value={profile.membershipNumber} mono />
            {governorate && <Field label={t('member.governorate')} value={governorate.name} />}
            <Field label={t('member.memberSince')} value={formatDate(profile.joinedAt, typed)} numeric />
          </dl>

          <div className="mt-6 border-t border-border-subtle pt-6">
            <h3 className="mb-3 text-[length:var(--type-sm)] font-semibold text-text-muted">
              {t('member.specializations')}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {profile.specializations[typed].map((s) => (
                <li key={s}>
                  <Tag>{s}</Tag>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="mb-4 text-[length:var(--type-sm)] font-semibold text-text-muted">
              {t('member.directoryPhone')} · {t('member.directoryEmail')}
            </h3>
            <ul className="space-y-3 text-[length:var(--type-sm)]">
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-text-muted" aria-hidden />
                <span data-ltr>{profile.directoryPhone}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-text-muted" aria-hidden />
                <span data-ltr>{profile.directoryEmail}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
                <span className="text-text-secondary">{profile.directoryAddress[typed]}</span>
              </li>
            </ul>
          </Card>

          <Card className="p-6">
            <h3 className="flex items-center gap-2 text-[length:var(--type-sm)] font-semibold text-text-primary">
              <FileText className="size-4 text-text-brand" aria-hidden />
              {t('member.documents')}
            </h3>
            <p className="mt-2 text-[length:var(--type-xs)] leading-relaxed text-text-muted">
              {t('member.documentsHint')}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  mono,
  numeric,
}: {
  label: string
  value: string
  mono?: boolean
  numeric?: boolean
}) {
  return (
    <div>
      <dt className="text-[length:var(--type-xs)] text-text-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-text-primary">
        {mono ? <Mono>{value}</Mono> : numeric ? <span data-numeric>{value}</span> : value}
      </dd>
    </div>
  )
}
