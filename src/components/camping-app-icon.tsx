import * as React from 'react'

type CampingAppIconProps = React.SVGProps<SVGSVGElement>

/**
 * Vierteiliges CAMPPACK-Icon (Lagerfeuer, Zelt, Liste, Haken) im 2x2-Grid.
 * Wird für Favicon/PWA-Icons und als Logo-Bildmarke verwendet.
 */
export function CampingAppIcon(props: CampingAppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {/* Hintergrundquadrate */}
      <rect x="0" y="0" width="12" height="12" rx="2" fill="#2d4f1e" />
      <rect x="12" y="0" width="12" height="12" rx="2" fill="#3f6a2b" />
      <rect x="0" y="12" width="12" height="12" rx="2" fill="#ecf3e8" />
      <rect x="12" y="12" width="12" height="12" rx="2" fill="#6ea65a" />

      {/* Lagerfeuer oben links */}
      <path
        d="M5 3.5c.8.7 1.3 1.6 1.3 2.6 0 1.2-.7 2.1-1.8 2.7.2-1 .1-1.6-.2-2.3C3.9 5.7 3.6 5.1 3.6 4.3 3.6 3.7 3.8 3.1 4 2.6c.3.4.6.7 1 .9Z"
        fill="#ffe6c2"
      />
      <path
        d="M3.3 8.7 2 9.4M8.7 8.7 10 9.4M3.3 10.3l3.2-1.5 3.2 1.5"
        stroke="#f8d29b"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Zelt oben rechts */}
      <path
        d="M14 9.5 17.5 3 21 9.5h-1.3L17.5 5 15.8 9.5H14Z"
        fill="#f7f9f6"
      />
      <path
        d="M17.5 3v6.5M14 9.5h7"
        stroke="#f7f9f6"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Liste unten links */}
      <path
        d="M3.5 14h5M3.5 16.5h5M3.5 19h5"
        stroke="#2d4f1e"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="2.3" cy="14" r="0.6" fill="#2d4f1e" />
      <circle cx="2.3" cy="16.5" r="0.6" fill="#2d4f1e" />
      <circle cx="2.3" cy="19" r="0.6" fill="#2d4f1e" />

      {/* Haken unten rechts */}
      <path
        d="M15 18.2 16.9 20l3.1-3.7"
        stroke="#f7f9f6"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

