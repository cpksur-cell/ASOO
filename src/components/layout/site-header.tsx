import Link from 'next/link'
import { LogIn } from 'lucide-react'

import { getDictionary, createTranslator, type Locale } from '@/i18n/config'
import { href, primaryNav } from '@/lib/routes'
import { NavLink } from './nav-link'
import { LocaleSwitcher } from './locale-switcher'
import { MobileChrome } from './mobile-nav'
import { ThemeToggle } from './theme-toggle'
import { MockRoleSwitcher } from './mock-role-switcher'
import { StationMark } from '@/components/ui/station-mark'
import { isMockAuthEnabled, MOCK_ROLES, type MockRole } from '@/lib/auth/mock'
import type { BottomNavItem } from './bottom-nav'

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = createTranslator(getDictionary(locale))

  /*
   * The role switcher is a development affordance. Gating it here — in a
   * server component — means it never renders for a real visitor, on top of
   * the independent guard on the API route it calls.
   */
  const showRoleSwitcher = isMockAuthEnabled()
  const roleLabels = Object.fromEntries(
    MOCK_ROLES.map((r) => [r, t(`role.${r}`)]),
  ) as Record<MockRole, string>

  const drawerItems = primaryNav.map((item) => ({
    label: t(`nav.${item.key}`),
    href: href(locale, item.path),
  }))

  /* The four things people actually come here to do. Everything else lives
     behind "More". docs/04-site-architecture.md §5.3. */
  const bottomItems: BottomNavItem[] = [
    { key: 'home', label: t('nav.home'), href: href(locale), exact: true },
    { key: 'directory', label: t('nav.directoryShort'), href: href(locale, 'directory') },
    { key: 'services', label: t('nav.servicesShort'), href: href(locale, 'services') },
    { key: 'news', label: t('nav.news'), href: href(locale, 'news') },
  ]

  const themeLabels = {
    theme: t('theme.label'),
    themeLight: t('theme.light'),
    themeDark: t('theme.dark'),
    themeSystem: t('theme.system'),
  }

  return (
    <>
      <header className="sticky top-0 z-[1100] bg-surface-brand">
        <a href="#main" className="skip-link">
          {t('nav.skipToContent')}
        </a>

        <div className="container-page">
          <div className="flex h-16 items-center gap-3 md:h-[4.5rem]">
            {/*
              Wordmark. `min-w-0` + `truncate` is the fix for the overlap: the
              long English name previously used `whitespace-nowrap` with no
              overflow bound, so a `flex-1` centred nav squeezed the wordmark
              box to nothing while the text spilled across the nav. Now the
              name ellipsizes when genuinely out of room instead of colliding.
            */}
            <Link
              href={href(locale)}
              className="flex min-h-11 min-w-0 shrink items-center gap-2.5 text-text-on-brand"
            >
              <StationMark className="size-9 shrink-0 sm:size-10" />
              <span className="truncate font-display text-[length:var(--type-sm)] font-bold tracking-tight sm:text-[length:var(--type-base)]">
                {t('site.name')}
              </span>
            </Link>

            {/*
              Nav is no longer `flex-1` — it takes only its content width and
              sits after the wordmark. The actions cluster uses `ms-auto` to
              hold the far edge, so nothing fights the wordmark for space.
            */}
            <nav
              aria-label={t('nav.mainNavigation')}
              className="ms-2 hidden shrink-0 lg:flex xl:ms-6"
            >
              <ul className="flex items-center gap-0.5">
                {primaryNav.map((item) => (
                  <li key={item.key}>
                    <NavLink href={href(locale, item.path)} exact={item.path === ''}>
                      {t(`nav.${item.key}`)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-2.5">
              {showRoleSwitcher && (
                <MockRoleSwitcher
                  labels={roleLabels}
                  activeLabelFallback={t('role.switcher')}
                  switcherLabel={t('role.switcher')}
                  signOutLabel={t('auth.signOut')}
                />
              )}

              <ThemeToggle className="hidden md:inline-flex" labels={{
                theme: themeLabels.theme,
                light: themeLabels.themeLight,
                dark: themeLabels.themeDark,
                system: themeLabels.themeSystem,
              }} />

              <LocaleSwitcher
                locale={locale}
                label={t('common.switchToEnglish')}
                className="text-primary-100 hover:bg-primary-600 hover:text-text-on-brand"
              />

              <Link
                href={href(locale, 'login')}
                className="hidden min-h-11 items-center gap-2 rounded-md bg-surface-accent px-4 text-[length:var(--type-sm)] font-semibold text-text-on-accent transition-colors duration-[120ms] hover:bg-accent-300 sm:inline-flex whitespace-nowrap shrink-0"
              >
                <LogIn className="size-4 shrink-0" data-mirror="true" aria-hidden />
                <span>{t('nav.login')}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* The station rule. Decorative — carries no meaning. */}
        <div className="h-[3px] bg-surface-rule" aria-hidden />
      </header>

      <MobileChrome
        locale={locale}
        drawerItems={drawerItems}
        bottomItems={bottomItems}
        labels={{
          menu: t('nav.menu'),
          more: t('nav.more'),
          close: t('nav.closeMenu'),
          login: t('nav.login'),
          loginHref: href(locale, 'login'),
          ...themeLabels,
        }}
      />
    </>
  )
}
