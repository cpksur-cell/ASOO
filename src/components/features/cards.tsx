import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, BadgeCheck, Building2, CalendarDays, ExternalLink,
  FileText, MapPin, Paperclip,
} from 'lucide-react'

import { createTranslator, getDictionary, type Locale } from '@/i18n/config'
import { formatDate, formatDateISO, formatFileSize } from '@/i18n/format'
import { href } from '@/lib/routes'
import { cn } from '@/lib/cn'
import { Card, Mono, StatusBadge, Tag } from '@/components/ui/primitives'
import type { DirectoryMember, ExternalLink as LinkModel, Post, SyndicateDocument } from '@/lib/data'
import { Icon } from './icon'

/* ------------------------------------------------------------------- news */

export function NewsCard({
  post,
  locale,
  variant = 'card',
}: {
  post: Post
  locale: Locale
  variant?: 'card' | 'row'
}) {
  const t = createTranslator(getDictionary(locale))
  const url = href(locale, `news/${post.slug}`)

  if (variant === 'row') {
    const imageSrc = post.featuredImage || '/images/news/assembly-meeting.png'

    return (
      <article className="group relative flex items-start gap-3.5 sm:gap-4 border-b border-border-subtle pb-4 last:border-0 last:pb-0">
        <div className="relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-xl border border-border-subtle/80 bg-surface-sunken shadow-xs">
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 80px, 96px"
          />
        </div>

        <div className="flex flex-1 min-w-0 flex-col">
          <time
            dateTime={formatDateISO(post.publishedAt)}
            className="text-[length:var(--type-xs)] font-medium text-text-muted"
            data-numeric
          >
            {formatDate(post.publishedAt, locale)}
          </time>
          <h3 className="mt-1 text-[length:var(--type-base)] font-bold leading-snug tracking-tight">
            <Link
              href={url}
              className="text-text-primary transition-colors group-hover:text-text-brand"
            >
              <span className="absolute inset-0" aria-hidden />
              {post.title}
            </Link>
          </h3>
          <p className="mt-1 line-clamp-2 text-[length:var(--type-xs)] sm:text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
            {post.excerpt}
          </p>
        </div>
      </article>
    )
  }

  return (
    <Card interactive className="group flex h-full flex-col p-5 overflow-hidden">
      {post.featuredImage && (
        <div className="relative -mx-5 -mt-5 mb-4 aspect-[16/10] overflow-hidden border-b border-border-subtle bg-surface-sunken">
          <Image
            src={post.featuredImage}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        {post.category && <Tag>{post.category.name}</Tag>}
        <time
          dateTime={formatDateISO(post.publishedAt)}
          className="inline-flex items-center gap-1.5 text-[length:var(--type-xs)] text-text-muted"
        >
          <CalendarDays className="size-3.5" aria-hidden />
          <span data-numeric>{formatDate(post.publishedAt, locale)}</span>
        </time>
      </div>

      <h3 className="mt-3 text-[length:var(--type-lg)] font-semibold leading-snug">
        <Link href={url} className="text-text-primary transition-colors group-hover:text-text-brand">
          <span className="absolute inset-0" aria-hidden />
          {post.title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 flex-1 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
        {post.excerpt}
      </p>

      <span className="mt-4 inline-flex items-center gap-1.5 text-[length:var(--type-sm)] font-medium text-text-brand">
        {t('common.readMore')}
        <ArrowLeft
          className="size-4 transition-transform duration-[120ms] group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
          data-mirror="true"
          aria-hidden
        />
      </span>
    </Card>
  )
}

/* -------------------------------------------------------------- documents */

export function DocumentCard({
  document: doc,
  locale,
}: {
  document: SyndicateDocument
  locale: Locale
}) {
  const t = createTranslator(getDictionary(locale))
  const url = doc.fileUrl ?? doc.externalUrl
  const available = Boolean(url)

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-brand-subtle text-text-brand">
          <FileText className="size-5" aria-hidden />
        </span>
        <Tag>{doc.category.name}</Tag>
      </div>

      <h3 className="mt-4 text-[length:var(--type-base)] font-semibold leading-snug text-text-primary">
        {doc.title}
      </h3>

      {doc.description && (
        <p className="mt-2 flex-1 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
          {doc.description}
        </p>
      )}

      {doc.officialReference && (
        <p className="mt-3 text-[length:var(--type-xs)] text-text-muted">
          {t('documents.reference')}: <Mono>{doc.officialReference}</Mono>
        </p>
      )}

      <div className="mt-4 border-t border-border-subtle pt-4">
        {available ? (
          <a
            href={url!}
            className="inline-flex min-h-11 items-center gap-2 text-[length:var(--type-sm)] font-medium text-text-brand hover:underline"
            {...(doc.externalUrl ? { target: '_blank', rel: 'noopener noreferrer' } : { download: true })}
          >
            <Paperclip className="size-4" aria-hidden />
            {t('common.download')}
            {doc.fileSize && (
              <span className="text-text-muted">({formatFileSize(doc.fileSize, locale)})</span>
            )}
          </a>
        ) : (
          /* Honest about the real state: the syndicate has not supplied these
             files. Offering a download that 404s is worse than saying so. */
          <p className="inline-flex min-h-11 items-center gap-2 text-[length:var(--type-sm)] text-text-muted">
            <MapPin className="size-4" aria-hidden />
            {t('documents.atOffice')}
          </p>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------- gov  links */

export function GovLinkCard({ link, locale }: { link: LinkModel; locale: Locale }) {
  const t = createTranslator(getDictionary(locale))
  const insecure = link.url.startsWith('http://')

  return (
    <Card interactive className="group relative flex h-full flex-col p-5">
      <span className="flex size-11 items-center justify-center rounded-md border border-border-subtle bg-surface-brand-subtle text-text-brand transition-colors group-hover:border-accent-300 group-hover:bg-surface-accent-subtle group-hover:text-text-accent">
        <Icon name={link.icon} className="size-5" />
      </span>

      <h3 className="mt-4 text-[length:var(--type-base)] font-semibold leading-snug text-text-primary">
        <a href={link.url} target="_blank" rel="noopener noreferrer">
          <span className="absolute inset-0" aria-hidden />
          {link.title}
        </a>
      </h3>

      <p className="mt-2 flex-1 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
        {link.description}
      </p>

      <span className="mt-4 inline-flex items-center gap-1.5 text-[length:var(--type-sm)] font-medium text-text-brand">
        {t('common.openLink')}
        <ExternalLink className="size-3.5" aria-hidden />
      </span>
      <span className="sr-only">{t('common.externalLink')}</span>

      {insecure && (
        /* Surfaced deliberately — this is a government portal served over
           plain HTTP. See design/content-inventory.md. */
        <span className="mt-2 inline-flex items-center gap-1 text-[length:var(--type-xs)] text-status-warning-fg">
          HTTP
        </span>
      )}
    </Card>
  )
}

/* ---------------------------------------------------------------- members */

export function MemberCard({
  member,
  locale,
}: {
  member: DirectoryMember
  locale: Locale
}) {
  const t = createTranslator(getDictionary(locale))

  return (
    <Card interactive className="group relative flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-brand-subtle text-text-brand">
          <Building2 className="size-5" aria-hidden />
        </span>
        <StatusBadge tone="active" icon={<BadgeCheck />}>
          {t('status.active')}
        </StatusBadge>
      </div>

      <h3 className="mt-4 text-[length:var(--type-lg)] font-semibold leading-snug text-text-primary">
        <Link href={href(locale, `directory/${member.slug}`)}>
          <span className="absolute inset-0" aria-hidden />
          {member.fullName}
        </Link>
      </h3>

      {member.officeName && (
        <p className="mt-1 text-[length:var(--type-sm)] text-text-secondary">
          {member.officeName}
        </p>
      )}

      <dl className="mt-4 flex-1 space-y-2 text-[length:var(--type-sm)]">
        {/*
          Show whichever identifier the syndicate actually holds. A member from
          the roster has a membership number but no DLS licence yet, and
          labelling a membership number as a licence number would be wrong.
        */}
        <div className="flex items-center gap-2">
          <dt className="text-text-muted">
            {member.licenseNumber ? t('directory.licenseNumber') : t('directory.membershipNumber')}:
          </dt>
          <dd>
            <Mono className="font-medium text-text-primary">
              {member.licenseNumber ?? member.membershipNumber}
            </Mono>
          </dd>
        </div>
        {member.governorate && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">{t('directory.governorate')}</dt>
            <dd className="inline-flex items-center gap-1.5 text-text-secondary">
              <MapPin className="size-4 text-text-muted" aria-hidden />
              {member.governorate.name}
            </dd>
          </div>
        )}
      </dl>

      {member.specializations.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-4">
          {member.specializations.map((s) => (
            <li key={s}>
              <Tag>{s}</Tag>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* --------------------------------------------------------------- services */

export function ServiceCard({
  icon,
  title,
  description,
  url,
}: {
  icon: string
  title: string
  description: string
  url: string
}) {
  return (
    <Card
      interactive
      className={cn(
        'group relative flex h-full flex-col p-5',
        'hover:-translate-y-0.5 transition-transform duration-[160ms]',
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-md border border-border-subtle bg-surface-default text-text-brand transition-colors group-hover:border-accent-300 group-hover:bg-surface-accent-subtle group-hover:text-text-accent">
        <Icon name={icon} className="size-5" />
      </span>
      <h3 className="mt-4 text-[length:var(--type-base)] font-semibold text-text-primary">
        <Link href={url}>
          <span className="absolute inset-0" aria-hidden />
          {title}
        </Link>
      </h3>
      <p className="mt-2 text-[length:var(--type-sm)] leading-[var(--leading-body)] text-text-secondary">
        {description}
      </p>
    </Card>
  )
}
