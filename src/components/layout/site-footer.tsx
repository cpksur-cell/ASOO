import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'

import { getDictionary, createTranslator, type Locale } from '@/i18n/config'
import { href, footerNav } from '@/lib/routes'
import { contact } from '@/lib/site'
import { getRepository } from '@/lib/data'
import { StationMark } from '@/components/ui/station-mark'

const columnLabels: Record<keyof typeof footerNav, string> = {
  syndicate: 'footer.syndicate',
  services: 'footer.services',
  content: 'footer.content',
  legal: 'footer.legal',
}

const linkLabels: Record<string, string> = {
  about: 'nav.about', board: 'nav.board', history: 'nav.history', contact: 'nav.contact',
  payBill: 'services.payTitle', verify: 'services.verifyTitle', join: 'nav.join', login: 'nav.login',
  news: 'nav.news', documents: 'nav.documents', maps: 'nav.maps', directory: 'nav.directory',
  privacy: 'footer.privacy', terms: 'footer.terms', accessibility: 'footer.accessibility',
}

/**
 * Topographic contour lines — the transition between the page content and the
 * footer. Drawn as actual survey contour lines flowing across the full width,
 * a visual that immediately says "land survey" to anyone in the profession.
 * Replaces the minimal traverse dots with a richer visual statement.
 */
function TopographicDivider() {
  return (
    <div className="relative h-20 w-full overflow-hidden md:h-28" aria-hidden>
      {/* Gradient wash from page background into footer */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface-inverse" />

      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        role="presentation"
      >
        <defs>
          <linearGradient id="topo-fade-l" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-accent-300)" stopOpacity="0.08" />
            <stop offset="20%" stopColor="var(--color-accent-300)" stopOpacity="0.6" />
            <stop offset="80%" stopColor="var(--color-accent-300)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--color-accent-300)" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="topo-fade-s" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-surface-plan-strong)" stopOpacity="0.08" />
            <stop offset="20%" stopColor="var(--color-surface-plan-strong)" stopOpacity="0.4" />
            <stop offset="80%" stopColor="var(--color-surface-plan-strong)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-surface-plan-strong)" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* Primary contour lines — representing major elevation changes */}
        <g fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M0,95 C120,85 240,60 360,65 C480,70 520,90 640,80 C760,70 840,45 960,55 C1080,65 1200,75 1320,60 C1380,52 1420,48 1440,50"
            stroke="url(#topo-fade-l)"
          />
          <path
            d="M0,75 C100,68 220,48 340,52 C460,56 540,72 680,62 C820,52 880,35 1020,42 C1160,49 1260,58 1380,45 C1420,41 1440,38 1440,38"
            stroke="url(#topo-fade-l)"
          />
          <path
            d="M0,55 C80,50 200,32 320,38 C440,44 560,55 700,45 C840,35 920,22 1080,30 C1240,38 1340,42 1440,28"
            stroke="url(#topo-fade-l)"
          />
        </g>

        {/* Secondary contour lines — finer detail between majors */}
        <g fill="none" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M0,105 C150,98 280,82 400,85 C520,88 600,95 720,88 C840,81 920,68 1060,72 C1200,76 1320,85 1440,72"
            stroke="url(#topo-fade-s)"
          />
          <path
            d="M0,85 C110,78 230,55 360,58 C490,61 550,80 700,72 C850,64 900,48 1050,52 C1200,56 1300,62 1440,48"
            stroke="url(#topo-fade-s)"
          />
          <path
            d="M0,65 C90,60 210,40 330,45 C450,50 570,62 710,52 C850,42 940,28 1100,35 C1260,42 1360,48 1440,34"
            stroke="url(#topo-fade-s)"
          />
          <path
            d="M0,45 C70,42 190,28 310,32 C430,36 550,48 700,38 C850,28 960,18 1120,24 C1280,30 1380,34 1440,22"
            stroke="url(#topo-fade-s)"
          />
          <path
            d="M0,30 C100,26 220,15 360,20 C500,25 600,35 740,28 C880,21 980,12 1140,16 C1300,20 1400,22 1440,14"
            stroke="url(#topo-fade-s)"
          />
        </g>

        {/* Spot elevation markers — small triangles typical of topo maps */}
        <g fill="var(--color-accent-300)" fillOpacity="0.5">
          <polygon points="360,52 353,66 367,66" />
          <polygon points="700,39 693,53 707,53" />
          <polygon points="1080,24 1073,38 1087,38" />
        </g>

        {/* Benchmark dots */}
        <g fill="var(--color-surface-rule)" fillOpacity="0.7">
          <circle cx="360" cy="58" r="2.5" />
          <circle cx="700" cy="45" r="2.5" />
          <circle cx="1080" cy="30" r="2.5" />
        </g>
      </svg>
    </div>
  )
}

export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = createTranslator(getDictionary(locale))
  const governorates = await getRepository().listGovernorates(locale)

  return (
    <footer className="relative mt-20 overflow-hidden bg-surface-inverse text-primary-100">
      {/* Subtle radial glow — adds depth behind the footer content */}
      <div className="pointer-events-none absolute -top-40 start-1/4 size-96 rounded-full bg-accent-400 opacity-[0.04] blur-[100px]" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 end-1/3 size-72 rounded-full bg-primary-400 opacity-[0.06] blur-[80px]" aria-hidden />

      <TopographicDivider />

      <div className="container-page pb-14 pt-4 sm:pt-6">
        {/* Brand + link groups on one row. Start-aligned and balanced across viewports. */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-col items-start text-start lg:w-64 lg:shrink-0">
            <div className="flex items-center gap-2.5">
              <StationMark className="size-10 shrink-0" />
              <span className="font-display text-[length:var(--type-base)] font-semibold text-text-on-inverse">
                {t('site.name')}
              </span>
            </div>
            <p className="mt-3 text-[length:var(--type-sm)] leading-snug text-primary-200">
              {t('site.founded')} · {t('site.location')}
            </p>
          </div>

          <div className="grid w-full flex-1 grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-4">
            {(Object.keys(footerNav) as Array<keyof typeof footerNav>).map((col) => (
              <nav key={col} aria-label={t(columnLabels[col])} className="flex flex-col items-start text-start">
                <h2 className="text-[length:var(--type-xs)] font-semibold uppercase tracking-wide text-accent-300">
                  {t(columnLabels[col])}
                </h2>
                <ul className="mt-3 flex flex-col gap-2 text-[length:var(--type-sm)]">
                  {footerNav[col].map((item) => (
                    <li key={item.key}>
                      <Link
                        href={href(locale, item.path)}
                        className="text-primary-200 transition-colors hover:text-text-on-inverse"
                      >
                        {t(linkLabels[item.key] ?? item.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Governorates as one dense traverse of links. */}
        <nav aria-label={t('footer.governorates')} className="mt-10 border-t border-primary-700/80 pt-6">
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[length:var(--type-xs)]">
            <li className="me-1 font-semibold uppercase tracking-wide text-accent-300">
              {t('footer.governorates')}
            </li>
            {governorates.map((g, i) => (
              <li key={g.id} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-primary-600" aria-hidden>·</span>}
                <Link
                  href={href(locale, `directory/governorate/${g.code}`)}
                  className="rounded px-1.5 py-0.5 text-primary-200 transition-colors hover:text-text-on-inverse"
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8 flex flex-col gap-4 border-t border-primary-700/80 pt-6 text-[length:var(--type-xs)] text-primary-300 md:flex-row md:items-center md:justify-between">
          <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <li className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5 text-accent-300" aria-hidden />
              <a href={contact.phoneHref} className="transition-colors hover:text-text-on-inverse">
                <span data-ltr>{contact.phone}</span>
              </a>
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5 text-accent-300" aria-hidden />
              <a href={`mailto:${contact.email}`} className="transition-colors hover:text-text-on-inverse">
                <span data-ltr>{contact.email}</span>
              </a>
            </li>
            <li className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 text-accent-300" aria-hidden />
              {t('contact.addressValue')}
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
