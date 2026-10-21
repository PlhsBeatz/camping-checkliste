export type SettingsNavItem = {
  label: string
  href: string
  /** Nur für Admins (canAccessConfig) sichtbar */
  configOnly?: boolean
  /** Nur für System-Admin sichtbar */
  systemAdminOnly?: boolean
}

export type SettingsNavGroup = {
  label: string
  items: SettingsNavItem[]
  /** Gruppe nur für Admins */
  configOnly?: boolean
  /** Gruppe nur für System-Admin */
  systemAdminOnly?: boolean
}

/** Erste persönliche Einstellungsseite – Desktop-Default statt Hub */
export const SETTINGS_DEFAULT_HREF = '/einstellungen/darstellung'

/**
 * Einstellungen-Subnav: persönlich zuerst, Admin darunter.
 * Stammdaten-Routen bleiben flach (/kategorien …).
 */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    label: 'Persönlich',
    items: [
      { label: 'Darstellung', href: SETTINGS_DEFAULT_HREF },
      { label: 'Benachrichtigungen', href: '/einstellungen/benachrichtigungen' },
      { label: 'Standort', href: '/einstellungen/standort' },
      { label: 'Mein Konto', href: '/einstellungen/konto' },
    ],
  },
  {
    label: 'Über die App',
    items: [
      { label: 'Feedback & Roadmap', href: '/einstellungen/ueber' },
    ],
  },
  {
    label: 'Stammdaten',
    configOnly: true,
    items: [
      { label: 'Kategorien', href: '/kategorien', configOnly: true },
      { label: 'Tags', href: '/tags', configOnly: true },
      { label: 'Personen', href: '/mitreisende', configOnly: true },
      { label: 'Transportmittel', href: '/transportmittel', configOnly: true },
      { label: 'Wartungs-Vorlagen', href: '/wartung-vorlagen', configOnly: true },
      { label: 'Verbrauch-Medien', href: '/verbrauch-medien', configOnly: true },
    ],
  },
  {
    label: 'System',
    systemAdminOnly: true,
    items: [
      { label: 'Datensicherung', href: '/datensicherung', systemAdminOnly: true },
      { label: 'Integrationen', href: '/integrationen', systemAdminOnly: true },
    ],
  },
]

const SETTINGS_PATHS = [
  '/einstellungen',
  '/konfiguration',
  '/profil',
  '/einstellungen/kontodaten',
  '/einstellungen/heimatadresse',
  '/einstellungen/sitzung',
  ...SETTINGS_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
]

export function isSettingsRoute(pathname: string): boolean {
  return SETTINGS_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

/** @deprecated Alias – nutze isSettingsRoute */
export function isConfigRoute(pathname: string): boolean {
  return isSettingsRoute(pathname)
}

export function isSettingsNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** @deprecated Alias */
export function isConfigNavItemActive(pathname: string, href: string): boolean {
  return isSettingsNavItemActive(pathname, href)
}

export function getActiveSettingsItem(pathname: string): SettingsNavItem | undefined {
  if (
    pathname.startsWith('/einstellungen/passwort-aendern') ||
    pathname.startsWith('/einstellungen/kontodaten')
  ) {
    return SETTINGS_NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.href === '/einstellungen/konto'
    )
  }
  if (pathname.startsWith('/einstellungen/heimatadresse')) {
    return SETTINGS_NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.href === '/einstellungen/standort'
    )
  }
  if (pathname.startsWith('/einstellungen/sitzung')) {
    return SETTINGS_NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.href === '/einstellungen/konto'
    )
  }
  return SETTINGS_NAV_GROUPS.flatMap((group) => group.items).find((item) =>
    isSettingsNavItemActive(pathname, item.href)
  )
}

/** @deprecated Alias */
export function getActiveConfigItem(pathname: string): SettingsNavItem | undefined {
  return getActiveSettingsItem(pathname)
}

export function getActiveSettingsHref(pathname: string): string | undefined {
  return getActiveSettingsItem(pathname)?.href
}

/** @deprecated Alias */
export function getActiveConfigHref(pathname: string): string | undefined {
  return getActiveSettingsHref(pathname)
}

/** @deprecated Alias – nutze SETTINGS_NAV_GROUPS */
export const CONFIG_NAV_GROUPS = SETTINGS_NAV_GROUPS
