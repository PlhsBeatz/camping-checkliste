/**
 * Eine Quelle für die App-Version (Feedback-Issues, UI später).
 * Entspricht package.json "version".
 */
export const APP_VERSION = '0.1.0'

export function formatAppVersionLabel(version: string = APP_VERSION): string {
  return `v ${version}`
}
