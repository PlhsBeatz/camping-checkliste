/**
 * @deprecated Importiere aus `@/lib/settings-navigation`.
 * Re-Export für bestehende Imports.
 */
export {
  SETTINGS_NAV_GROUPS as CONFIG_NAV_GROUPS,
  SETTINGS_NAV_GROUPS,
  isSettingsRoute,
  isConfigRoute,
  isSettingsNavItemActive,
  isConfigNavItemActive,
  getActiveSettingsItem,
  getActiveConfigItem,
  getActiveSettingsHref,
  getActiveConfigHref,
  type SettingsNavItem as ConfigNavItem,
  type SettingsNavGroup as ConfigNavGroup,
  type SettingsNavItem,
  type SettingsNavGroup,
} from '@/lib/settings-navigation'
