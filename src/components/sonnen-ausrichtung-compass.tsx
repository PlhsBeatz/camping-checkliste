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
        currentAzimuth: 0,
        currentAltitude: 0,
        isPolarDay: true,
        isPolarNight: false,
      }
    }

    const sunrisePos = SunCalc.getPosition(sunrise, lat, lng)
    const sunsetPos = SunCalc.getPosition(sunset, lat, lng)
    const currentPos = SunCalc.getPosition(date, lat, lng)

    const sunriseAzimuth = suncalcAzimuthToCompass(sunrisePos.azimuth)
    const sunsetAzimuth = suncalcAzimuthToCompass(sunsetPos.azimuth)
    const currentAzimuth = suncalcAzimuthToCompass(currentPos.azimuth)

    const isPolarDay = sunrise.getTime() === sunset.getTime() && currentPos.altitude > 0
    const isPolarNight = sunrise.getTime() === sunset.getTime() && currentPos.altitude <= 0

    return {
      sunrise,
      sunset,
      solarNoon: solarNoon ?? new Date(),
      sunriseAzimuth,
      sunsetAzimuth,
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

interface SonnenAusrichtungCompassProps {
  lat: number
  lng: number
  date?: Date
  deviceHeading: number | null
  compassEnabled: boolean
}

export function SonnenAusrichtungCompass({
  lat,
  lng,
  date = new Date(),
  deviceHeading,
  compassEnabled,
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

  const size = 280
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 12

  const rotation = compassEnabled && deviceHeading != null ? -deviceHeading : 0

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
      <div
        className="relative transition-transform duration-100"
        style={{
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="max-w-full aspect-square"
        >
          <defs>
            <linearGradient id="sunGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>

          {/* Green background (night) */}
          <circle cx={cx} cy={cy} r={r} fill="#22c55e" stroke="#16a34a" strokeWidth={2} />

          {/* Orange sun arc (daylight) - drawn on top of green base */}
          {sunArcPath && (
            <path
              d={`${sunArcPath} L ${cx} ${cy} Z`}
              fill="url(#sunGradient)"
              stroke="#ea580c"
              strokeWidth={1}
            />
          )}

          {/* Circle border */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#16a34a" strokeWidth={2} />

          {/* Sun symbol at current position (only if above horizon) */}
          {sunData.currentAltitude > -0.1 && (
            <g transform={`translate(${sunPos.x}, ${sunPos.y})`}>
              <circle r={12} fill="#fbbf24" stroke="#f59e0b" strokeWidth={2} />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                const rad = (deg * Math.PI) / 180
                const x1 = 6 * Math.cos(rad)
                const y1 = -6 * Math.sin(rad)
                const x2 = 14 * Math.cos(rad)
                const y2 = -14 * Math.sin(rad)
                return (
                  <line
                    key={deg}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
          )}

          {/* N with arrow at top */}
          <g transform={`translate(${cx}, ${cy - r + 36})`}>
            <polygon points="0,-16 6,-4 -6,-4" fill="#1f2937" />
            <text
              x="0"
              y="14"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-lg font-bold fill-gray-900"
              style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
            >
              N
            </text>
          </g>
        </svg>
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
