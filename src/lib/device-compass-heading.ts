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
 * Kompass-Heading aus absolutem alpha (0–360°), typische Web-/W3C-Konvention
 * für flaches Gerät in Portrait: heading = 360° − alpha.
 *
 * Hinweis: Die oft kopierte atan2-Euler-Formel aus Foren liefert hier leicht
 * falsche Werte (Kompass dreht mit dem Gerät mit). Tilt-Kompensation wäre
 * ein separates, getestetes Modell – bis dahin: einfache Formel.
 */
export function compassHeadingFromAbsoluteAlpha(alpha: number): number {
  return normalizeHeadingDeg(360 - alpha)
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

  return compassHeadingFromAbsoluteAlpha(event.alpha)
}
