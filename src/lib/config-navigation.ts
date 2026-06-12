export type ConfigNavItem = {
  label: string
  href: string
  /** Nur für System-Admin sichtbar */
  systemAdminOnly?: boolean
}

export type ConfigNavGroup = {
  label: string
  items: ConfigNavItem[]
}

export const CONFIG_NAV_GROUPS: ConfigNavGroup[] = [
  {
    label: 'Stammdaten',
    items: [
      { label: 'Kategorien', href: '/kategorien' },
      { label: 'Tags', href: '/tags' },
      { label: 'Personen', href: '/mitreisende' },
      { label: 'Transportmittel', href: '/transportmittel' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Datensicherung', href: '/datensicherung', systemAdminOnly: true },
      { label: 'Integrationen', href: '/integrationen', systemAdminOnly: true },
    ],
  },
]

const CONFIG_PATHS = [
  '/konfiguration',
  ...CONFIG_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
]

export function isConfigRoute(pathname: string): boolean {
  return CONFIG_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export function isConfigNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Aktiver Konfigurations-Unterbereich (nicht auf der Übersicht /konfiguration). */
export function getActiveConfigItem(pathname: string): ConfigNavItem | undefined {
  return CONFIG_NAV_GROUPS.flatMap((group) => group.items).find((item) =>
    isConfigNavItemActive(pathname, item.href)
  )
}

export function getActiveConfigHref(pathname: string): string | undefined {
  return getActiveConfigItem(pathname)?.href
}
