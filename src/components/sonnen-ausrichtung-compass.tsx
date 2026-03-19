'use client'

import { useEffect, useState, useCallback } from 'react'
import * as SunCalc from 'suncalc'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

/** SunCalc azimuth is from South (0=South). Convert to compass degrees (0=North). */
function suncalcAzimuthToCompass(azimuthRad: number): number {
  const deg = (azimuthRad * 180) / Math.PI
  return (deg + 180) % 360
}

interface SunData {
  sunrise: Date
  sunset: Date
  solarNoon: Date
  sunriseAzimuth: number
  sunsetAzimuth: number
  solarNoonAzimuth: number
  currentAzimuth: number
  currentAltitude: number
  isPolarDay: boolean
  isPolarNight: boolean
}

function computeSunData(
  lat: number,
  lng: number,
  date: Date
): SunData | null {
  try {
    const times = SunCalc.getTimes(date, lat, lng)
    const sunrise = times.sunrise
    const sunset = times.sunset
    const solarNoon = times.solarNoon

    if (!sunrise || !sunset) {
      return {
        sunrise: new Date(),
        sunset: new Date(),
        solarNoon: solarNoon ?? new Date(),
        sunriseAzimuth: 0,
        sunsetAzimuth: 0,
        solarNoonAzimuth: 180,
        currentAzimuth: 0,
        currentAltitude: 0,
        isPolarDay: true,
        isPolarNight: false,
      }
    }

    const sunrisePos = SunCalc.getPosition(sunrise, lat, lng)
    const sunsetPos = SunCalc.getPosition(sunset, lat, lng)
    const solarNoonPos = SunCalc.getPosition(solarNoon ?? date, lat, lng)
    const currentPos = SunCalc.getPosition(date, lat, lng)

    const sunriseAzimuth = suncalcAzimuthToCompass(sunrisePos.azimuth)
    const sunsetAzimuth = suncalcAzimuthToCompass(sunsetPos.azimuth)
    const solarNoonAzimuth = suncalcAzimuthToCompass(solarNoonPos.azimuth)
    const currentAzimuth = suncalcAzimuthToCompass(currentPos.azimuth)

    const isPolarDay = sunrise.getTime() === sunset.getTime() && currentPos.altitude > 0
    const isPolarNight = sunrise.getTime() === sunset.getTime() && currentPos.altitude <= 0

    return {
      sunrise,
      sunset,
      solarNoon: solarNoon ?? new Date(),
      sunriseAzimuth,
      sunsetAzimuth,
      solarNoonAzimuth,
      currentAzimuth,
      currentAltitude: currentPos.altitude,
      isPolarDay,
      isPolarNight,
    }
  } catch {
    return null
  }
}

/** Convert compass degrees (0=North, 90=East) to SVG coordinates (center cx,cy, radius r). SVG: 0° = East (right). */
function compassToSvg(compassDeg: number, cx: number, cy: number, r: number) {
  const rad = ((90 - compassDeg) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  }
}

/** Prüft ob Winkel im Sonnenbogen (gelber Bereich) liegt */
function isInSunArc(
  deg: number,
  sunStart: number,
  sunEnd: number,
  isPolarDay: boolean,
  isPolarNight: boolean
): boolean {
  if (isPolarDay) return true
  if (isPolarNight) return false
  const d = (deg + 360) % 360
  const s = (sunStart + 360) % 360
  const e = (sunEnd + 360) % 360
  if (s <= e) return d >= s && d <= e
  return d >= s || d <= e
}

interface SonnenAusrichtungCompassProps {
  lat: number
  lng: number
  date?: Date
  deviceHeading: number | null
}

export function SonnenAusrichtungCompass({
  lat,
  lng,
  date: _date,
  deviceHeading,
}: SonnenAusrichtungCompassProps) {
  const [sunData, setSunData] = useState<SunData | null>(null)

  const updateSunData = useCallback(() => {
    setSunData(computeSunData(lat, lng, new Date()))
  }, [lat, lng])

  useEffect(() => {
    updateSunData()
    const interval = setInterval(updateSunData, 60000)
    return () => clearInterval(interval)
  }, [updateSunData])

  if (!sunData) return null

  const size = 360
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8

  const rotation = deviceHeading != null ? -deviceHeading : 0

  let sunArcStart = sunData.sunriseAzimuth
  let sunArcEnd = sunData.sunsetAzimuth

  if (sunData.isPolarDay) {
    sunArcStart = 0
    sunArcEnd = 360
  } else if (sunData.isPolarNight) {
    sunArcStart = 0
    sunArcEnd = 0
  } else if (sunArcStart > sunArcEnd) {
    sunArcEnd += 360
  }

  const sunStart = compassToSvg(sunArcStart % 360, cx, cy, r)
  const sunEnd = compassToSvg(sunArcEnd % 360, cx, cy, r)
  const sunPos = compassToSvg(sunData.currentAzimuth, cx, cy, r * 0.85)

  const largeArc = sunData.isPolarDay || (sunArcEnd - sunArcStart) > 180 ? 1 : 0

  const sunArcPath =
    sunData.isPolarNight
      ? ''
      : sunData.isPolarDay
        ? `M ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
        : `M ${sunStart.x} ${sunStart.y} A ${r} ${r} 0 ${largeArc} 1 ${sunEnd.x} ${sunEnd.y}`

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="p-4">
        <div
          className="relative transition-transform duration-100 rounded-full overflow-hidden w-full max-w-[min(calc(100vw-2rem),360px)] aspect-square"
          style={{
            transform: `rotate(${rotation}deg)`,
            boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.45), 0 12px 24px -8px rgb(0 0 0 / 0.3)',
          }}
        >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full block"
        >
          <defs>
            <linearGradient id="sunArcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#fcd34d" />
            </linearGradient>
            {!sunData.isPolarDay && !sunData.isPolarNight && (() => {
              const labelR = r - 22
              const sr = sunData.sunriseAzimuth
              const sn = sunData.solarNoonAzimuth
              const ss = sunData.sunsetAzimuth
              return (
                <>
                  {/* Sonnenaufgang: Bogen ins Gelbe (rechtsbündig), Text linksbündig am Anfang */}
                  <path
                    id="time-path-sunrise"
                    d={`M ${compassToSvg(sr + 8, cx, cy, labelR).x} ${compassToSvg(sr + 8, cx, cy, labelR).y} A ${labelR} ${labelR} 0 0 1 ${compassToSvg(sr + 28, cx, cy, labelR).x} ${compassToSvg(sr + 28, cx, cy, labelR).y}`}
                    fill="none"
                  />
                  {/* Mittagssonne: zentriert im Gelben */}
                  <path
                    id="time-path-noon"
                    d={`M ${compassToSvg(sn - 10, cx, cy, labelR).x} ${compassToSvg(sn - 10, cx, cy, labelR).y} A ${labelR} ${labelR} 0 0 1 ${compassToSvg(sn + 10, cx, cy, labelR).x} ${compassToSvg(sn + 10, cx, cy, labelR).y}`}
                    fill="none"
                  />
                  {/* Sonnenuntergang: Bogen ins Gelbe (linksbündig), Text rechtsbündig am Ende */}
                  <path
                    id="time-path-sunset"
                    d={`M ${compassToSvg(ss - 28, cx, cy, labelR).x} ${compassToSvg(ss - 28, cx, cy, labelR).y} A ${labelR} ${labelR} 0 0 1 ${compassToSvg(ss - 8, cx, cy, labelR).x} ${compassToSvg(ss - 8, cx, cy, labelR).y}`}
                    fill="none"
                  />
                </>
              )
            })()}
          </defs>

          {/* Vollflächiger Hintergrund – kein Rand */}
          <rect width={size} height={size} fill="rgb(45,79,30)" />

          {/* Dark green compass circle (night) */}
          <circle cx={cx} cy={cy} r={r} fill="rgb(45,79,30)" />

          {/* Yellow sun arc (daylight) - Packstatus fest installiert amber-200 */}
          {sunArcPath && (
            <path
              d={`${sunArcPath} L ${cx} ${cy} Z`}
              fill="url(#sunArcGradient)"
            />
          )}

          {/* Degree markings: nur alle 30° (1 Stunde), Farbe je nach Sonnenbereich – über Sonnenbogen */}
          {Array.from({ length: 12 }, (_, i) => {
            const deg = i * 30
            const inSun = isInSunArc(deg, sunArcStart, sunArcEnd, sunData.isPolarDay, sunData.isPolarNight)
            const outer = compassToSvg(deg, cx, cy, r)
            const tickLen = 8
            const inner = compassToSvg(deg, cx, cy, r - tickLen)
            return (
              <line
                key={deg}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke={inSun ? 'rgb(45,79,30)' : 'white'}
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={inSun ? 0.9 : 0.85}
              />
            )
          })}

          {/* Sun symbol at current position (only if above horizon) - accent orange, schlicht */}
          {sunData.currentAltitude > -0.1 && (
            <g transform={`translate(${sunPos.x}, ${sunPos.y})`}>
              <circle r={8} fill="rgb(230,126,34)" />
              {[0, 90, 180, 270].map((deg) => {
                const rad = (deg * Math.PI) / 180
                return (
                  <line
                    key={deg}
                    x1={4 * Math.cos(rad)}
                    y1={-4 * Math.sin(rad)}
                    x2={8 * Math.cos(rad)}
                    y2={-8 * Math.sin(rad)}
                    stroke="rgb(230,126,34)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
          )}

          {/* N with arrow at top - white */}
          <g transform={`translate(${cx}, ${cy - r + 40})`}>
            <polygon points="0,-18 5,-2 -5,-2" fill="white" stroke="white" strokeWidth={0.5} />
            <text
              x="0"
              y="16"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-lg font-bold fill-white"
              style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
            >
              N
            </text>
          </g>

          {/* Uhrzeiten am Kreis: Sonnenaufgang, Mittagssonne, Sonnenuntergang – vollständig im gelben Bereich */}
          {!sunData.isPolarDay && !sunData.isPolarNight && (
            <>
              <text
                fontSize="11"
                fill="rgb(45,79,30)"
                fontWeight="600"
                style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
              >
                <textPath href="#time-path-sunrise" startOffset="0%" textAnchor="start">
                  {format(sunData.sunrise, 'HH:mm', { locale: de })}
                </textPath>
              </text>
              <text
                fontSize="11"
                fill="rgb(45,79,30)"
                fontWeight="600"
                style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
              >
                <textPath href="#time-path-noon" startOffset="50%" textAnchor="middle">
                  {format(sunData.solarNoon, 'HH:mm', { locale: de })}
                </textPath>
              </text>
              <text
                fontSize="11"
                fill="rgb(45,79,30)"
                fontWeight="600"
                style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
              >
                <textPath href="#time-path-sunset" startOffset="100%" textAnchor="end">
                  {format(sunData.sunset, 'HH:mm', { locale: de })}
                </textPath>
              </text>
            </>
          )}
        </svg>
        </div>
      </div>

      {/* Data panel */}
      <div className="w-full max-w-xs rounded-lg bg-[rgb(250,250,249)] border border-gray-200 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Sonnenaufgang</span>
          <span className="font-medium">
            {sunData.isPolarDay ? '—' : sunData.isPolarNight ? '—' : format(sunData.sunrise, 'HH:mm', { locale: de })}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Mittagssonne</span>
          <span className="font-medium">{format(sunData.solarNoon, 'HH:mm', { locale: de })}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Sonnenuntergang</span>
          <span className="font-medium">
            {sunData.isPolarDay ? '—' : sunData.isPolarNight ? '—' : format(sunData.sunset, 'HH:mm', { locale: de })}
          </span>
        </div>
      </div>

      {(sunData.isPolarDay || sunData.isPolarNight) && (
        <p className="text-sm text-gray-500">
          {sunData.isPolarDay ? 'Sonne 24h sichtbar (Polartag)' : 'Sonne nicht sichtbar (Polarnacht)'}
        </p>
      )}
    </div>
  )
}
