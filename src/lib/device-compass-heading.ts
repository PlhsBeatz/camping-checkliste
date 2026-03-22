/**
 * Kompass-Richtung aus DeviceOrientationEvent (0° = Nord, im Uhrzeigersinn).
 *
 * Wichtig (Chrome 50+, Safari):
 * - `deviceorientation` ohne Magnetometer liefert oft relative Winkel: alpha bezieht sich auf
 *   die Startposition beim Laden — daher „Norden hängt davon ab, wie ich das Handy beim Refresh halte“.
 * - Für geografischen Norden: `deviceorientationabsolute` (Android Chrome) ODER
 *   `deviceorientation` nur wenn `event.absolute === true` ODER iOS `webkitCompassHeading`.
 *
 * @see https://developer.chrome.com/blog/device-orientation-changes
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/deviceorientationabsolute_event
 */

export function normalizeHeadingDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/**
 * Aus absoluter Orientierung (alpha, beta, gamma in Grad): Kompass-Heading.
 * Funktioniert auch bei leicht geneigtem Gerät; für flaches Handy nähert sich das Ergebnis 360° − alpha.
 */
export function compassHeadingFromEulerDeg(
  alpha: number,
  beta: number | null,
  gamma: number | null
): number {
  const b = beta ?? 0
  const g = gamma ?? 0
  const degToRad = Math.PI / 180
  const a = alpha * degToRad
  const bRad = b * degToRad
  const gRad = g * degToRad

  const cA = Math.cos(a)
  const sA = Math.sin(a)
  const cB = Math.cos(bRad)
  const sB = Math.sin(bRad)
  const cG = Math.cos(gRad)
  const sG = Math.sin(gRad)

  // Häufig zitierte Umrechnung (z. B. Stack Overflow / Geräteorientierungs-Snippets)
  const y = -cA * sB - sA * sG * cB
  const x = sA * sB - cA * sG * cB
  let heading = Math.atan2(y, x) / degToRad
  if (heading < 0) heading += 360
  return normalizeHeadingDeg(heading)
}

export type DeviceOrientationEventWithWebkit = DeviceOrientationEvent & {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

/**
 * Liefert eine gültige Kompassrichtung oder `null`, wenn nur relative Orientierung vorliegt
 * (dann darf alpha nicht für „Nord“ verwendet werden).
 */
export function extractCompassHeadingDeg(
  event: DeviceOrientationEventWithWebkit
): number | null {
  if (
    typeof event.webkitCompassHeading === 'number' &&
    !Number.isNaN(event.webkitCompassHeading)
  ) {
    return normalizeHeadingDeg(event.webkitCompassHeading)
  }

  if (!event.absolute) {
    return null
  }

  if (event.alpha == null || Number.isNaN(event.alpha)) {
    return null
  }

  return compassHeadingFromEulerDeg(event.alpha, event.beta, event.gamma)
}
