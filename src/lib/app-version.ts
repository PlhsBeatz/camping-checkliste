/**
 * Produktversion (SemVer) – bewusst bei Releases anheben.
 * Entspricht package.json "version".
 * Build-ID: kurzer Git-SHA zur eindeutigen Deploy-Unterscheidung (kein SemVer-Bump).
 */
export const APP_VERSION = '1.0.2'

/** Kurz-SHA aus CI/Build; leer lokal ohne Env. */
export const APP_BUILD_ID = (
  process.env.NEXT_PUBLIC_APP_BUILD_ID ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.WORKERS_CI_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  ''
)
  .trim()
  .slice(0, 7)

export function formatAppVersionLabel(version: string = APP_VERSION): string {
  return `v ${version}`
}

/** Anzeige z. B. „1.0.0“ oder „1.0.0 · a1b2c3d“. */
export function formatAppVersionDisplay(
  version: string = APP_VERSION,
  buildId: string = APP_BUILD_ID
): string {
  const v = version.trim()
  const b = buildId.trim()
  return b ? `${v} · ${b}` : v
}
